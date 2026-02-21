import type { Command } from "commander";
import { createClient } from "../gateway/client.js";

function output(result: unknown): void {
  console.log(JSON.stringify(result));
}

interface SearchResult {
  domain: string;
  name: string;
  description: string;
  matchedEndpoints?: { method: string; path: string; description: string }[];
}

interface EndpointResult {
  method: string;
  path: string;
  description: string;
}

export function isSearchResults(data: unknown): data is SearchResult[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return typeof first === "object" && first !== null && "domain" in first && "name" in first;
}

export function isEndpointResults(data: unknown): data is EndpointResult[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return typeof first === "object" && first !== null && "method" in first && "path" in first;
}

export function formatGrepResults(data: unknown): string {
  // Domain-level search results (from "grep pattern /")
  if (isSearchResults(data)) {
    return data
      .map((s) => {
        const header = `${s.domain} — ${s.name}`;
        if (!s.matchedEndpoints || s.matchedEndpoints.length === 0) {
          return header;
        }
        const endpoints = s.matchedEndpoints
          .map((e) => `  ${e.method.padEnd(6)} ${e.path}  — ${e.description}`)
          .join("\n");
        return `${header} · ${s.matchedEndpoints.length} matched\n${endpoints}`;
      })
      .join("\n\n");
  }

  // Endpoint-level search results (from "grep pattern /domain/")
  if (isEndpointResults(data)) {
    if (data.length === 0) return "No matching endpoints.";
    return data
      .map((e) => `${e.method.padEnd(6)} ${e.path}  — ${e.description}`)
      .join("\n");
  }

  // Fallback to JSON for other grep results
  return JSON.stringify(data);
}

/** Extract domain from an nkmc path like "/rpc.ankr.com/blocks/" */
export function extractDomain(path: string): string | null {
  const segments = path.replace(/^\/+/, "").split("/");
  const first = segments[0];
  if (!first) return null;
  // Strip @version suffix
  const domain = first.includes("@") ? first.slice(0, first.indexOf("@")) : first;
  // Must look like a domain (has at least one dot)
  return domain.includes(".") ? domain : null;
}

/** Detect auth-related errors in gateway responses (401, 403, or 500-wrapped upstream auth failures) */
export function isAuthError(message: string): boolean {
  // Direct 401/403 from gateway
  if (/Gateway error (401|403):/.test(message)) return true;
  // 500-wrapped upstream auth failure (BACKEND_ERROR with auth keywords)
  if (/Gateway error 500:/.test(message) && /\b(Unauthorized|Unauthenticated|authenticate|API key|api[_-]?key)\b/i.test(message)) return true;
  return false;
}

function handleError(err: unknown, cmdPath?: string): never {
  const message = err instanceof Error ? err.message : String(err);

  if (isAuthError(message)) {
    // Try to get domain from the command path first, then fall back to error message
    const domain = (cmdPath && extractDomain(cmdPath)) ||
      message.match(/([a-z0-9-]+(?:\.[a-z0-9-]+){1,})/i)?.[1] || null;
    if (domain) {
      console.error(`Error: Authentication required for ${domain}`);
      console.error(`  Set your key:  nkmc keys set ${domain} --token <YOUR_KEY> --sync`);
      console.error(`  Then retry your command.`);
      process.exit(1);
    }
  }

  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

export function registerFsCommands(program: Command): void {
  program
    .command("ls")
    .description("List files in a directory")
    .argument("<path>", "Directory path")
    .action(async (path: string) => {
      try {
        const client = await createClient();
        const result = await client.execute(`ls ${path}`);
        output(result);
      } catch (err) {
        handleError(err, path);
      }
    });

  program
    .command("cat")
    .description("Read file contents")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      try {
        const client = await createClient();
        const result = await client.execute(`cat ${path}`);
        output(result);
      } catch (err) {
        handleError(err, path);
      }
    });

  program
    .command("write")
    .description("Write data to a file")
    .argument("<path>", "File path")
    .argument("<data>", "Data to write")
    .action(async (path: string, data: string) => {
      try {
        const client = await createClient();
        const result = await client.execute(`write ${path} ${data}`);
        output(result);
      } catch (err) {
        handleError(err, path);
      }
    });

  program
    .command("rm")
    .description("Remove a file")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      try {
        const client = await createClient();
        const result = await client.execute(`rm ${path}`);
        output(result);
      } catch (err) {
        handleError(err, path);
      }
    });

  program
    .command("grep")
    .description("Search file contents")
    .argument("<pattern>", "Search pattern")
    .argument("<path>", "File or directory path")
    .action(async (pattern: string, path: string) => {
      try {
        const client = await createClient();
        const result = await client.execute(`grep ${pattern} ${path}`);
        console.log(formatGrepResults(result));
      } catch (err) {
        handleError(err, path);
      }
    });

  program
    .command("pipe")
    .description("Pipe commands: cat <path> | write <path>")
    .argument("<expression...>", "Pipe expression")
    .action(async (expression: string[]) => {
      try {
        const full = expression.join(" ");
        const parts = full.split("|").map((s) => s.trim());
        if (parts.length !== 2) {
          throw new Error("Pipe expression must have exactly two stages separated by '|'");
        }

        const [source, target] = parts;
        if (!source.startsWith("cat ")) {
          throw new Error("Pipe step 1 must be a 'cat' command");
        }
        if (!target.startsWith("write ")) {
          throw new Error("Pipe step 2 must be a 'write' command");
        }

        const client = await createClient();

        // Step 1: cat
        let data: unknown;
        try {
          data = await client.execute(source);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Pipe step 1 failed: ${msg}`);
        }

        // Step 2: write (append data as JSON to the write command)
        const writePath = target.slice("write ".length).trim();
        let result: unknown;
        try {
          result = await client.execute(`write ${writePath} ${JSON.stringify(data)}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Pipe step 2 failed: ${msg}`);
        }

        output(result);
      } catch (err) {
        handleError(err, source.slice("cat ".length).trim());
      }
    });
}

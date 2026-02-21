import type { Command } from "commander";
import { createClient } from "../gateway/client.js";

function output(result: unknown): void {
  console.log(JSON.stringify(result));
}

function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
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
        const client = createClient();
        const result = await client.execute(`ls ${path}`);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command("cat")
    .description("Read file contents")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      try {
        const client = createClient();
        const result = await client.execute(`cat ${path}`);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command("write")
    .description("Write data to a file")
    .argument("<path>", "File path")
    .argument("<data>", "Data to write")
    .action(async (path: string, data: string) => {
      try {
        const client = createClient();
        const result = await client.execute(`write ${path} ${data}`);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command("rm")
    .description("Remove a file")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      try {
        const client = createClient();
        const result = await client.execute(`rm ${path}`);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command("grep")
    .description("Search file contents")
    .argument("<pattern>", "Search pattern")
    .argument("<path>", "File or directory path")
    .action(async (pattern: string, path: string) => {
      try {
        const client = createClient();
        const result = await client.execute(`grep ${pattern} ${path}`);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });
}

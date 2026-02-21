import type { Command } from "commander";
import {
  saveKey,
  getKey,
  listKeys,
  deleteKey,
} from "../credentials.js";
import { getAuthHint, DOMAIN_AUTH_HINTS } from "../keys/provider-map.js";

export function registerKeysCommand(program: Command): void {
  const keys = program
    .command("keys")
    .description("Manage API keys for authenticated services (BYOK)");

  keys
    .command("set <domain>")
    .description("Set an API key for a domain")
    .option("--token <value>", "API key / token value")
    .option("--sync", "Also upload to gateway (BYOK)")
    .action(async (domain: string, opts: { token?: string; sync?: boolean }) => {
      try {
        const hint = getAuthHint(domain);

        let tokenValue = opts.token;
        if (!tokenValue) {
          // Non-interactive: require --token flag
          const envHint = hint ? `(${hint.envVar})` : "";
          console.error(
            `Usage: nkmc keys set ${domain} --token <value> ${envHint}`,
          );
          if (hint?.guideUrl) {
            console.error(`  Get your key: ${hint.guideUrl}`);
          }
          process.exit(1);
        }

        // Build auth object based on the hint
        const auth = buildAuth(domain, tokenValue, hint);

        // Save locally
        await saveKey(domain, auth);
        console.log(`Key saved for ${domain}`);

        // Optionally sync to gateway
        if (opts.sync) {
          await syncToGateway(domain, auth);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });

  keys
    .command("list")
    .description("List all saved API keys")
    .option("--remote", "Also list keys stored on gateway")
    .action(async (opts: { remote?: boolean }) => {
      try {
        const localKeys = await listKeys();
        const domains = Object.keys(localKeys);

        if (domains.length === 0 && !opts.remote) {
          console.log("No keys stored. Use 'nkmc keys set <domain>' to add one.");
          return;
        }

        if (domains.length > 0) {
          console.log("Local keys:");
          for (const domain of domains) {
            const entry = localKeys[domain];
            const maskedAuth = maskAuth(entry.auth);
            console.log(`  ${domain}  ${maskedAuth}  (${entry.updatedAt})`);
          }
        }

        if (opts.remote) {
          try {
            const { createClient } = await import("../gateway/client.js");
            const client = await createClient();
            const { domains: remoteDomains } = await client.listByok();
            console.log("\nGateway BYOK keys:");
            if (remoteDomains.length === 0) {
              console.log("  (none)");
            } else {
              for (const d of remoteDomains) {
                console.log(`  ${d}`);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`\nCould not fetch remote keys: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });

  keys
    .command("remove <domain>")
    .description("Remove an API key for a domain")
    .option("--remote", "Also remove from gateway")
    .action(async (domain: string, opts: { remote?: boolean }) => {
      try {
        const removed = await deleteKey(domain);
        if (removed) {
          console.log(`Key removed for ${domain}`);
        } else {
          console.log(`No key found for ${domain}`);
        }

        if (opts.remote) {
          try {
            const { createClient } = await import("../gateway/client.js");
            const client = await createClient();
            await client.deleteByok(domain);
            console.log(`Gateway BYOK key removed for ${domain}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Could not remove remote key: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}

function buildAuth(
  domain: string,
  token: string,
  hint: ReturnType<typeof getAuthHint>,
): { type: string; token?: string; header?: string; key?: string } {
  if (hint?.authType === "api-key" && hint.headerName) {
    return { type: "api-key", header: hint.headerName, key: token };
  }
  return { type: "bearer", token };
}

function maskAuth(auth: {
  type: string;
  token?: string;
  key?: string;
}): string {
  const value = auth.token ?? auth.key ?? "";
  if (value.length <= 8) return `${auth.type}:****`;
  return `${auth.type}:${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function syncToGateway(
  domain: string,
  auth: { type: string; token?: string; header?: string; key?: string },
): Promise<void> {
  const { createClient } = await import("../gateway/client.js");
  const client = await createClient();
  await client.uploadByok(domain, auth);
  console.log(`Key synced to gateway for ${domain}`);
}

/** Try to load @shipkey/core backend for additional storage */
async function tryShipkeyBackend(): Promise<any | null> {
  try {
    const { getBackend } = await import("@shipkey/core");
    const backend = getBackend();
    return (await backend.isAvailable()) ? backend : null;
  } catch {
    return null;
  }
}

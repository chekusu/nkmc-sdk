import { createClient } from "../gateway/client.js";

export async function runProxy(tool: string, args: string[]): Promise<void> {
  const client = await createClient();
  const result = await client.proxyExec(tool, args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

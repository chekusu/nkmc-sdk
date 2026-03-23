import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { homedir } from "node:os";

export function runGatewayStart(opts: {
  port?: string;
  dataDir?: string;
}): void {
  const dataDir = opts.dataDir ?? resolve(homedir(), ".nkmc/server");
  const port = opts.port ?? "9090";

  const env = {
    ...process.env,
    NKMC_DATA_DIR: dataDir,
    NKMC_PORT: port,
  };

  console.log(`Starting nkmc gateway on port ${port}...`);
  console.log(`  Data directory: ${dataDir}`);

  const child = spawn("nkmc-server", [], {
    env,
    stdio: "inherit",
  });

  child.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error("nkmc-server not found. Install with: npm install -g @nkmc/server");
      process.exit(1);
    }
    console.error(`Gateway error: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

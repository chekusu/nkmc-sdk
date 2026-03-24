import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fork } from "node:child_process";

function pidFilePath(dataDir: string): string {
  return join(dataDir, "gateway.pid");
}

function resolveDataDir(dir?: string): string {
  return dir ?? resolve(homedir(), ".nkmc/server");
}

export async function runGatewayStart(opts: {
  port?: string;
  dataDir?: string;
  daemon?: boolean;
}): Promise<void> {
  const dataDir = resolveDataDir(opts.dataDir);
  const port = parseInt(opts.port ?? "9090", 10);

  // Check if already running
  const pidFile = pidFilePath(dataDir);
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    try {
      process.kill(pid, 0); // check if alive
      console.error(`Gateway already running (PID ${pid}). Use 'nkmc gateway stop' first.`);
      process.exit(1);
    } catch {
      // Stale PID file, remove it
      unlinkSync(pidFile);
    }
  }

  if (opts.daemon) {
    // Fork a detached child running this same file in --foreground mode
    const child = fork(
      process.argv[1],
      ["gateway", "start", "--port", String(port), "--data-dir", dataDir],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, NKMC_DATA_DIR: dataDir, NKMC_PORT: String(port) },
      },
    );
    child.unref();
    writeFileSync(pidFile, String(child.pid), "utf-8");
    console.log(`Gateway started in background (PID ${child.pid})`);
    console.log(`  Port: ${port}`);
    console.log(`  Data: ${dataDir}`);
    console.log(`  Stop: nkmc gateway stop`);
    return;
  }

  // Foreground mode: try to import @nkmc/server
  let startServer: (opts: any) => Promise<any>;
  let loadConfig: () => any;
  try {
    const serverMod = await import("@nkmc/server");
    startServer = serverMod.startServer;
    const configMod = await import("@nkmc/server/config");
    loadConfig = configMod.loadConfig;
  } catch {
    console.error("@nkmc/server not found.");
    console.error("Install with: npm install -g @nkmc/server");
    process.exit(1);
  }

  // Override config with CLI options
  const config = loadConfig();
  config.port = port;
  config.dataDir = dataDir;

  // Write PID file for this process
  writeFileSync(pidFile, String(process.pid), "utf-8");

  const handle = await startServer({ config });

  // Clean up on exit
  const cleanup = () => {
    try { unlinkSync(pidFile); } catch {}
    handle.close();
  };
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
}

export function runGatewayStop(opts: { dataDir?: string }): void {
  const dataDir = resolveDataDir(opts.dataDir);
  const pidFile = pidFilePath(dataDir);

  if (!existsSync(pidFile)) {
    console.log("No running gateway found.");
    return;
  }

  const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
  try {
    process.kill(pid, "SIGTERM");
    unlinkSync(pidFile);
    console.log(`Gateway stopped (PID ${pid})`);
  } catch {
    unlinkSync(pidFile);
    console.log("Gateway was not running (stale PID file removed).");
  }
}

export function runGatewayStatus(opts: { dataDir?: string }): void {
  const dataDir = resolveDataDir(opts.dataDir);
  const pidFile = pidFilePath(dataDir);

  if (!existsSync(pidFile)) {
    console.log("Gateway is not running.");
    return;
  }

  const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
  try {
    process.kill(pid, 0);
    console.log(`Gateway is running (PID ${pid})`);
    console.log(`  Data: ${dataDir}`);
  } catch {
    unlinkSync(pidFile);
    console.log("Gateway is not running (stale PID file cleaned up).");
  }
}

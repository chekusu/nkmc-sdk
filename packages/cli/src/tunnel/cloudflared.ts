import { existsSync, mkdirSync, createWriteStream, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform, arch } from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const CLOUDFLARED_VERSION = "2024.12.2";

function getBinDir(): string {
  const base = process.env.NKMC_HOME || join(homedir(), ".nkmc");
  const dir = join(base, "bin");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getBinaryName(): string {
  return platform() === "win32" ? "cloudflared.exe" : "cloudflared";
}

function getDownloadUrl(): string {
  const os = platform();
  const cpu = arch();

  let osName: string;
  let archName: string;

  if (os === "darwin") {
    osName = "darwin";
    archName = cpu === "arm64" ? "arm64" : "amd64";
  } else if (os === "linux") {
    osName = "linux";
    archName = cpu === "arm64" ? "arm64" : "amd64";
  } else if (os === "win32") {
    osName = "windows";
    archName = cpu === "x64" ? "amd64" : "386";
  } else {
    throw new Error(`Unsupported platform: ${os}`);
  }

  const ext = os === "win32" ? ".exe" : "";
  return `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-${osName}-${archName}${ext}`;
}

export function getCloudflaredPath(): string {
  return join(getBinDir(), getBinaryName());
}

export function isCloudflaredInstalled(): boolean {
  return existsSync(getCloudflaredPath());
}

export async function ensureCloudflared(): Promise<string> {
  const binPath = getCloudflaredPath();
  if (existsSync(binPath)) return binPath;

  const url = getDownloadUrl();
  console.log(`Downloading cloudflared...`);
  console.log(`  From: ${url}`);

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download cloudflared: ${res.status}`);
  }

  const readable = Readable.fromWeb(res.body as any);
  const ws = createWriteStream(binPath);
  await pipeline(readable, ws);

  chmodSync(binPath, 0o755);
  console.log(`  Saved to: ${binPath}`);
  return binPath;
}

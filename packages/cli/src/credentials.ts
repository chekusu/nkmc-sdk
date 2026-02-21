import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { chmod } from "node:fs/promises";

interface TokenEntry {
  publishToken: string;
  issuedAt: string;
  expiresAt: string;
}

interface AgentTokenEntry {
  token: string;
  gatewayUrl: string;
  issuedAt: string;
  expiresAt: string;
}

interface CredentialStore {
  tokens: Record<string, TokenEntry>;
  agentToken?: AgentTokenEntry;
}

function nkmcDir(): string {
  return process.env.NKMC_HOME || join(homedir(), ".nkmc");
}

function credentialsPath(): string {
  return join(nkmcDir(), "credentials.json");
}

export async function loadCredentials(): Promise<CredentialStore> {
  try {
    const raw = await readFile(credentialsPath(), "utf-8");
    return JSON.parse(raw) as CredentialStore;
  } catch {
    return { tokens: {} };
  }
}

export async function saveToken(
  domain: string,
  publishToken: string,
): Promise<void> {
  const creds = await loadCredentials();

  // Decode JWT payload to extract iat/exp
  const payloadB64 = publishToken.split(".")[1];
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf-8"),
  );

  creds.tokens[domain] = {
    publishToken,
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };

  const dir = nkmcDir();
  await mkdir(dir, { recursive: true });

  const filePath = credentialsPath();
  await writeFile(filePath, JSON.stringify(creds, null, 2) + "\n");
  await chmod(filePath, 0o600);
}

export async function saveAgentToken(
  gatewayUrl: string,
  token: string,
): Promise<void> {
  const creds = await loadCredentials();

  const payloadB64 = token.split(".")[1];
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf-8"),
  );

  creds.agentToken = {
    token,
    gatewayUrl,
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };

  const dir = nkmcDir();
  await mkdir(dir, { recursive: true });

  const filePath = credentialsPath();
  await writeFile(filePath, JSON.stringify(creds, null, 2) + "\n");
  await chmod(filePath, 0o600);
}

export async function getAgentToken(): Promise<AgentTokenEntry | null> {
  const creds = await loadCredentials();
  const entry = creds.agentToken;
  if (!entry) return null;

  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return entry;
}

export async function getToken(domain: string): Promise<string | null> {
  const creds = await loadCredentials();
  const entry = creds.tokens[domain];
  if (!entry) return null;

  // Check if expired
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return entry.publishToken;
}

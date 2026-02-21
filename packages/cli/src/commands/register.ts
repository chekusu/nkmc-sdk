import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getToken } from "../credentials.js";

export interface RegisterOptions {
  gatewayUrl: string;
  token: string;
  domain: string;
  skillMdPath?: string;
}

export async function registerService(options: RegisterOptions): Promise<void> {
  const { gatewayUrl, token, domain, skillMdPath } = options;

  const mdPath = skillMdPath ?? join(process.cwd(), ".well-known", "skill.md");
  const skillMd = await readFile(mdPath, "utf-8");

  if (!skillMd.trim()) {
    throw new Error(`skill.md is empty at ${mdPath}`);
  }

  const url = `${gatewayUrl.replace(/\/$/, "")}/registry/services?domain=${encodeURIComponent(domain)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/markdown",
    },
    body: skillMd,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registration failed (${res.status}): ${body}`);
  }

  const result = await res.json() as { ok: boolean; domain: string; name: string };
  console.log(`Registered ${result.name} as ${result.domain}`);
}

export async function resolveToken(options: {
  token?: string;
  adminToken?: string;
  domain?: string;
}): Promise<string> {
  // 1. --token flag
  if (options.token) return options.token;

  // 2. NKMC_PUBLISH_TOKEN env
  if (process.env.NKMC_PUBLISH_TOKEN) return process.env.NKMC_PUBLISH_TOKEN;

  // 3. ~/.nkmc/credentials.json (domain-scoped)
  if (options.domain) {
    const stored = await getToken(options.domain);
    if (stored) return stored;
  }

  // 4. --admin-token flag (deprecated)
  if (options.adminToken) {
    console.warn("Warning: --admin-token is deprecated. Use `nkmc claim` to obtain a publish token.");
    return options.adminToken;
  }

  // 5. NKMC_ADMIN_TOKEN env (backward compat)
  if (process.env.NKMC_ADMIN_TOKEN) {
    return process.env.NKMC_ADMIN_TOKEN;
  }

  throw new Error(
    "No auth token found. Use `nkmc claim <domain>` to obtain a publish token, or provide --token.",
  );
}

export async function runRegister(options: {
  gatewayUrl?: string;
  token?: string;
  adminToken?: string;
  domain?: string;
  dir?: string;
}): Promise<void> {
  const projectDir = options.dir ?? process.cwd();

  const gatewayUrl =
    options.gatewayUrl ?? process.env.NKMC_GATEWAY_URL;
  const domain = options.domain ?? process.env.NKMC_DOMAIN;

  if (!gatewayUrl) {
    throw new Error(
      "Gateway URL is required. Use --gateway-url or NKMC_GATEWAY_URL env var.",
    );
  }
  if (!domain) {
    throw new Error(
      "Domain is required. Use --domain or NKMC_DOMAIN env var.",
    );
  }

  const token = await resolveToken({
    token: options.token,
    adminToken: options.adminToken,
    domain,
  });

  await registerService({
    gatewayUrl,
    token,
    domain,
    skillMdPath: join(projectDir, ".well-known", "skill.md"),
  });
}

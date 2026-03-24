import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getToken, saveToken } from "../credentials.js";

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

export interface DiscoverOptions {
  gatewayUrl: string;
  token: string;
  url: string;
  domain?: string;
  specUrl?: string;
}

export async function discoverAndRegister(options: DiscoverOptions): Promise<void> {
  const { gatewayUrl, token, url, domain, specUrl } = options;

  const endpoint = `${gatewayUrl.replace(/\/$/, "")}/registry/services/discover`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, domain, specUrl }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" })) as any;
    if (body.probed) {
      console.error(`Could not find OpenAPI spec at ${url}`);
      console.error("Probed paths:");
      for (const p of body.probed) {
        console.error(`  ${p}`);
      }
      console.error("\nUse --spec-url to provide the spec location directly.");
      process.exit(1);
    }
    throw new Error(`Discovery failed (${res.status}): ${body.error ?? JSON.stringify(body)}`);
  }

  const result = await res.json() as { ok: boolean; domain: string; name: string; endpoints: number; source: string };
  console.log(`Discovered and registered ${result.name} as ${result.domain}`);
  console.log(`  Endpoints: ${result.endpoints}`);
  console.log(`  Source: ${result.source}`);
}

async function renewToken(
  gatewayUrl: string,
  domain: string,
): Promise<string | null> {
  const baseUrl = gatewayUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/domains/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publishToken?: string };
    if (!data.publishToken) return null;
    await saveToken(domain, data.publishToken);
    console.log(`Token renewed for ${domain}`);
    return data.publishToken;
  } catch {
    return null;
  }
}

export async function resolveToken(options: {
  token?: string;
  adminToken?: string;
  domain?: string;
  gatewayUrl?: string;
}): Promise<string> {
  if (options.token) return options.token;
  if (process.env.NKMC_PUBLISH_TOKEN) return process.env.NKMC_PUBLISH_TOKEN;

  if (options.domain) {
    const stored = await getToken(options.domain);
    if (stored) return stored;

    const gw = options.gatewayUrl ?? process.env.NKMC_GATEWAY_URL;
    if (gw) {
      const renewed = await renewToken(gw, options.domain);
      if (renewed) return renewed;
    }
  }

  if (options.adminToken) {
    console.warn("Warning: --admin-token is deprecated. Use `nkmc claim` to obtain a publish token.");
    return options.adminToken;
  }

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
  url?: string;
  specUrl?: string;
}): Promise<void> {
  const gatewayUrl =
    options.gatewayUrl ?? process.env.NKMC_GATEWAY_URL ?? "https://api.nkmc.ai";

  // URL-based discovery mode
  if (options.url) {
    let domain = options.domain;
    if (!domain) {
      try {
        domain = new URL(options.url).hostname;
      } catch {
        throw new Error("Invalid --url. Provide a valid URL like http://localhost:3000");
      }
    }

    const token = await resolveToken({
      token: options.token,
      adminToken: options.adminToken,
      domain,
      gatewayUrl,
    });

    await discoverAndRegister({
      gatewayUrl,
      token,
      url: options.url,
      domain,
      specUrl: options.specUrl,
    });
    return;
  }

  // Legacy skill.md mode
  const projectDir = options.dir ?? process.cwd();
  const domain = options.domain ?? process.env.NKMC_DOMAIN;
  if (!domain) {
    throw new Error(
      "Domain is required. Use --domain or NKMC_DOMAIN env var.",
    );
  }

  const token = await resolveToken({
    token: options.token,
    adminToken: options.adminToken,
    domain,
    gatewayUrl,
  });

  await registerService({
    gatewayUrl,
    token,
    domain,
    skillMdPath: join(projectDir, ".well-known", "skill.md"),
  });
}

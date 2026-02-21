import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface RegisterOptions {
  gatewayUrl: string;
  adminToken: string;
  domain: string;
  skillMdPath?: string;
}

export async function registerService(options: RegisterOptions): Promise<void> {
  const { gatewayUrl, adminToken, domain, skillMdPath } = options;

  const mdPath = skillMdPath ?? join(process.cwd(), ".well-known", "skill.md");
  const skillMd = await readFile(mdPath, "utf-8");

  if (!skillMd.trim()) {
    throw new Error(`skill.md is empty at ${mdPath}`);
  }

  const url = `${gatewayUrl.replace(/\/$/, "")}/registry/services?domain=${encodeURIComponent(domain)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
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

export async function runRegister(options: {
  gatewayUrl?: string;
  adminToken?: string;
  domain?: string;
  dir?: string;
}): Promise<void> {
  const projectDir = options.dir ?? process.cwd();

  const gatewayUrl =
    options.gatewayUrl ?? process.env.NKMC_GATEWAY_URL;
  const adminToken =
    options.adminToken ?? process.env.NKMC_ADMIN_TOKEN;
  const domain = options.domain ?? process.env.NKMC_DOMAIN;

  if (!gatewayUrl) {
    throw new Error(
      "Gateway URL is required. Use --gateway-url or NKMC_GATEWAY_URL env var.",
    );
  }
  if (!adminToken) {
    throw new Error(
      "Admin token is required. Use --admin-token or NKMC_ADMIN_TOKEN env var.",
    );
  }
  if (!domain) {
    throw new Error(
      "Domain is required. Use --domain or NKMC_DOMAIN env var.",
    );
  }

  await registerService({
    gatewayUrl,
    adminToken,
    domain,
    skillMdPath: join(projectDir, ".well-known", "skill.md"),
  });
}

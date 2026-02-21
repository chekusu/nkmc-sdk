import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateSkillMd } from "@nkmc/core";
import type { NkmcConfig, SkillDefinition, SchemaTable, ApiEndpoint } from "@nkmc/core";
import { detectFramework } from "../scanner/detect.js";
import { scanRoutes, type ScannedRoute } from "../scanner/routes.js";
import { scanPrismaSchema, type ScannedSchema } from "../scanner/schema.js";

export function buildSkillDefinition(
  config: NkmcConfig,
  routes: ScannedRoute[],
  schemas: ScannedSchema[]
): SkillDefinition {
  const api: ApiEndpoint[] = routes.map((route) => {
    const pricingKey = `${route.method} ${route.path}`;
    const pricing = config.pricing?.[pricingKey];

    return {
      method: route.method as ApiEndpoint["method"],
      path: route.path,
      role: "agent",
      description: route.description || `${route.method} ${route.path}`,
      ...(pricing ? { pricing } : {}),
    };
  });

  const schema: SchemaTable[] = schemas.map((s) => ({
    name: s.name,
    description: s.description || `${s.name} table`,
    read: "agent",
    write: "agent",
    fields: s.fields.map((f) => ({
      name: f.name,
      type: f.type,
      description: f.description || "",
    })),
  }));

  return {
    frontmatter: {
      name: config.name,
      gateway: "nkmc",
      version: config.version,
      roles: config.roles,
    },
    description: `${config.name} — powered by nkmc.`,
    schema,
    api,
  };
}

export interface GenerateOptions {
  register?: boolean;
  gatewayUrl?: string;
  adminToken?: string;
  domain?: string;
}

export async function runGenerate(projectDir: string, options?: GenerateOptions) {
  const detected = await detectFramework(projectDir);
  console.log(`Detected: ${detected.framework} + ${detected.orm}`);

  // Scan routes
  const routes = await scanRoutes(projectDir, detected.framework);
  console.log(`Found ${routes.length} routes`);

  // Scan schema
  let schemas: ScannedSchema[] = [];
  if (detected.orm === "prisma" && detected.ormSchemaPath) {
    schemas = await scanPrismaSchema(join(projectDir, detected.ormSchemaPath));
    console.log(`Found ${schemas.length} models`);
  }

  // Read project name from package.json
  const pkg = JSON.parse(await readFile(join(projectDir, "package.json"), "utf-8"));

  const config: NkmcConfig = {
    name: pkg.name || "my-service",
    version: "1.0",
    roles: ["agent"],
    framework: detected.framework,
    orm: detected.orm !== "none" ? detected.orm : undefined,
  };

  const skill = buildSkillDefinition(config, routes, schemas);
  const md = generateSkillMd(skill);

  // Write to .well-known/skill.md
  const outputDir = join(projectDir, ".well-known");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, "skill.md");
  await writeFile(outputPath, md);
  console.log(`Generated ${outputPath}`);

  // Auto-register if requested
  if (options?.register) {
    const { registerService } = await import("./register.js");
    const gatewayUrl =
      options.gatewayUrl ?? process.env.NKMC_GATEWAY_URL;
    const adminToken =
      options.adminToken ?? process.env.NKMC_ADMIN_TOKEN;
    const domain = options.domain ?? process.env.NKMC_DOMAIN;

    if (!gatewayUrl || !adminToken || !domain) {
      console.log(
        "Skipping registration: --gateway-url, --admin-token, and --domain are all required.",
      );
      return;
    }

    await registerService({
      gatewayUrl,
      adminToken,
      domain,
      skillMdPath: outputPath,
    });
  }
}

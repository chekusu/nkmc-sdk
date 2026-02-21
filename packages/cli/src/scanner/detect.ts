import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { detectFrameworkFromDeps } from "@nkmc/core/scanner";

export type Framework = "express" | "hono" | "nextjs" | "fastify" | "unknown";
export type ORM = "prisma" | "drizzle" | "none";

export interface DetectedProject {
  framework: Framework;
  orm: ORM;
  ormSchemaPath?: string;
}

// Map core's generic framework names to CLI's specific type
const FRAMEWORK_MAP: Record<string, Framework> = {
  hono: "hono",
  next: "nextjs",
  express: "express",
  fastify: "fastify",
};

export async function detectFramework(projectDir: string): Promise<DetectedProject> {
  const pkgPath = join(projectDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Detect framework using shared core function
  const detected = detectFrameworkFromDeps(allDeps);
  const framework: Framework = detected ? (FRAMEWORK_MAP[detected] ?? "unknown") : "unknown";

  // Detect ORM
  let orm: ORM = "none";
  let ormSchemaPath: string | undefined;

  if (allDeps["prisma"] || allDeps["@prisma/client"]) {
    const schemaPath = "prisma/schema.prisma";
    try {
      await access(join(projectDir, schemaPath));
      orm = "prisma";
      ormSchemaPath = schemaPath;
    } catch {
      orm = "prisma";
    }
  } else if (allDeps["drizzle-orm"]) {
    orm = "drizzle";
    try {
      await access(join(projectDir, "drizzle.config.ts"));
      ormSchemaPath = "drizzle.config.ts";
    } catch {
      // no config found
    }
  }

  return { framework, orm, ormSchemaPath };
}

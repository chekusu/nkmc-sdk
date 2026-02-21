import { describe, it, expect, afterEach } from "vitest";
import { generateConfig, runInit } from "../../src/commands/init.js";
import type { DetectedProject } from "../../src/scanner/detect.js";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("generateConfig", () => {
  it("should generate a valid nkmc.config.ts string", () => {
    const detected: DetectedProject = {
      framework: "express",
      orm: "prisma",
      ormSchemaPath: "prisma/schema.prisma",
    };

    const config = generateConfig({
      name: "my-service",
      version: "1.0",
      roles: ["agent"],
      detected,
    });

    expect(config).toContain('name: "my-service"');
    expect(config).toContain('framework: "express"');
    expect(config).toContain('orm: "prisma"');
    expect(config).toContain('schemaPath: "prisma/schema.prisma"');
    expect(config).toContain("defineConfig");
  });

  it("should handle project without ORM", () => {
    const detected: DetectedProject = {
      framework: "hono",
      orm: "none",
    };

    const config = generateConfig({
      name: "api-only",
      version: "1.0",
      roles: ["agent"],
      detected,
    });

    expect(config).toContain('framework: "hono"');
    expect(config).not.toContain("orm:");
    expect(config).not.toContain("schemaPath:");
  });
});

describe("runInit", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("should detect framework and write nkmc.config.ts", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-init-"));
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: { hono: "^4.0.0" },
      }),
    );

    await runInit(tempDir);

    const config = await readFile(join(tempDir, "nkmc.config.ts"), "utf-8");
    expect(config).toContain('name: "test-app"');
    expect(config).toContain('framework: "hono"');
    expect(config).toContain("defineConfig");
  });

  it("should detect ORM and include in config", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-init-"));
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "prisma-app",
        dependencies: { express: "^4.0.0" },
        devDependencies: { prisma: "^6.0.0" },
      }),
    );

    // Create actual prisma schema so detectFramework finds the path
    const prismaDir = join(tempDir, "prisma");
    await mkdir(prismaDir, { recursive: true });
    await writeFile(join(prismaDir, "schema.prisma"), "model User { id Int @id }");

    await runInit(tempDir);

    const config = await readFile(join(tempDir, "nkmc.config.ts"), "utf-8");
    expect(config).toContain('orm: "prisma"');
    expect(config).toContain('schemaPath: "prisma/schema.prisma"');
  });

  it("should fallback to 'my-service' if package has no name", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-init-"));
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { hono: "^4.0.0" } }),
    );

    await runInit(tempDir);

    const config = await readFile(join(tempDir, "nkmc.config.ts"), "utf-8");
    expect(config).toContain('name: "my-service"');
  });
});

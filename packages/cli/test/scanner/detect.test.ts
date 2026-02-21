import { describe, it, expect, afterEach } from "vitest";
import { detectFramework } from "../../src/scanner/detect.js";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("detectFramework", () => {
  let tempDir: string;

  async function setup(pkg: Record<string, unknown>, files?: Record<string, string>) {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-test-"));
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2));
    if (files) {
      for (const [path, content] of Object.entries(files)) {
        const fullPath = join(tempDir, path);
        await mkdir(join(fullPath, ".."), { recursive: true });
        await writeFile(fullPath, content);
      }
    }
  }

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true });
  });

  it("should detect Express", async () => {
    await setup({ dependencies: { express: "^4.0.0" } });
    const result = await detectFramework(tempDir);
    expect(result.framework).toBe("express");
  });

  it("should detect Hono", async () => {
    await setup({ dependencies: { hono: "^4.0.0" } });
    const result = await detectFramework(tempDir);
    expect(result.framework).toBe("hono");
  });

  it("should detect Next.js", async () => {
    await setup({ dependencies: { next: "^15.0.0" } });
    const result = await detectFramework(tempDir);
    expect(result.framework).toBe("nextjs");
  });

  it("should detect Fastify", async () => {
    await setup({ dependencies: { fastify: "^5.0.0" } });
    const result = await detectFramework(tempDir);
    expect(result.framework).toBe("fastify");
  });

  it("should detect Prisma ORM", async () => {
    await setup(
      { dependencies: { express: "^4.0.0" }, devDependencies: { prisma: "^6.0.0" } },
      { "prisma/schema.prisma": "generator client {}" }
    );
    const result = await detectFramework(tempDir);
    expect(result.orm).toBe("prisma");
    expect(result.ormSchemaPath).toBe("prisma/schema.prisma");
  });

  it("should detect Drizzle ORM", async () => {
    await setup(
      { dependencies: { express: "^4.0.0", "drizzle-orm": "^0.38.0" } },
      { "drizzle.config.ts": "export default {}" }
    );
    const result = await detectFramework(tempDir);
    expect(result.orm).toBe("drizzle");
  });

  it("should return unknown for unrecognized project", async () => {
    await setup({ dependencies: {} });
    const result = await detectFramework(tempDir);
    expect(result.framework).toBe("unknown");
  });
});

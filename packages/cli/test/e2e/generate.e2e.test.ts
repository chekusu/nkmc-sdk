// packages/cli/test/e2e/generate.e2e.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectFramework } from "../../src/scanner/detect.js";
import { scanRoutes } from "../../src/scanner/routes.js";
import { scanPrismaSchema } from "../../src/scanner/schema.js";
import { buildSkillDefinition } from "../../src/commands/generate.js";
import { generateSkillMd } from "@nkmc/core";

describe("E2E: Full scan → skill.md generation", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true });
  });

  it("should generate skill.md for an Express + Prisma project", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-e2e-"));

    // Setup fake Express + Prisma project
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "acme-store",
        dependencies: { express: "^4.0.0" },
        devDependencies: { prisma: "^6.0.0" },
      })
    );

    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(
      join(tempDir, "src/routes.ts"),
      `
      import { Router } from "express";
      const router = Router();
      /** List all products */
      router.get("/api/products", getProducts);
      /** Create a new order */
      router.post("/api/orders", createOrder);
      export default router;
      `
    );

    await mkdir(join(tempDir, "prisma"), { recursive: true });
    await writeFile(
      join(tempDir, "prisma/schema.prisma"),
      `
      /// Product catalog
      model Product {
        /// Unique product identifier
        id    String @id @default(uuid())
        /// Product display name
        name  String
        /// Price in USDC
        price Float
      }
      `
    );

    // Run the full pipeline
    const detected = await detectFramework(tempDir);
    expect(detected.framework).toBe("express");
    expect(detected.orm).toBe("prisma");

    const routes = await scanRoutes(tempDir, detected.framework);
    expect(routes.length).toBeGreaterThanOrEqual(2);

    const schemas = await scanPrismaSchema(join(tempDir, detected.ormSchemaPath!));
    expect(schemas.length).toBeGreaterThanOrEqual(1);

    const config = {
      name: "Acme Store",
      version: "1.0",
      roles: ["agent", "premium"],
      framework: detected.framework,
      pricing: {
        "POST /api/orders": { cost: 0.05, token: "USDC" },
      },
    };

    const skill = buildSkillDefinition(config, routes, schemas);
    const md = generateSkillMd(skill);

    // Verify output
    expect(md).toContain("---");
    expect(md).toContain("name: Acme Store");
    expect(md).toContain("gateway: nkmc");
    expect(md).toContain("## Schema");
    expect(md).toContain("Product");
    expect(md).toContain("## API");
    expect(md).toContain("/api/products");
    expect(md).toContain("/api/orders");
    expect(md).toContain("0.05 USDC");
    expect(md).toContain("List all products");
  });

  it("should generate skill.md for a Hono project without ORM", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-e2e-"));

    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "hono-api",
        dependencies: { hono: "^4.0.0" },
      })
    );

    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(
      join(tempDir, "src/index.ts"),
      `
      import { Hono } from "hono";
      const app = new Hono();
      /** Get server health status */
      app.get("/api/health", (c) => c.json({ status: "ok" }));
      app.post("/api/data", (c) => c.json({}));
      export default app;
      `
    );

    const detected = await detectFramework(tempDir);
    expect(detected.framework).toBe("hono");
    expect(detected.orm).toBe("none");

    const routes = await scanRoutes(tempDir, detected.framework);
    expect(routes.length).toBeGreaterThanOrEqual(2);

    const config = {
      name: "Hono API",
      version: "1.0",
      roles: ["agent"],
      framework: detected.framework,
    };

    const skill = buildSkillDefinition(config, routes, []);
    const md = generateSkillMd(skill);

    expect(md).toContain("name: Hono API");
    expect(md).toContain("/api/health");
    expect(md).toContain("Get server health status");
    expect(md).not.toContain("## Schema");
  });
});

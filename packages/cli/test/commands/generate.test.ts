import { describe, it, expect, afterEach } from "vitest";
import { buildSkillDefinition, runGenerate } from "../../src/commands/generate.js";
import type { ScannedRoute } from "../../src/scanner/routes.js";
import type { ScannedSchema } from "../../src/scanner/schema.js";
import type { NkmcConfig } from "@nkmc/core";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("buildSkillDefinition", () => {
  it("should build SkillDefinition from scanned data", () => {
    const config: NkmcConfig = {
      name: "Test Service",
      version: "1.0",
      roles: ["agent"],
      framework: "express",
      pricing: {
        "POST /api/orders": { cost: 0.05, token: "USDC" },
      },
    };

    const routes: ScannedRoute[] = [
      { method: "GET", path: "/api/products", filePath: "src/routes.ts", description: "List products" },
      { method: "POST", path: "/api/orders", filePath: "src/routes.ts", description: "Create order" },
    ];

    const schemas: ScannedSchema[] = [
      {
        name: "Product",
        description: "Product catalog",
        fields: [
          { name: "id", type: "String", description: "Product ID" },
          { name: "name", type: "String", description: "Product name" },
        ],
      },
    ];

    const skill = buildSkillDefinition(config, routes, schemas);

    expect(skill.frontmatter.name).toBe("Test Service");
    expect(skill.api).toHaveLength(2);
    expect(skill.schema).toHaveLength(1);

    // Pricing should be applied
    const orderEndpoint = skill.api.find((a) => a.path === "/api/orders");
    expect(orderEndpoint!.pricing).toEqual({ cost: 0.05, token: "USDC" });

    // Non-priced endpoint should have no pricing
    const productEndpoint = skill.api.find((a) => a.path === "/api/products");
    expect(productEndpoint!.pricing).toBeUndefined();
  });

  it("should handle empty routes and schemas", () => {
    const config: NkmcConfig = {
      name: "Empty",
      version: "1.0",
      roles: ["agent"],
      framework: "hono",
    };

    const skill = buildSkillDefinition(config, [], []);
    expect(skill.api).toHaveLength(0);
    expect(skill.schema).toHaveLength(0);
    expect(skill.frontmatter.name).toBe("Empty");
  });

  it("should use route description or fallback to method+path", () => {
    const config: NkmcConfig = {
      name: "Test",
      version: "1.0",
      roles: ["agent"],
      framework: "express",
    };

    const routes: ScannedRoute[] = [
      { method: "GET", path: "/api/test", filePath: "src/routes.ts" },
    ];

    const skill = buildSkillDefinition(config, routes, []);
    expect(skill.api[0].description).toBe("GET /api/test");
  });
});

describe("runGenerate", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("should scan project and write .well-known/skill.md", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-gen-"));

    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "gen-test",
        dependencies: { hono: "^4.0.0" },
      }),
    );

    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(
      join(tempDir, "src/index.ts"),
      `
      import { Hono } from "hono";
      const app = new Hono();
      /** Health check */
      app.get("/health", (c) => c.json({ ok: true }));
      app.post("/api/data", (c) => c.json({}));
      export default app;
      `,
    );

    await runGenerate(tempDir);

    const md = await readFile(join(tempDir, ".well-known", "skill.md"), "utf-8");
    expect(md).toContain("name: gen-test");
    expect(md).toContain("gateway: nkmc");
    expect(md).toContain("/health");
    expect(md).toContain("/api/data");
    expect(md).toContain("Health check");
  });

  it("should use package name as skill name", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-gen-"));

    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "@my-org/cool-api",
        dependencies: { express: "^4.0.0" },
      }),
    );

    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(
      join(tempDir, "src/routes.ts"),
      `
      const router = require("express").Router();
      router.get("/api/items", handler);
      `,
    );

    await runGenerate(tempDir);

    const md = await readFile(join(tempDir, ".well-known", "skill.md"), "utf-8");
    expect(md).toContain('name: "@my-org/cool-api"');
  });
});

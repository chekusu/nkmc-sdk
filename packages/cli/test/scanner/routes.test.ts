import { describe, it, expect, afterEach } from "vitest";
import { scanRoutes } from "../../src/scanner/routes.js";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("scanRoutes", () => {
  let tempDir: string;

  async function setup(files: Record<string, string>) {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-routes-"));
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(tempDir, path);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, content);
    }
  }

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true });
  });

  it("should scan Express-style routes", async () => {
    await setup({
      "src/routes.ts": `
        import { Router } from "express";
        const router = Router();
        router.get("/api/products", getProducts);
        router.post("/api/orders", createOrder);
        export default router;
      `,
    });
    const routes = await scanRoutes(tempDir, "express");
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/products" })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "POST", path: "/api/orders" })
    );
  });

  it("should scan Hono-style routes", async () => {
    await setup({
      "src/index.ts": `
        import { Hono } from "hono";
        const app = new Hono();
        app.get("/api/items", (c) => c.json([]));
        app.post("/api/items", (c) => c.json({}));
        export default app;
      `,
    });
    const routes = await scanRoutes(tempDir, "hono");
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/items" })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "POST", path: "/api/items" })
    );
  });

  it("should scan Next.js App Router routes", async () => {
    await setup({
      "app/api/users/route.ts": `
        export async function GET(request: Request) {
          return Response.json([]);
        }
        export async function POST(request: Request) {
          return Response.json({});
        }
      `,
    });
    const routes = await scanRoutes(tempDir, "nextjs");
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/users" })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "POST", path: "/api/users" })
    );
  });

  it("should extract JSDoc descriptions", async () => {
    await setup({
      "src/routes.ts": `
        import { Hono } from "hono";
        const app = new Hono();
        /** List all available products */
        app.get("/api/products", (c) => c.json([]));
        export default app;
      `,
    });
    const routes = await scanRoutes(tempDir, "hono");
    expect(routes[0].description).toBe("List all available products");
  });

  it("should return empty for no routes found", async () => {
    await setup({
      "src/utils.ts": `export function add(a: number, b: number) { return a + b; }`,
    });
    const routes = await scanRoutes(tempDir, "express");
    expect(routes).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { detectFramework } from "../../src/scanner/detect.js";
import { scanRoutes } from "../../src/scanner/routes.js";

const CODES = join(homedir(), "Codes");

/**
 * E2E tests that scan real local projects.
 * These validate the scanner against actual codebases rather than
 * synthetic fixtures, catching issues like .wrangler false positives.
 *
 * Tests are skipped if the project directory doesn't exist on the machine.
 */

describe.skipIf(!existsSync(join(CODES, "shipcast")))("E2E: shipcast (Hono)", () => {
  const projectDir = join(CODES, "shipcast");

  it("should detect hono framework", async () => {
    const detected = await detectFramework(projectDir);
    expect(detected.framework).toBe("hono");
  });

  it("should find expected number of routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    // shipcast has ~29 routes; allow small variance for ongoing development
    expect(routes.length).toBeGreaterThanOrEqual(20);
    expect(routes.length).toBeLessThan(60);
  });

  it("should find core routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    const paths = routes.map((r) => `${r.method} ${r.path}`);

    expect(paths).toContain("GET /health");
    expect(paths).toContain("GET /api/images/*");
  });

  it("should not include non-route strings", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    for (const route of routes) {
      expect(route.path).toMatch(/^\//);
    }
  });

  it("should not scan .wrangler build artifacts", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    for (const route of routes) {
      expect(route.filePath).not.toContain(".wrangler");
    }
  });
});

describe.skipIf(!existsSync(join(CODES, "nakamichi/packages/gateway")))("E2E: nakamichi gateway (Hono)", () => {
  const projectDir = join(CODES, "nakamichi/packages/gateway");

  it("should detect hono framework", async () => {
    const detected = await detectFramework(projectDir);
    expect(detected.framework).toBe("hono");
  });

  it("should find expected number of routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    expect(routes.length).toBeGreaterThanOrEqual(25);
    expect(routes.length).toBeLessThan(80);
  });

  it("should find core gateway routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    const paths = routes.map((r) => `${r.method} ${r.path}`);

    expect(paths).toContain("GET /.well-known/jwks.json");
    expect(paths).toContain("POST /token");
  });

  it("should only contain files from src/", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    for (const route of routes) {
      expect(route.filePath).toMatch(/^src\//);
    }
  });
});

describe.skipIf(!existsSync(join(CODES, "chatben/apps/api")))("E2E: chatben api (Hono + Drizzle)", () => {
  const projectDir = join(CODES, "chatben/apps/api");

  it("should detect hono framework with drizzle ORM", async () => {
    const detected = await detectFramework(projectDir);
    expect(detected.framework).toBe("hono");
    expect(detected.orm).toBe("drizzle");
  });

  it("should find expected number of routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    expect(routes.length).toBeGreaterThanOrEqual(60);
    expect(routes.length).toBeLessThan(150);
  });

  it("should find core routes", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    const paths = routes.map((r) => `${r.method} ${r.path}`);

    expect(paths).toContain("GET /health");
  });

  it("should have all routes starting with /", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    for (const route of routes) {
      expect(route.path).toMatch(/^\//);
    }
  });

  it("should not scan node_modules or build directories", async () => {
    const routes = await scanRoutes(projectDir, "hono");
    for (const route of routes) {
      expect(route.filePath).not.toMatch(/node_modules|\.wrangler|dist|build/);
    }
  });
});

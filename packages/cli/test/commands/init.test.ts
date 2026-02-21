import { describe, it, expect } from "vitest";
import { generateConfig } from "../../src/commands/init.js";
import type { DetectedProject } from "../../src/scanner/detect.js";

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

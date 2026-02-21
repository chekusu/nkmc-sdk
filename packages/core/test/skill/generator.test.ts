import { describe, it, expect } from "vitest";
import { generateSkillMd } from "@nkmc/core";
import type { SkillDefinition } from "@nkmc/core";

describe("generateSkillMd", () => {
  const fullSkill: SkillDefinition = {
    frontmatter: {
      name: "Acme Store",
      gateway: "nkmc",
      version: "1.0",
      roles: ["agent", "premium"],
    },
    description: "An online store service for agents to browse and purchase products.",
    schema: [
      {
        name: "products",
        description: "Product catalog. Price is in USDC.",
        read: "public",
        write: "premium",
        fields: [
          { name: "id", type: "string", description: "Unique product ID" },
          { name: "name", type: "string", description: "Product name" },
          { name: "price", type: "number", description: "Price in USDC" },
        ],
      },
    ],
    api: [
      {
        method: "POST",
        path: "/api/checkout",
        role: "agent",
        pricing: { cost: 0.05, token: "USDC" },
        description: "Checkout the shopping cart and create an order.",
        input: { cart_id: "string" },
        output: { order_id: "string", total: "number" },
        notes: "Same cart_id cannot be checked out twice. Returns 400 on duplicate.",
        examples: {
          request: { cart_id: "cart_abc123" },
          response: { order_id: "ord_xyz", total: 12.5 },
        },
      },
    ],
  };

  it("should generate valid YAML frontmatter", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("name: Acme Store");
    expect(md).toContain("gateway: nkmc");
    expect(md).toContain('version: "1.0"');
  });

  it("should include service description", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toContain("# Acme Store");
    expect(md).toContain("An online store service for agents");
  });

  it("should generate schema section with table and fields", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toContain("## Schema");
    expect(md).toContain("### products");
    expect(md).toContain("读: public / 写: premium");
    expect(md).toContain("Product catalog. Price is in USDC.");
    expect(md).toContain("| id | string | Unique product ID |");
  });

  it("should generate API section with endpoints", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toContain("## API");
    expect(md).toContain("### Checkout the shopping cart and create an order");
    expect(md).toContain("`POST /api/checkout`");
    expect(md).toContain("0.05 USDC");
    expect(md).toContain("agent");
  });

  it("should include examples when provided", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toContain("cart_abc123");
    expect(md).toContain("ord_xyz");
  });

  it("should include notes when provided", () => {
    const md = generateSkillMd(fullSkill);
    expect(md).toContain("Same cart_id cannot be checked out twice");
  });

  it("should handle empty schema and api", () => {
    const minimal: SkillDefinition = {
      frontmatter: {
        name: "Empty Service",
        gateway: "nkmc",
        version: "1.0",
        roles: ["agent"],
      },
      description: "A service with no endpoints yet.",
      schema: [],
      api: [],
    };
    const md = generateSkillMd(minimal);
    expect(md).toContain("# Empty Service");
    expect(md).not.toContain("## Schema");
    expect(md).not.toContain("## API");
  });

  it("should handle API endpoint without pricing (free)", () => {
    const free: SkillDefinition = {
      frontmatter: {
        name: "Free Service",
        gateway: "nkmc",
        version: "1.0",
        roles: ["agent"],
      },
      description: "All free.",
      schema: [],
      api: [
        {
          method: "GET",
          path: "/api/health",
          role: "public",
          description: "Health check endpoint.",
        },
      ],
    };
    const md = generateSkillMd(free);
    expect(md).toContain("`GET /api/health`");
    expect(md).toContain("免费");
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { scanPrismaSchema } from "../../src/scanner/schema.js";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("scanPrismaSchema", () => {
  let tempDir: string;

  async function setupSchema(content: string): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "nkmc-schema-"));
    await mkdir(join(tempDir, "prisma"), { recursive: true });
    const schemaPath = join(tempDir, "prisma/schema.prisma");
    await writeFile(schemaPath, content);
    return schemaPath;
  }

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true });
  });

  it("should parse Prisma models into schema format", async () => {
    const path = await setupSchema(`
      model Product {
        id    String @id @default(uuid())
        name  String
        price Float
        stock Int
      }

      model Order {
        id        String @id @default(uuid())
        productId String
        quantity  Int
        status    String @default("pending")
      }
    `);

    const tables = await scanPrismaSchema(path);
    expect(tables).toHaveLength(2);

    const product = tables.find((t) => t.name === "Product");
    expect(product).toBeDefined();
    expect(product!.fields).toContainEqual(
      expect.objectContaining({ name: "id", type: "String" })
    );
    expect(product!.fields).toContainEqual(
      expect.objectContaining({ name: "price", type: "Float" })
    );

    const order = tables.find((t) => t.name === "Order");
    expect(order).toBeDefined();
    expect(order!.fields).toHaveLength(4);
  });

  it("should extract field comments as descriptions", async () => {
    const path = await setupSchema(`
      model User {
        /// Unique user identifier
        id    String @id
        /// User's display name
        name  String
        email String @unique
      }
    `);

    const tables = await scanPrismaSchema(path);
    const user = tables[0];
    const idField = user.fields.find((f) => f.name === "id");
    expect(idField!.description).toBe("Unique user identifier");

    const nameField = user.fields.find((f) => f.name === "name");
    expect(nameField!.description).toBe("User's display name");
  });

  it("should extract model comments as table descriptions", async () => {
    const path = await setupSchema(`
      /// Product catalog for the store
      model Product {
        id   String @id
        name String
      }
    `);

    const tables = await scanPrismaSchema(path);
    expect(tables[0].description).toBe("Product catalog for the store");
  });

  it("should handle empty schema", async () => {
    const path = await setupSchema(`
      generator client {
        provider = "prisma-client-js"
      }
    `);

    const tables = await scanPrismaSchema(path);
    expect(tables).toHaveLength(0);
  });
});

import { readFile } from "node:fs/promises";
import { getSchema } from "@mrleebo/prisma-ast";

export interface ScannedSchemaField {
  name: string;
  type: string;
  description: string;
}

export interface ScannedSchema {
  name: string;
  description: string;
  fields: ScannedSchemaField[];
}

export async function scanPrismaSchema(schemaPath: string): Promise<ScannedSchema[]> {
  const content = await readFile(schemaPath, "utf-8");
  const ast = getSchema(content);
  const tables: ScannedSchema[] = [];

  // Model-level comments appear as top-level Comment nodes BEFORE the model
  // in schema.list, not inside the model's properties.
  let pendingTopComment = "";

  for (const block of ast.list) {
    if (block.type === "comment") {
      pendingTopComment = block.text.replace(/^\/\/\/?\s*/, "").trim();
      continue;
    }

    if (block.type !== "model") {
      pendingTopComment = "";
      continue;
    }

    const fields: ScannedSchemaField[] = [];
    let prevComment = "";

    for (const prop of block.properties) {
      if (prop.type === "comment") {
        prevComment = (prop.text || "").replace(/^\/\/\/?\s*/, "").trim();
        continue;
      }

      if (prop.type === "field") {
        fields.push({
          name: prop.name,
          type: typeof prop.fieldType === "string" ? prop.fieldType : String(prop.fieldType),
          description: prevComment,
        });
        prevComment = "";
        continue;
      }

      // Reset comment for non-field, non-comment, non-break properties
      if (prop.type !== "break") {
        prevComment = "";
      }
    }

    tables.push({
      name: block.name,
      description: pendingTopComment,
      fields,
    });

    pendingTopComment = "";
  }

  return tables;
}

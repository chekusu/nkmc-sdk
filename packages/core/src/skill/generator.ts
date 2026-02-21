import { stringify } from "yaml";
import type { SkillDefinition, ApiEndpoint } from "../types.js";

export function generateSkillMd(skill: SkillDefinition): string {
  const sections: string[] = [];

  // YAML frontmatter
  const frontmatter = stringify(skill.frontmatter).trim();
  sections.push(`---\n${frontmatter}\n---`);

  // Title + description
  sections.push(`# ${skill.frontmatter.name}\n\n${skill.description}`);

  // Schema section
  if (skill.schema.length > 0) {
    const schemaLines: string[] = ["## Schema"];
    for (const table of skill.schema) {
      schemaLines.push(`\n### ${table.name} (读: ${table.read} / 写: ${table.write})`);
      schemaLines.push(`\n${table.description}`);
      schemaLines.push("");
      schemaLines.push("| field | type | description |");
      schemaLines.push("|-------|------|-------------|");
      for (const field of table.fields) {
        schemaLines.push(`| ${field.name} | ${field.type} | ${field.description} |`);
      }
    }
    sections.push(schemaLines.join("\n"));
  }

  // API section
  if (skill.api.length > 0) {
    const apiLines: string[] = ["## API"];
    for (const endpoint of skill.api) {
      apiLines.push(`\n### ${endpoint.description}`);
      const cost = formatCost(endpoint);
      apiLines.push(`\n\`${endpoint.method} ${endpoint.path}\` — ${cost}，${endpoint.role}`);

      if (endpoint.examples?.request) {
        apiLines.push("\n**请求示例：**");
        apiLines.push("```json");
        apiLines.push(JSON.stringify(endpoint.examples.request, null, 2));
        apiLines.push("```");
      }

      if (endpoint.examples?.response) {
        apiLines.push("\n**响应示例：**");
        apiLines.push("```json");
        apiLines.push(JSON.stringify(endpoint.examples.response, null, 2));
        apiLines.push("```");
      }

      if (endpoint.notes) {
        apiLines.push(`\n**注意：** ${endpoint.notes}`);
      }
    }
    sections.push(apiLines.join("\n"));
  }

  return sections.join("\n\n") + "\n";
}

function formatCost(endpoint: ApiEndpoint): string {
  if (!endpoint.pricing) return "免费";
  return `${endpoint.pricing.cost} ${endpoint.pricing.token} / 次`;
}

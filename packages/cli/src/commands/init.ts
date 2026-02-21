import { detectFramework, type DetectedProject } from "../scanner/detect.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface InitOptions {
  name: string;
  version: string;
  roles: string[];
  detected: DetectedProject;
}

export function generateConfig(options: InitOptions): string {
  const { name, version, roles, detected } = options;
  const rolesStr = roles.map((r) => `"${r}"`).join(", ");

  const lines: string[] = [
    `import { defineConfig } from "@nkmc/core";`,
    ``,
    `export default defineConfig({`,
    `  name: "${name}",`,
    `  version: "${version}",`,
    `  roles: [${rolesStr}],`,
    `  framework: "${detected.framework}",`,
  ];

  if (detected.orm !== "none") {
    lines.push(`  orm: "${detected.orm}",`);
    if (detected.ormSchemaPath) {
      lines.push(`  schemaPath: "${detected.ormSchemaPath}",`);
    }
  }

  lines.push(
    `  pricing: {`,
    `    // "POST /api/example": { cost: 0.01, token: "USDC" },`,
    `  },`,
    `});`,
    ``
  );

  return lines.join("\n");
}

export async function runInit(projectDir: string) {
  const detected = await detectFramework(projectDir);

  console.log(`Detected framework: ${detected.framework}`);
  console.log(`Detected ORM: ${detected.orm}`);

  const pkgPath = join(projectDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const name = pkg.name || "my-service";

  const config = generateConfig({
    name,
    version: "1.0",
    roles: ["agent"],
    detected,
  });

  const configPath = join(projectDir, "nkmc.config.ts");
  await writeFile(configPath, config);
  console.log(`Created ${configPath}`);
}

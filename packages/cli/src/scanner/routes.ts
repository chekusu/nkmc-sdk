import { Project, SyntaxKind, type CallExpression } from "ts-morph";
import { join, relative, dirname } from "node:path";
import { readdir } from "node:fs/promises";
import type { Framework } from "./detect.js";

export interface ScannedRoute {
  method: string;
  path: string;
  filePath: string;
  description?: string;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

export async function scanRoutes(
  projectDir: string,
  framework: Framework
): Promise<ScannedRoute[]> {
  if (framework === "nextjs") {
    return scanNextjsRoutes(projectDir);
  }
  return scanCodeRoutes(projectDir);
}

async function scanCodeRoutes(projectDir: string): Promise<ScannedRoute[]> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const srcFiles = await findTsFiles(projectDir);

  for (const filePath of srcFiles) {
    project.addSourceFileAtPath(filePath);
  }

  const routes: ScannedRoute[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const route = extractRouteFromCall(call, projectDir);
      if (route) routes.push(route);
    }
  }

  return routes;
}

function extractRouteFromCall(
  call: CallExpression,
  projectDir: string
): ScannedRoute | null {
  const expr = call.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return null;

  const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
  if (!propAccess) return null;

  const methodName = propAccess.getName().toLowerCase();
  if (!HTTP_METHODS.has(methodName)) return null;

  const args = call.getArguments();
  if (args.length < 1) return null;

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.StringLiteral) return null;

  const path = firstArg.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
  if (!path || !path.startsWith("/")) return null;

  const description = extractLeadingComment(call);
  const filePath = relative(projectDir, call.getSourceFile().getFilePath());

  return {
    method: methodName.toUpperCase(),
    path,
    filePath,
    description,
  };
}

function extractLeadingComment(call: CallExpression): string | undefined {
  const statement = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) return undefined;

  const leadingComments = statement.getLeadingCommentRanges();
  if (leadingComments.length === 0) return undefined;

  const comment = leadingComments[leadingComments.length - 1].getText();

  // Parse JSDoc: /** ... */
  const match = comment.match(/\/\*\*\s*(.*?)\s*\*\//s);
  if (match) return match[1].replace(/\s*\*\s*/g, " ").trim();

  // Parse single-line: // ...
  const singleMatch = comment.match(/\/\/\s*(.*)/);
  if (singleMatch) return singleMatch[1].trim();

  return undefined;
}

async function scanNextjsRoutes(projectDir: string): Promise<ScannedRoute[]> {
  const routes: ScannedRoute[] = [];
  const project = new Project({ skipAddingFilesFromTsConfig: true });

  const routeFiles = await findFiles(projectDir, /\broute\.(ts|js)$/);

  for (const filePath of routeFiles) {
    const relPath = relative(projectDir, filePath);
    const urlPath = "/" + dirname(relPath).replace(/^app\//, "");

    const sourceFile = project.addSourceFileAtPath(filePath);

    for (const fn of sourceFile.getFunctions()) {
      if (!fn.isExported()) continue;
      const name = fn.getName()?.toUpperCase();
      if (name && HTTP_METHODS.has(name.toLowerCase())) {
        const jsDocs = fn.getJsDocs();
        const description = jsDocs.length > 0 ? jsDocs[0].getDescription().trim() : undefined;
        routes.push({
          method: name,
          path: urlPath,
          filePath: relPath,
          description: description || undefined,
        });
      }
    }
  }

  return routes;
}

async function findTsFiles(dir: string): Promise<string[]> {
  return findFiles(dir, /\.(ts|tsx|js|jsx)$/);
}

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const results: string[] = [];
  const SKIP = new Set(["node_modules", ".next", "dist", "build", ".git", ".wrangler", ".output", ".nuxt", ".svelte-kit", ".vercel"]);

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

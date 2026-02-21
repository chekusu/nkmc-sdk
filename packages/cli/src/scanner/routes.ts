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

// --- Mount chain resolution for Hono/Express routers ---

interface MountCall {
  parentVar: string;
  mountPath: string;
  childVar: string;
  childSourceFile: string | null; // resolved absolute path if imported, null if local
  inFile: string; // file where this .route() call is located
}

/**
 * Extract all .route(path, router) calls to build a mount graph.
 */
function extractMountCalls(project: Project): MountCall[] {
  const mounts: MountCall[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const fileDir = dirname(filePath);

    // Build import map: localVarName -> resolved absolute file path
    const importMap = new Map<string, string>();
    for (const imp of sourceFile.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      const resolved = resolveModulePath(project, fileDir, specifier);
      if (!resolved) continue;

      for (const named of imp.getNamedImports()) {
        const localName = named.getAliasNode()?.getText() || named.getName();
        importMap.set(localName, resolved);
      }
      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        importMap.set(defaultImport.getText(), resolved);
      }
    }

    // Find .route(path, routerRef) calls
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;

      const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
      if (!propAccess || propAccess.getName() !== "route") continue;

      const args = call.getArguments();
      if (args.length < 2) continue;

      const pathArg = args[0];
      if (pathArg.getKind() !== SyntaxKind.StringLiteral) continue;
      const mountPath = pathArg
        .asKind(SyntaxKind.StringLiteral)
        ?.getLiteralValue();
      if (!mountPath) continue;

      const childVar = args[1].getText();
      const parentVar = propAccess.getExpression().getText();

      mounts.push({
        parentVar,
        mountPath,
        childVar,
        childSourceFile: importMap.get(childVar) || null,
        inFile: filePath,
      });
    }
  }

  return mounts;
}

/**
 * Resolve a relative import specifier to an absolute file path.
 */
function resolveModulePath(
  project: Project,
  fromDir: string,
  specifier: string
): string | null {
  if (!specifier.startsWith(".")) return null;

  const base = join(fromDir, specifier);
  const extensions = [".ts", ".tsx", ".js", ".jsx"];

  for (const ext of extensions) {
    if (project.getSourceFile(base + ext)) return base + ext;
  }
  for (const ext of extensions) {
    const indexPath = join(base, "index" + ext);
    if (project.getSourceFile(indexPath)) return indexPath;
  }

  return null;
}

/**
 * Compute prefix maps by traversing the .route() mount graph.
 *
 * Returns:
 * - filePrefixMap: absolute file path → full mount prefix (for imported route files)
 * - varPrefixMap: "absFilePath:varName" → full mount prefix (for local variables)
 */
function computePrefixes(mounts: MountCall[]): {
  filePrefixMap: Map<string, string>;
  varPrefixMap: Map<string, string>;
} {
  const filePrefixMap = new Map<string, string>();
  const varPrefixMap = new Map<string, string>();

  // Find root variables: those that appear as parents but never as local children
  const localChildKeys = new Set<string>();
  for (const m of mounts) {
    if (!m.childSourceFile) {
      localChildKeys.add(`${m.inFile}\0${m.childVar}`);
    }
  }

  for (const m of mounts) {
    const parentKey = `${m.inFile}\0${m.parentVar}`;
    if (!localChildKeys.has(parentKey)) {
      varPrefixMap.set(parentKey, "");
    }
  }

  // Iteratively resolve prefixes (handles multi-level chains)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    for (const m of mounts) {
      const parentKey = `${m.inFile}\0${m.parentVar}`;
      let parentPrefix = varPrefixMap.get(parentKey);

      // Seed from file prefix if the parent router lives in a mounted route file
      if (parentPrefix === undefined && filePrefixMap.has(m.inFile)) {
        parentPrefix = filePrefixMap.get(m.inFile)!;
        varPrefixMap.set(parentKey, parentPrefix);
        changed = true;
      }

      if (parentPrefix === undefined) continue;

      const fullPrefix = joinPaths(parentPrefix, m.mountPath);

      if (m.childSourceFile) {
        if (!filePrefixMap.has(m.childSourceFile)) {
          filePrefixMap.set(m.childSourceFile, fullPrefix);
          changed = true;
        }
      } else {
        const childKey = `${m.inFile}\0${m.childVar}`;
        if (!varPrefixMap.has(childKey)) {
          varPrefixMap.set(childKey, fullPrefix);
          changed = true;
        }
      }
    }
  }

  return { filePrefixMap, varPrefixMap };
}

function joinPaths(prefix: string, path: string): string {
  if (!prefix) return path;
  if (path === "/") return prefix;
  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  return cleanPrefix + cleanPath;
}

// --- Main route scanning ---

async function scanCodeRoutes(projectDir: string): Promise<ScannedRoute[]> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const srcFiles = await findTsFiles(projectDir);

  for (const filePath of srcFiles) {
    project.addSourceFileAtPath(filePath);
  }

  // Phase 1: Build prefix maps from .route() mount chain
  const mounts = extractMountCalls(project);
  const { filePrefixMap, varPrefixMap } = computePrefixes(mounts);

  // Phase 2: Extract HTTP routes with resolved prefixes
  const routes: ScannedRoute[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const absPath = sourceFile.getFilePath();
    const filePrefix = filePrefixMap.get(absPath);

    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const result = extractRouteFromCall(call, projectDir);
      if (!result) continue;

      const { route, callerVar } = result;

      // Determine prefix: variable-level (local sub-apps) > file-level (imported routers) > none
      const varKey = `${absPath}\0${callerVar}`;
      const prefix = varPrefixMap.get(varKey) ?? filePrefix ?? "";

      route.path = joinPaths(prefix, route.path);
      routes.push(route);
    }
  }

  return routes;
}

function extractRouteFromCall(
  call: CallExpression,
  projectDir: string
): { route: ScannedRoute; callerVar: string } | null {
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
  const callerVar = propAccess.getExpression().getText();

  return {
    route: {
      method: methodName.toUpperCase(),
      path,
      filePath,
      description,
    },
    callerVar,
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

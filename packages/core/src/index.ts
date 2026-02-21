export const VERSION = "0.1.0";
export type {
  SkillDefinition,
  SkillFrontmatter,
  SchemaTable,
  SchemaField,
  ApiEndpoint,
  PricingRule,
  AccessRole,
} from "./types.js";
export { generateSkillMd } from "./skill/generator.js";

export interface NkmcConfig {
  name: string;
  version: string;
  roles: string[];
  framework: string;
  orm?: string;
  schemaPath?: string;
  pricing?: Record<string, { cost: number; token: string }>;
  gatewayUrl?: string;
  domain?: string;
}

export function defineConfig(config: NkmcConfig): NkmcConfig {
  return config;
}

export type {
  AgentContext,
  GuardOptions,
  NkmcInitOptions,
  AuthError,
} from "./auth/types.js";

export { Nkmc } from "./nkmc.js";
export { verifyRequest, type VerifyResult } from "./auth/guard.js";
export {
  signJwt,
  verifyJwt,
  type NkmcJwtPayload,
  type GatewayKeyPair,
  type SignOptions,
} from "./auth/jwt.js";

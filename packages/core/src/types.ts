export interface PricingRule {
  cost: number;
  token: string;
}

export interface SchemaField {
  name: string;
  type: string;
  description: string;
}

export type AccessRole = "public" | "owner" | "agent" | "premium" | string;

export interface SchemaTable {
  name: string;
  description: string;
  read: AccessRole;
  write: AccessRole;
  fields: SchemaField[];
}

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  role: AccessRole;
  pricing?: PricingRule;
  description: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  notes?: string;
  examples?: {
    request?: unknown;
    response?: unknown;
  };
}

export interface SkillFrontmatter {
  name: string;
  gateway: "nkmc";
  version: string;
  roles: string[];
}

export interface SkillDefinition {
  frontmatter: SkillFrontmatter;
  description: string;
  schema: SchemaTable[];
  api: ApiEndpoint[];
}

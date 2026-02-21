export interface DomainAuthHint {
  envVar: string;
  authType: "bearer" | "api-key";
  headerName?: string; // for api-key type
  guideUrl?: string;
}

export const DOMAIN_AUTH_HINTS: Record<string, DomainAuthHint> = {
  // --- AI ---
  "api.openai.com": {
    envVar: "OPENAI_API_KEY",
    authType: "bearer",
    guideUrl: "https://platform.openai.com/api-keys",
  },
  "api.anthropic.com": {
    envVar: "ANTHROPIC_API_KEY",
    authType: "api-key",
    headerName: "x-api-key",
    guideUrl: "https://console.anthropic.com/settings/keys",
  },
  "generativelanguage.googleapis.com": {
    envVar: "GEMINI_API_KEY",
    authType: "api-key",
    headerName: "x-goog-api-key",
    guideUrl: "https://aistudio.google.com/apikey",
  },
  "openrouter.ai": {
    envVar: "OPENROUTER_API_KEY",
    authType: "bearer",
    guideUrl: "https://openrouter.ai/keys",
  },
  "api.replicate.com": {
    envVar: "REPLICATE_API_TOKEN",
    authType: "bearer",
    guideUrl: "https://replicate.com/account/api-tokens",
  },

  // --- DevOps ---
  "api.github.com": {
    envVar: "GITHUB_TOKEN",
    authType: "bearer",
    guideUrl: "https://github.com/settings/tokens",
  },
  "gitlab.com": {
    envVar: "GITLAB_TOKEN",
    authType: "bearer",
    guideUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
  },
  "api.cloudflare.com": {
    envVar: "CLOUDFLARE_API_TOKEN",
    authType: "bearer",
    guideUrl: "https://dash.cloudflare.com/profile/api-tokens",
  },
  "api.vercel.com": {
    envVar: "VERCEL_TOKEN",
    authType: "bearer",
    guideUrl: "https://vercel.com/account/tokens",
  },
  "fly.io": {
    envVar: "FLY_API_TOKEN",
    authType: "bearer",
    guideUrl: "https://fly.io/user/personal_access_tokens",
  },
  "api.render.com": {
    envVar: "RENDER_API_KEY",
    authType: "bearer",
    guideUrl: "https://render.com/docs/api#authentication",
  },

  // --- Collaboration ---
  "api.notion.com": {
    envVar: "NOTION_API_KEY",
    authType: "bearer",
    guideUrl: "https://www.notion.so/my-integrations",
  },
  "app.asana.com": {
    envVar: "ASANA_TOKEN",
    authType: "bearer",
    guideUrl: "https://app.asana.com/0/developer-console",
  },
  "jira.atlassian.com": {
    envVar: "JIRA_API_TOKEN",
    authType: "bearer",
    guideUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
  },
  "slack.com": {
    envVar: "SLACK_TOKEN",
    authType: "bearer",
    guideUrl: "https://api.slack.com/apps",
  },
  "discord.com": {
    envVar: "DISCORD_TOKEN",
    authType: "bearer",
    guideUrl: "https://discord.com/developers/applications",
  },

  // --- Databases ---
  "api.supabase.com": {
    envVar: "SUPABASE_SERVICE_ROLE_KEY",
    authType: "bearer",
    guideUrl: "https://supabase.com/dashboard/project/_/settings/api",
  },
  "api.turso.tech": {
    envVar: "TURSO_AUTH_TOKEN",
    authType: "bearer",
    guideUrl: "https://turso.tech/app",
  },
  "console.neon.tech": {
    envVar: "NEON_API_KEY",
    authType: "bearer",
    guideUrl: "https://console.neon.tech",
  },

  // --- Communication ---
  "api.twilio.com": {
    envVar: "TWILIO_AUTH_TOKEN",
    authType: "bearer",
    guideUrl: "https://console.twilio.com",
  },
  "api.resend.com": {
    envVar: "RESEND_API_KEY",
    authType: "bearer",
    guideUrl: "https://resend.com/api-keys",
  },

  // --- Payments ---
  "api.stripe.com": {
    envVar: "STRIPE_SECRET_KEY",
    authType: "bearer",
    guideUrl: "https://dashboard.stripe.com/apikeys",
  },

  // --- Monitoring ---
  "sentry.io": {
    envVar: "SENTRY_AUTH_TOKEN",
    authType: "bearer",
    guideUrl: "https://sentry.io/settings/account/api/auth-tokens/",
  },
  "api.datadoghq.com": {
    envVar: "DD_API_KEY",
    authType: "api-key",
    headerName: "DD-API-KEY",
    guideUrl: "https://app.datadoghq.com/account/settings#api",
  },

  // --- Music ---
  "api.spotify.com": {
    envVar: "SPOTIFY_TOKEN",
    authType: "bearer",
    guideUrl: "https://developer.spotify.com/dashboard",
  },

  // --- CI/CD ---
  "circleci.com": {
    envVar: "CIRCLECI_TOKEN",
    authType: "bearer",
    guideUrl: "https://app.circleci.com/settings/user/tokens",
  },

  // --- API Tools ---
  "api.getpostman.com": {
    envVar: "POSTMAN_API_KEY",
    authType: "api-key",
    headerName: "X-Api-Key",
    guideUrl: "https://web.postman.co/settings/me/api-keys",
  },
};

export function getAuthHint(domain: string): DomainAuthHint | null {
  return DOMAIN_AUTH_HINTS[domain] ?? null;
}

import { saveAgentToken } from "../credentials.js";

export async function runAuth(opts: {
  gatewayUrl?: string;
}): Promise<void> {
  const gatewayUrl =
    opts.gatewayUrl ??
    process.env.NKMC_GATEWAY_URL ??
    "https://api.nkmc.ai";

  const sub = `agent-${Date.now()}`;

  const res = await fetch(`${gatewayUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sub,
      svc: "gateway",
      roles: ["agent"],
      expiresIn: "24h",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth failed (${res.status}): ${body}`);
  }

  const { token } = (await res.json()) as { token: string };

  await saveAgentToken(gatewayUrl, token);

  console.log("Authenticated with gateway");
  console.log(`  Token saved to ~/.nkmc/credentials.json`);
  console.log(`  Gateway: ${gatewayUrl}`);
}

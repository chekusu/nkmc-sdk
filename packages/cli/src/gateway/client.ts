export class GatewayClient {
  constructor(
    private gatewayUrl: string,
    private token: string,
  ) {}

  async execute(command: string): Promise<unknown> {
    const url = `${this.gatewayUrl.replace(/\/$/, "")}/execute`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gateway error ${res.status}: ${body}`);
    }
    return res.json();
  }
}

export async function createClient(): Promise<GatewayClient> {
  const { getAgentToken } = await import("../credentials.js");
  const stored = await getAgentToken();

  const gatewayUrl =
    process.env.NKMC_GATEWAY_URL ?? stored?.gatewayUrl ?? "https://api.nkmc.ai";

  const token = process.env.NKMC_TOKEN ?? stored?.token ?? null;

  if (!token) {
    throw new Error(
      "No token found. Run 'nkmc auth' first, or set NKMC_TOKEN.",
    );
  }

  return new GatewayClient(gatewayUrl, token);
}

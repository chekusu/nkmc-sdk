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

export function createClient(): GatewayClient {
  const gatewayUrl = process.env.NKMC_GATEWAY_URL;
  const token = process.env.NKMC_TOKEN;
  if (!gatewayUrl) throw new Error("NKMC_GATEWAY_URL is required");
  if (!token) throw new Error("NKMC_TOKEN is required");
  return new GatewayClient(gatewayUrl, token);
}

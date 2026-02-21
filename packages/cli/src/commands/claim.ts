import { saveToken } from "../credentials.js";

export interface ClaimOptions {
  gatewayUrl: string;
  domain: string;
  verify?: boolean;
}

export async function runClaim(options: ClaimOptions): Promise<void> {
  const { gatewayUrl, domain, verify } = options;
  const baseUrl = gatewayUrl.replace(/\/$/, "");

  if (verify) {
    await verifyClaim(baseUrl, domain);
  } else {
    await requestChallenge(baseUrl, domain);
  }
}

async function requestChallenge(
  baseUrl: string,
  domain: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/domains/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Challenge request failed (${res.status}): ${body}`);
  }

  const data = await res.json() as {
    domain: string;
    txtRecord: string;
    txtValue: string;
    expiresAt: number;
  };

  const expires = new Date(data.expiresAt).toISOString();

  console.log(`\nDomain claim initiated for ${data.domain}\n`);
  console.log(`Add the following DNS TXT record:\n`);
  console.log(`  Name:  ${data.txtRecord}`);
  console.log(`  Value: ${data.txtValue}\n`);
  console.log(`This challenge expires at ${expires}.\n`);
  console.log(`After adding the record, verify with:`);
  console.log(`  nkmc claim ${domain} --verify\n`);
  console.log(`Tip: You can check propagation with:`);
  console.log(`  dig TXT ${data.txtRecord}`);
}

async function verifyClaim(baseUrl: string, domain: string): Promise<void> {
  const res = await fetch(`${baseUrl}/domains/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const error = (data.error as string) || "Verification failed";
    console.error(`\nVerification failed: ${error}\n`);
    console.log(`Troubleshooting:`);
    console.log(`  1. Check the record exists: dig TXT _nkmc.${domain}`);
    console.log(`  2. DNS propagation can take up to 5 minutes`);
    console.log(`  3. Ensure the TXT value matches exactly (including "nkmc-verify=" prefix)\n`);
    process.exitCode = 1;
    return;
  }

  const publishToken = data.publishToken as string;
  await saveToken(domain, publishToken);

  console.log(`\nDomain ${domain} verified successfully!`);
  console.log(`Publish token saved to ~/.nkmc/credentials.json\n`);
  console.log(`You can now register services:`);
  console.log(`  nkmc register --domain ${domain}`);
}

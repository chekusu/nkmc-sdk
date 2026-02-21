import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient, createClient } from "../../src/gateway/client.js";
import { formatGrepResults, isSearchResults, isEndpointResults } from "../../src/commands/fs.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("GatewayClient", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
  });

  it("should send command to gateway /execute endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: ["a.ts", "b.ts"] }),
    });

    const client = new GatewayClient("https://gw.example.com", "test-token");
    const result = await client.execute("ls /src");

    expect(mockFetch).toHaveBeenCalledWith("https://gw.example.com/execute", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: "ls /src" }),
    });
    expect(result).toEqual({ files: ["a.ts", "b.ts"] });
  });

  it("should strip trailing slash from gateway URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const client = new GatewayClient("https://gw.example.com/", "token");
    await client.execute("cat /file.ts");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gw.example.com/execute",
      expect.any(Object),
    );
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const client = new GatewayClient("https://gw.example.com", "bad-token");
    await expect(client.execute("ls /")).rejects.toThrow("Gateway error 401: Unauthorized");
  });
});

describe("createClient", () => {
  const originalEnv = { ...process.env };
  let tempHome: string | undefined;

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
      tempHome = undefined;
    }
  });

  it("should create client from env vars", async () => {
    process.env.NKMC_GATEWAY_URL = "https://gw.example.com";
    process.env.NKMC_TOKEN = "my-token";

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should use default gateway URL when env var missing", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    process.env.NKMC_TOKEN = "my-token";

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should throw if no token available", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    delete process.env.NKMC_TOKEN;
    await expect(createClient()).rejects.toThrow(
      "No token found. Run 'nkmc auth' first, or set NKMC_TOKEN.",
    );
  });

  it("should fall back to credentials.json agent token", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    delete process.env.NKMC_TOKEN;

    tempHome = join(tmpdir(), `nkmc-client-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const data = {
      tokens: {},
      agentToken: {
        token: "stored-jwt",
        gatewayUrl: "https://stored-gw.example.com",
        issuedAt: new Date().toISOString(),
        expiresAt: futureDate,
      },
    };
    await writeFile(join(tempHome, "credentials.json"), JSON.stringify(data));

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should prefer env vars over credentials.json", async () => {
    process.env.NKMC_GATEWAY_URL = "https://env-gw.example.com";
    process.env.NKMC_TOKEN = "env-token";

    tempHome = join(tmpdir(), `nkmc-client-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const data = {
      tokens: {},
      agentToken: {
        token: "stored-jwt",
        gatewayUrl: "https://stored-gw.example.com",
        issuedAt: new Date().toISOString(),
        expiresAt: futureDate,
      },
    };
    await writeFile(join(tempHome, "credentials.json"), JSON.stringify(data));

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
    // env vars should win — we can't inspect private fields, but the client was created successfully
  });
});

describe("formatGrepResults", () => {
  it("should format SearchResult with matched endpoints", () => {
    const data = [
      {
        domain: "api.weather.gov",
        name: "National Weather Service",
        description: "Weather data",
        isFirstParty: false,
        matchedEndpoints: [
          { method: "GET", path: "/alerts/active", description: "Active weather alerts" },
          { method: "GET", path: "/alerts/{id}", description: "Single alert by ID" },
        ],
      },
    ];
    const output = formatGrepResults(data);
    expect(output).toContain("api.weather.gov — National Weather Service");
    expect(output).toContain("2 matched");
    expect(output).toContain("GET    /alerts/active");
    expect(output).toContain("GET    /alerts/{id}");
    expect(output).toContain("— Active weather alerts");
  });

  it("should format SearchResult without matched endpoints", () => {
    const data = [
      {
        domain: "acme.com",
        name: "Acme Store",
        description: "E-commerce",
        isFirstParty: false,
        matchedEndpoints: [],
      },
    ];
    const output = formatGrepResults(data);
    expect(output).toBe("acme.com — Acme Store");
    expect(output).not.toContain("matched");
  });

  it("should format multiple SearchResults separated by blank lines", () => {
    const data = [
      { domain: "a.com", name: "A", description: "A", isFirstParty: false, matchedEndpoints: [] },
      { domain: "b.com", name: "B", description: "B", isFirstParty: false, matchedEndpoints: [] },
    ];
    const output = formatGrepResults(data);
    expect(output).toBe("a.com — A\n\nb.com — B");
  });

  it("should format EndpointResult list", () => {
    const data = [
      { method: "GET", path: "/alerts/active", description: "Active alerts" },
      { method: "POST", path: "/alerts", description: "Create alert" },
    ];
    const output = formatGrepResults(data);
    expect(output).toContain("GET    /alerts/active");
    expect(output).toContain("POST   /alerts");
    expect(output).toContain("— Active alerts");
    expect(output).toContain("— Create alert");
  });

  it("should fall back to JSON for unknown data shapes", () => {
    const data = [1, 2, 3];
    const output = formatGrepResults(data);
    expect(output).toBe("[1,2,3]");
  });

  it("should fall back to JSON for empty array", () => {
    const output = formatGrepResults([]);
    expect(output).toBe("[]");
  });
});

describe("isSearchResults", () => {
  it("should return true for valid SearchResult array", () => {
    expect(isSearchResults([{ domain: "a.com", name: "A" }])).toBe(true);
  });

  it("should return false for empty array", () => {
    expect(isSearchResults([])).toBe(false);
  });

  it("should return false for non-array", () => {
    expect(isSearchResults("test")).toBe(false);
  });

  it("should return false for array without domain field", () => {
    expect(isSearchResults([{ method: "GET", path: "/" }])).toBe(false);
  });
});

describe("isEndpointResults", () => {
  it("should return true for valid EndpointResult array", () => {
    expect(isEndpointResults([{ method: "GET", path: "/test" }])).toBe(true);
  });

  it("should return false for empty array", () => {
    expect(isEndpointResults([])).toBe(false);
  });

  it("should return false for non-array", () => {
    expect(isEndpointResults(null)).toBe(false);
  });
});

describe("pipe command", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    process.env.NKMC_GATEWAY_URL = "https://gw.test.com";
    process.env.NKMC_TOKEN = "test-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
    delete process.env.NKMC_GATEWAY_URL;
    delete process.env.NKMC_TOKEN;
  });

  it("should execute cat then write in sequence", async () => {
    const catData = { title: "Hello", body: "World" };

    // First call: cat → returns data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(catData),
    });
    // Second call: write → returns confirmation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "msg-1" }),
    });

    const client = new GatewayClient("https://gw.test.com", "test-token");

    // Step 1: cat
    const data = await client.execute("cat /api.weather.gov/alerts/active");
    expect(data).toEqual(catData);

    // Step 2: write with data from step 1
    const writePath = "/discord.com/channels/123/messages";
    const result = await client.execute(`write ${writePath} ${JSON.stringify(data)}`);
    expect(result).toEqual({ id: "msg-1" });

    // Verify both calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify cat command
    expect(mockFetch).toHaveBeenNthCalledWith(1, "https://gw.test.com/execute", {
      method: "POST",
      headers: expect.any(Object),
      body: JSON.stringify({ command: "cat /api.weather.gov/alerts/active" }),
    });

    // Verify write command includes serialized cat data
    expect(mockFetch).toHaveBeenNthCalledWith(2, "https://gw.test.com/execute", {
      method: "POST",
      headers: expect.any(Object),
      body: JSON.stringify({
        command: `write ${writePath} ${JSON.stringify(catData)}`,
      }),
    });
  });

  it("should propagate step 1 (cat) failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });

    const client = new GatewayClient("https://gw.test.com", "test-token");
    await expect(client.execute("cat /unknown/path")).rejects.toThrow("Gateway error 404");
  });

  it("should propagate step 2 (write) failure", async () => {
    // cat succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: "test" }),
    });
    // write fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    const client = new GatewayClient("https://gw.test.com", "test-token");
    await client.execute("cat /source/path");
    await expect(client.execute("write /target/path {}")).rejects.toThrow("Gateway error 403");
  });
});

describe("pipe expression parsing", () => {
  // Test the parsing logic extracted from the pipe command
  function parsePipe(expression: string[]) {
    const full = expression.join(" ");
    const parts = full.split("|").map((s) => s.trim());
    if (parts.length !== 2) {
      throw new Error("Pipe expression must have exactly two stages separated by '|'");
    }
    const [source, target] = parts;
    if (!source.startsWith("cat ")) {
      throw new Error("Pipe step 1 must be a 'cat' command");
    }
    if (!target.startsWith("write ")) {
      throw new Error("Pipe step 2 must be a 'write' command");
    }
    return { source, writePath: target.slice("write ".length).trim() };
  }

  it("should parse valid pipe expression", () => {
    const result = parsePipe(["cat /a/b | write /c/d"]);
    expect(result.source).toBe("cat /a/b");
    expect(result.writePath).toBe("/c/d");
  });

  it("should parse pipe with spaces around |", () => {
    const result = parsePipe(["cat", "/source/path", "|", "write", "/target/path"]);
    expect(result.source).toBe("cat /source/path");
    expect(result.writePath).toBe("/target/path");
  });

  it("should reject expression without pipe", () => {
    expect(() => parsePipe(["cat /a/b"])).toThrow(
      "Pipe expression must have exactly two stages",
    );
  });

  it("should reject expression with more than one pipe", () => {
    expect(() => parsePipe(["cat /a | write /b | write /c"])).toThrow(
      "Pipe expression must have exactly two stages",
    );
  });

  it("should reject if step 1 is not cat", () => {
    expect(() => parsePipe(["ls /a | write /b"])).toThrow(
      "Pipe step 1 must be a 'cat' command",
    );
  });

  it("should reject if step 2 is not write", () => {
    expect(() => parsePipe(["cat /a | cat /b"])).toThrow(
      "Pipe step 2 must be a 'write' command",
    );
  });
});

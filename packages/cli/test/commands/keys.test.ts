import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveKey,
  getKey,
  listKeys,
  deleteKey,
} from "../../src/credentials.js";
import { getAuthHint, DOMAIN_AUTH_HINTS } from "../../src/keys/provider-map.js";

// --- credentials key storage ---

describe("credentials key storage", () => {
  const originalEnv = { ...process.env };
  let tempHome: string;

  beforeEach(async () => {
    tempHome = join(tmpdir(), `nkmc-keys-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(tempHome, { recursive: true, force: true });
  });

  it("should save and retrieve a bearer key", async () => {
    await saveKey("api.openai.com", { type: "bearer", token: "sk-test-123" });
    const entry = await getKey("api.openai.com");
    expect(entry).not.toBeNull();
    expect(entry!.auth).toEqual({ type: "bearer", token: "sk-test-123" });
    expect(entry!.updatedAt).toBeTruthy();
  });

  it("should save and retrieve an api-key key", async () => {
    await saveKey("api.anthropic.com", {
      type: "api-key",
      header: "x-api-key",
      key: "sk-ant-test",
    });
    const entry = await getKey("api.anthropic.com");
    expect(entry!.auth).toEqual({
      type: "api-key",
      header: "x-api-key",
      key: "sk-ant-test",
    });
  });

  it("should return null for missing key", async () => {
    const entry = await getKey("nonexistent.com");
    expect(entry).toBeNull();
  });

  it("should list all keys", async () => {
    await saveKey("api.openai.com", { type: "bearer", token: "sk-1" });
    await saveKey("api.github.com", { type: "bearer", token: "ghp-1" });
    const keys = await listKeys();
    expect(Object.keys(keys)).toHaveLength(2);
    expect(keys["api.openai.com"]).toBeTruthy();
    expect(keys["api.github.com"]).toBeTruthy();
  });

  it("should return empty object when no keys", async () => {
    const keys = await listKeys();
    expect(keys).toEqual({});
  });

  it("should delete a key", async () => {
    await saveKey("api.openai.com", { type: "bearer", token: "sk-1" });
    const deleted = await deleteKey("api.openai.com");
    expect(deleted).toBe(true);
    const entry = await getKey("api.openai.com");
    expect(entry).toBeNull();
  });

  it("should return false when deleting nonexistent key", async () => {
    const deleted = await deleteKey("nonexistent.com");
    expect(deleted).toBe(false);
  });

  it("should overwrite existing key", async () => {
    await saveKey("api.openai.com", { type: "bearer", token: "old-key" });
    await saveKey("api.openai.com", { type: "bearer", token: "new-key" });
    const entry = await getKey("api.openai.com");
    expect(entry!.auth.token).toBe("new-key");
  });

  it("should not affect other credential fields", async () => {
    // Write a key then verify tokens field still works
    await saveKey("api.openai.com", { type: "bearer", token: "sk-1" });
    const raw = JSON.parse(await readFile(join(tempHome, "credentials.json"), "utf-8"));
    expect(raw.tokens).toEqual({});
    expect(raw.keys["api.openai.com"]).toBeTruthy();
  });

  it("should set file permissions to 0o600", async () => {
    const { stat } = await import("node:fs/promises");
    await saveKey("api.openai.com", { type: "bearer", token: "sk-1" });
    const stats = await stat(join(tempHome, "credentials.json"));
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

// --- provider map ---

describe("provider-map", () => {
  it("should return auth hint for known domain", () => {
    const hint = getAuthHint("api.openai.com");
    expect(hint).not.toBeNull();
    expect(hint!.envVar).toBe("OPENAI_API_KEY");
    expect(hint!.authType).toBe("bearer");
    expect(hint!.guideUrl).toContain("openai.com");
  });

  it("should return api-key type for Anthropic", () => {
    const hint = getAuthHint("api.anthropic.com");
    expect(hint!.authType).toBe("api-key");
    expect(hint!.headerName).toBe("x-api-key");
  });

  it("should return null for unknown domain", () => {
    const hint = getAuthHint("unknown-api.example.com");
    expect(hint).toBeNull();
  });

  it("should have guideUrl for all major providers", () => {
    const majorDomains = [
      "api.openai.com",
      "api.anthropic.com",
      "api.github.com",
      "api.cloudflare.com",
      "api.stripe.com",
    ];
    for (const domain of majorDomains) {
      const hint = getAuthHint(domain);
      expect(hint, `Missing hint for ${domain}`).not.toBeNull();
      expect(hint!.guideUrl, `Missing guideUrl for ${domain}`).toBeTruthy();
    }
  });

  it("should have at least 20 domain entries", () => {
    expect(Object.keys(DOMAIN_AUTH_HINTS).length).toBeGreaterThanOrEqual(20);
  });
});

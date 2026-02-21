import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadCredentials, saveToken, getToken } from "../src/credentials.js";
import { mkdir, rm, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { signPublishToken } from "@nkmc/core";
import { generateGatewayKeyPair } from "@nkmc/core/testing";

describe("credentials", () => {
  let tempHome: string;
  const savedNkmcHome = process.env.NKMC_HOME;

  beforeEach(async () => {
    tempHome = join(tmpdir(), `nkmc-cred-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;
  });

  afterEach(async () => {
    if (savedNkmcHome === undefined) {
      delete process.env.NKMC_HOME;
    } else {
      process.env.NKMC_HOME = savedNkmcHome;
    }
    await rm(tempHome, { recursive: true, force: true });
  });

  describe("loadCredentials", () => {
    it("should return empty store when file does not exist", async () => {
      const creds = await loadCredentials();
      expect(creds).toEqual({ tokens: {} });
    });

    it("should load existing credentials", async () => {
      const data = {
        tokens: {
          "api.example.com": {
            publishToken: "token123",
            issuedAt: "2025-01-01T00:00:00.000Z",
            expiresAt: "2025-04-01T00:00:00.000Z",
          },
        },
      };
      await writeFile(
        join(tempHome, "credentials.json"),
        JSON.stringify(data),
      );

      const creds = await loadCredentials();
      expect(creds.tokens["api.example.com"].publishToken).toBe("token123");
    });
  });

  describe("saveToken", () => {
    it("should save a publish token to credentials file", async () => {
      const { privateKey } = await generateGatewayKeyPair();
      const token = await signPublishToken(privateKey, "api.example.com");

      await saveToken("api.example.com", token);

      const filePath = join(tempHome, "credentials.json");
      const raw = await readFile(filePath, "utf-8");
      const creds = JSON.parse(raw);

      expect(creds.tokens["api.example.com"]).toBeDefined();
      expect(creds.tokens["api.example.com"].publishToken).toBe(token);
      expect(creds.tokens["api.example.com"].issuedAt).toBeDefined();
      expect(creds.tokens["api.example.com"].expiresAt).toBeDefined();
    });

    it("should set file permissions to 0600", async () => {
      const { privateKey } = await generateGatewayKeyPair();
      const token = await signPublishToken(privateKey, "test.com");

      await saveToken("test.com", token);

      const filePath = join(tempHome, "credentials.json");
      const stats = await stat(filePath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("should preserve tokens for other domains", async () => {
      const { privateKey } = await generateGatewayKeyPair();
      const token1 = await signPublishToken(privateKey, "a.example.com");
      const token2 = await signPublishToken(privateKey, "b.example.com");

      await saveToken("a.example.com", token1);
      await saveToken("b.example.com", token2);

      const filePath = join(tempHome, "credentials.json");
      const creds = JSON.parse(await readFile(filePath, "utf-8"));

      expect(creds.tokens["a.example.com"].publishToken).toBe(token1);
      expect(creds.tokens["b.example.com"].publishToken).toBe(token2);
    });

    it("should overwrite token for same domain", async () => {
      const { privateKey } = await generateGatewayKeyPair();
      const token1 = await signPublishToken(privateKey, "api.example.com");
      const token2 = await signPublishToken(privateKey, "api.example.com");

      await saveToken("api.example.com", token1);
      await saveToken("api.example.com", token2);

      const filePath = join(tempHome, "credentials.json");
      const creds = JSON.parse(await readFile(filePath, "utf-8"));

      expect(creds.tokens["api.example.com"].publishToken).toBe(token2);
    });
  });

  describe("getToken", () => {
    it("should return null for unknown domain", async () => {
      const token = await getToken("unknown.com");
      expect(token).toBeNull();
    });

    it("should return token for saved domain", async () => {
      const { privateKey } = await generateGatewayKeyPair();
      const publishToken = await signPublishToken(
        privateKey,
        "api.example.com",
      );

      await saveToken("api.example.com", publishToken);

      const result = await getToken("api.example.com");
      expect(result).toBe(publishToken);
    });

    it("should return null for expired token", async () => {
      const data = {
        tokens: {
          "expired.com": {
            publishToken: "old-token",
            issuedAt: "2020-01-01T00:00:00.000Z",
            expiresAt: "2020-04-01T00:00:00.000Z",
          },
        },
      };
      await writeFile(
        join(tempHome, "credentials.json"),
        JSON.stringify(data),
      );

      const result = await getToken("expired.com");
      expect(result).toBeNull();
    });

    it("should return valid non-expired token", async () => {
      const futureDate = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const data = {
        tokens: {
          "valid.com": {
            publishToken: "valid-token",
            issuedAt: new Date().toISOString(),
            expiresAt: futureDate,
          },
        },
      };
      await writeFile(
        join(tempHome, "credentials.json"),
        JSON.stringify(data),
      );

      const result = await getToken("valid.com");
      expect(result).toBe("valid-token");
    });
  });
});

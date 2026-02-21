import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerService } from "../../src/commands/register.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("registerService", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `nkmc-test-${Date.now()}`);
    await mkdir(join(tempDir, ".well-known"), { recursive: true });
    await writeFile(
      join(tempDir, ".well-known", "skill.md"),
      "---\nname: Test\n---\n# Test Service\nA test.",
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should POST skill.md to gateway", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, domain: "test.com", name: "Test" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await registerService({
      gatewayUrl: "http://localhost:3070",
      adminToken: "secret",
      domain: "test.com",
      skillMdPath: join(tempDir, ".well-known", "skill.md"),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "http://localhost:3070/registry/services?domain=test.com",
    );
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer secret");
    expect(opts.headers["Content-Type"]).toBe("text/markdown");
    expect(opts.body).toContain("# Test Service");
  });

  it("should throw on HTTP error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      registerService({
        gatewayUrl: "http://localhost:3070",
        adminToken: "secret",
        domain: "test.com",
        skillMdPath: join(tempDir, ".well-known", "skill.md"),
      }),
    ).rejects.toThrow("Registration failed (500)");
  });

  it("should throw on empty skill.md", async () => {
    await writeFile(join(tempDir, ".well-known", "skill.md"), "");

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      registerService({
        gatewayUrl: "http://localhost:3070",
        adminToken: "secret",
        domain: "test.com",
        skillMdPath: join(tempDir, ".well-known", "skill.md"),
      }),
    ).rejects.toThrow("skill.md is empty");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

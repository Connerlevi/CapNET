import { describe, it, expect, afterEach } from "vitest";
import { loadOrCreateKeypair } from "../../sdk/src/keys.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("loadOrCreateKeypair", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a new keypair when none exists", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capnet-keys-"));
    const kp = await loadOrCreateKeypair("test-agent", tempDir);

    expect(kp.publicKeyB64).toBeTruthy();
    expect(kp.secretKeyB64).toBeTruthy();

    // File should exist
    const filePath = path.join(tempDir, "test-agent.json");
    const content = await fs.readFile(filePath, "utf-8");
    const saved = JSON.parse(content);
    expect(saved.publicKeyB64).toBe(kp.publicKeyB64);
  });

  it("loads existing keypair on second call", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capnet-keys-"));
    const kp1 = await loadOrCreateKeypair("test-agent", tempDir);
    const kp2 = await loadOrCreateKeypair("test-agent", tempDir);

    expect(kp1.publicKeyB64).toBe(kp2.publicKeyB64);
    expect(kp1.secretKeyB64).toBe(kp2.secretKeyB64);
  });

  it("sanitizes agent IDs with special characters", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capnet-keys-"));
    const kp = await loadOrCreateKeypair("agent/with:special@chars", tempDir);

    expect(kp.publicKeyB64).toBeTruthy();

    const filePath = path.join(tempDir, "agent_with_special_chars.json");
    const exists = await fs.stat(filePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("creates nested directories if needed", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capnet-keys-"));
    const nestedDir = path.join(tempDir, "deep", "nested");
    const kp = await loadOrCreateKeypair("test-agent", nestedDir);

    expect(kp.publicKeyB64).toBeTruthy();
  });
});

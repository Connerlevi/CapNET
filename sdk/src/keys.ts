import { generateEd25519Keypair, type Keypair } from "@capnet/shared";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { homedir } from "node:os";

const DEFAULT_KEYS_DIR = path.join(homedir(), ".capnet", "keys");

function sanitizeAgentId(agentId: string): string {
  return agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function loadOrCreateKeypair(
  agentId: string,
  keysDir?: string
): Promise<Keypair> {
  const dir = keysDir ?? DEFAULT_KEYS_DIR;
  const filePath = path.join(dir, `${sanitizeAgentId(agentId)}.json`);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as Keypair;
    if (parsed.publicKeyB64 && parsed.secretKeyB64) {
      return parsed;
    }
  } catch {
    // File doesn't exist or is invalid — generate new keypair
  }

  const keypair = generateEd25519Keypair();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(keypair, null, 2), "utf-8");
  return keypair;
}

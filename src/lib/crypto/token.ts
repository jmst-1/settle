import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "v1";

function keyBuf(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const key = keyBuf();
  if (!key) return `plain:${plain}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith("plain:")) return stored.slice(6);
  const key = keyBuf();
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const [prefix, ivB64, tagB64, dataB64] = stored.split(".");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !dataB64) throw new Error("Invalid token blob");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

export function signState(payload: object): string {
  return encryptSecret(JSON.stringify({ ...payload, ts: Date.now() }));
}

export function readState<T extends object>(blob: string, maxAgeMs = 20 * 60 * 1000): T {
  const parsed = JSON.parse(decryptSecret(blob)) as T & { ts?: number };
  if (parsed.ts && Date.now() - parsed.ts > maxAgeMs) throw new Error("OAuth state expired");
  return parsed;
}

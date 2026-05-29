import crypto from "crypto";
import type { CryptoProvider } from "./index";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

type KmsClient = {
  encrypt(req: {
    name: string;
    plaintext: Buffer;
    additionalAuthenticatedData?: Buffer;
  }): Promise<[{ ciphertext?: Uint8Array | string | null }]>;
  decrypt(req: {
    name: string;
    ciphertext: Buffer;
    additionalAuthenticatedData?: Buffer;
  }): Promise<[{ plaintext?: Uint8Array | string | null }]>;
};

let clientPromise: Promise<KmsClient> | null = null;
async function getClient(): Promise<KmsClient> {
  if (!clientPromise) {
    clientPromise = import("@google-cloud/kms").then(
      (m) => new m.KeyManagementServiceClient() as unknown as KmsClient
    );
  }
  return clientPromise;
}

function keyName(): string {
  const name = process.env.RELAY_KMS_KEY_NAME;
  if (!name) throw new Error("RELAY_KMS_KEY_NAME is not set");
  return name;
}

// 데이터키로 AES-256-GCM 암복호 (포맷: iv.tag.ciphertext, base64)
function gcmEncrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function gcmDecrypt(payload: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export const kmsProvider: CryptoProvider = {
  async seal(plaintext, ctx) {
    const client = await getClient();
    const dataKey = crypto.randomBytes(32);
    const ciphertext = gcmEncrypt(plaintext, dataKey);
    const [res] = await client.encrypt({
      name: keyName(),
      plaintext: dataKey,
      additionalAuthenticatedData: Buffer.from(ctx.tenantId, "utf8"),
    });
    if (!res.ciphertext) throw new Error("KMS encrypt returned no ciphertext");
    const wrappedDataKey = Buffer.from(res.ciphertext).toString("base64");
    return { ciphertext, cryptoVersion: "kms-v1", wrappedDataKey };
  },

  async open(sealed, ctx) {
    if (!sealed.wrappedDataKey) {
      throw new Error("Missing wrappedDataKey for kms-v1");
    }
    const client = await getClient();
    const [res] = await client.decrypt({
      name: keyName(),
      ciphertext: Buffer.from(sealed.wrappedDataKey, "base64"),
      additionalAuthenticatedData: Buffer.from(ctx.tenantId, "utf8"),
    });
    if (!res.plaintext) throw new Error("KMS decrypt returned no plaintext");
    const dataKey = Buffer.from(res.plaintext);
    return gcmDecrypt(sealed.ciphertext, dataKey);
  },
};

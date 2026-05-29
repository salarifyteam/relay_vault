import { encryptSecret, decryptSecret } from "./secretCrypto";

export interface SealedSecret {
  ciphertext: string;
  cryptoVersion: string;
  wrappedDataKey?: string;
}

export interface CryptoContext {
  tenantId: string;
}

export interface CryptoProvider {
  seal(plaintext: string, ctx: CryptoContext): Promise<SealedSecret>;
  open(sealed: SealedSecret, ctx: CryptoContext): Promise<string>;
}

const envProvider: CryptoProvider = {
  async seal(plaintext) {
    return { ciphertext: encryptSecret(plaintext), cryptoVersion: "env-v1" };
  },
  async open(sealed) {
    return decryptSecret(sealed.ciphertext);
  },
};

async function loadKmsProvider(): Promise<CryptoProvider> {
  const mod = await import("./kmsProvider");
  return mod.kmsProvider;
}

// seal: RELAY_CRYPTO로 선택 / open: 암호문 버전으로 분기(기존 env-v1 영구 호환)
export function getCrypto(): CryptoProvider {
  return {
    async seal(plaintext, ctx) {
      if (process.env.RELAY_CRYPTO === "kms") {
        return (await loadKmsProvider()).seal(plaintext, ctx);
      }
      return envProvider.seal(plaintext, ctx);
    },
    async open(sealed, ctx) {
      if (sealed.cryptoVersion === "kms-v1") {
        return (await loadKmsProvider()).open(sealed, ctx);
      }
      return envProvider.open(sealed, ctx);
    },
  };
}

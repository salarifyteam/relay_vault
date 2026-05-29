import crypto from "crypto";

function randomToken(prefix: string, length = 48): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix;
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

export function generateRlyKey(): string {
  return randomToken("rly-");
}

export function generateRegistrationToken(): string {
  return randomToken("rgt-");
}

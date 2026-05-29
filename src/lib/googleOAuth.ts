import { OAuth2Client } from "google-auth-library";

export function getRedirectUri(): string {
  return (
    process.env.OAUTH_REDIRECT_URI ||
    "http://localhost:3000/api/auth/google/callback"
  );
}

export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set in .env.local"
    );
  }
  return new OAuth2Client(clientId, clientSecret, getRedirectUri());
}

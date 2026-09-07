import { createSign } from "node:crypto";

// Server-side only: exchanges a Google service-account key for a short-lived
// OAuth access token (RFC 7523 JWT bearer flow), so the Sheet can stay
// private and shared only with the service account — no API key, no
// third-party auth library, no paid Google Cloud product involved.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export const base64url = (input: string | Buffer): string =>
  (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// Exported for testing — signs the JWT assertion without making a network call.
export function buildServiceAccountAssertion(email: string, privateKeyPem: string, issuedAt: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600 }));
  const signingInput = `${header}.${claims}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem));
  return `${signingInput}.${signature}`;
}

type CachedToken = { accessToken: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

export async function getServiceAccountAccessToken(): Promise<string> {
  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const rawKey = process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (!email || !rawKey) throw new Error("Google Sheets API is not configured.");

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.accessToken;

  // Vercel env vars store the PEM as one line with literal "\n" escapes.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const assertion = buildServiceAccountAssertion(email, privateKey, now);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google OAuth token request failed [${response.status}]: ${body}`);
    throw new Error("The live source is temporarily unavailable.");
  }
  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: payload.access_token, expiresAt: now + payload.expires_in };
  return cachedToken.accessToken;
}

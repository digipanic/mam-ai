import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { base64url, buildServiceAccountAssertion } from "@/lib/google-service-account";

describe("base64url", () => {
  test("matches RFC 4648 base64url, no padding", () => {
    // "any carnal pleasure." -> classic base64 test vector with a "+" byte,
    // chosen so the -/_ substitution is actually exercised, not a no-op.
    expect(base64url("any carnal pleasure.")).toBe("YW55IGNhcm5hbCBwbGVhc3VyZS4");
    expect(base64url("any carnal pleasure.")).not.toContain("+");
    expect(base64url("any carnal pleasure.")).not.toContain("=");
  });
});

describe("buildServiceAccountAssertion", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const email = "monitor@example-project.iam.gserviceaccount.com";
  const issuedAt = 1_700_000_000;
  const assertion = buildServiceAccountAssertion(email, privateKey, issuedAt);
  const [headerPart, claimsPart, signaturePart] = assertion.split(".");

  test("produces a three-part JWT (header.claims.signature)", () => {
    expect(assertion.split(".")).toHaveLength(3);
  });

  test("header and claims decode to the expected JWT-bearer shape", () => {
    const header = JSON.parse(Buffer.from(headerPart!, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(claimsPart!, "base64url").toString("utf8"));
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims.iss).toBe(email);
    expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets.readonly");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.iat).toBe(issuedAt);
    expect(claims.exp).toBe(issuedAt + 3600);
  });

  test("signature verifies against the matching public key", () => {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerPart}.${claimsPart}`);
    const signature = Buffer.from(signaturePart!, "base64url");
    expect(verifier.verify(publicKey, signature)).toBe(true);
  });

  test("signature does not verify against an unrelated key", () => {
    const otherKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerPart}.${claimsPart}`);
    const signature = Buffer.from(signaturePart!, "base64url");
    expect(verifier.verify(otherKeyPair.publicKey, signature)).toBe(false);
  });
});

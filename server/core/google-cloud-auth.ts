import "server-only";

import { getVercelOidcToken } from "@vercel/oidc";
import type { GoogleAgentSearchConfig } from "./config";

type FetchLike = typeof fetch;

type TokenResponse = {
  access_token?: string;
  accessToken?: string;
  error?: string;
  error_description?: string;
};

/** Exchanges Vercel's short-lived workload identity for a short-lived Google
 * service-account token. No service-account key or API key is accepted. */
export async function googleCloudAccessToken(
  config: GoogleAgentSearchConfig,
  deps: { fetchImpl?: FetchLike; oidcToken?: () => Promise<string> } = {},
): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const subjectToken = await (deps.oidcToken ?? getVercelOidcToken)();
  if (!subjectToken) throw new Error("Vercel OIDC token is unavailable.");

  const provider = config.workloadIdentityProvider.replace(/^\/\/iam\.googleapis\.com\//, "");
  const sts = await fetchImpl("https://sts.googleapis.com/v1/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      audience: `//iam.googleapis.com/${provider}`,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "https://www.googleapis.com/auth/cloud-platform",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: subjectToken,
    }),
  });
  const stsJson = (await readJson(sts)) as TokenResponse;
  if (!sts.ok || !stsJson.access_token) {
    throw new Error(providerError("Google STS", sts.status, stsJson));
  }

  const serviceAccount = encodeURIComponent(config.serviceAccountEmail);
  const impersonation = await fetchImpl(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        authorization: `Bearer ${stsJson.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: ["https://www.googleapis.com/auth/cloud-platform"],
        lifetime: "1800s",
      }),
    },
  );
  const impersonationJson = (await readJson(impersonation)) as TokenResponse;
  if (!impersonation.ok || !impersonationJson.accessToken) {
    throw new Error(providerError("Google IAM Credentials", impersonation.status, impersonationJson));
  }
  return impersonationJson.accessToken;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function providerError(label: string, status: number, body: TokenResponse): string {
  const detail = body.error_description || body.error || "token exchange failed";
  return `${label} returned HTTP ${status}: ${detail}`;
}

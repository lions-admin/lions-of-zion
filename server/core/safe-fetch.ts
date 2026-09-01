import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isProduction } from "@/server/core/config";
import { db } from "@/server/db/client";
import {
  bucketForSubject,
  enforceRateLimit,
  OUTBOUND_SOURCE_DOMAIN,
  OUTBOUND_SOURCE_GLOBAL,
} from "@/server/core/rate-limit";

export type SafeFetchTextOptions = {
  accept: string;
  allowedContentTypes: readonly RegExp[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Retries are opt-in and deliberately bounded by each connector's
   * provider policy. Only transient failures are retried. */
  retryAttempts?: number;
  retryBackoffMs?: number;
  fetchImpl?: typeof fetch;
  resolveHost?: typeof lookup;
  /** Internal seam for deterministic testing. Production defaults to the
   * shared Postgres-backed outbound limiter below. */
  enforceRateLimit?: (url: URL) => Promise<void>;
  /** Test seam; production uses a real delay between transient retries. */
  sleep?: (milliseconds: number) => Promise<void>;
};

export type SafeTextResponse = {
  status: number;
  ok: boolean;
  url: string;
  body: string;
  contentType: string | null;
};

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.internal",
  "instance-data",
]);

/** Validates both literal IPs and every address currently returned by DNS.
 * Redirect targets are validated again by `safeFetchText`. */
export async function assertSafePublicUrl(
  value: string,
  resolveHost: typeof lookup = lookup,
): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS source URLs are allowed.");
  }
  if (isProduction() && url.protocol !== "https:") {
    throw new Error("Production source URLs must use HTTPS.");
  }
  if (url.username || url.password) throw new Error("Source URLs may not contain credentials.");

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local and metadata-service source URLs are not allowed.");
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Private-network source URLs are not allowed.");
    return url;
  }

  const addresses = await resolveHost(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Source hostname did not resolve.");
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Source hostname resolves to a private or local address.");
  }
  return url;
}

export async function safeFetchText(
  initialUrl: string,
  options: SafeFetchTextOptions,
): Promise<SafeTextResponse> {
  const attempts = Math.max(1, Math.min(3, Math.floor(options.retryAttempts ?? 0) + 1));
  const delay = Math.max(0, Math.floor(options.retryBackoffMs ?? 250));
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await safeFetchTextOnce(initialUrl, options);
      if (!isTransientStatus(response.status) || attempt === attempts - 1) return response;
      lastError = new Error(`Source returned transient HTTP ${response.status}`);
    } catch (cause) {
      if (!isRetryableFetchError(cause) || attempt === attempts - 1) throw cause;
      lastError = cause;
    }
    await sleep(delay * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Source request failed after retries.");
}

async function safeFetchTextOnce(
  initialUrl: string,
  options: SafeFetchTextOptions,
): Promise<SafeTextResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? lookup;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  let current = initialUrl;

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const url = await assertSafePublicUrl(current, resolveHost);
    await (options.enforceRateLimit ?? enforceOutboundSourceRateLimit)(url);
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: options.accept,
        "user-agent": "LionsOfZion-NewsMonitor/1.0 (+https://lionsofzion.io/methodology)",
      },
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Source redirect did not include a destination.");
      if (redirects === maxRedirects) throw new Error("Source exceeded the redirect limit.");
      current = new URL(location, url).toString();
      continue;
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? null;
    if (response.ok && (!contentType || !options.allowedContentTypes.some((pattern) => pattern.test(contentType)))) {
      throw new Error(`Source returned a disallowed content type: ${contentType ?? "missing"}.`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Source response exceeds the ${maxBytes}-byte limit.`);
    }

    return {
      status: response.status,
      ok: response.ok,
      url: response.url || url.toString(),
      body: await readLimitedText(response, maxBytes),
      contentType,
    };
  }

  throw new Error("Source exceeded the redirect limit.");
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableFetchError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  // Configuration, SSRF and content validation failures are deterministic;
  // retrying them just burns a provider request and hides the real problem.
  return !/not allowed|private|local|credentials|redirect|content type|response exceeds/i.test(cause.message);
}

/** Applied only in the deployed environment. Unit tests and local editorial
 * work do not need a production database merely to parse a public feed. */
export async function enforceOutboundSourceRateLimit(url: URL): Promise<void> {
  if (!isProduction()) return;
  await enforceRateLimit(
    db(),
    bucketForSubject("outbound-source-global", "all"),
    OUTBOUND_SOURCE_GLOBAL,
  );
  await enforceRateLimit(
    db(),
    bucketForSubject("outbound-source-domain", url.hostname.toLowerCase()),
    OUTBOUND_SOURCE_DOMAIN,
  );
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel("response too large");
      throw new Error(`Source response exceeds the ${maxBytes}-byte limit.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return false;
  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    a! >= 224
  );
}

import { loadEnvConfig } from "@next/env";
import { connectorFor } from "@/server/modules/sources/connectors";
import { sources } from "@/server/modules/sources";
import { closeDb, withDatabaseRole } from "@/server/db/client";

const actor = { label: "setup:source-verifier", userId: null };

// Operational scripts run outside `next dev`, which normally performs this
// load.  Reading the local environment here makes the documented command use
// the same non-secret configuration as the application; production secrets
// are still never printed or written by this script.
loadEnvConfig(process.cwd());

async function main() {
  const retryFailed = process.argv.includes("--retry-failed");
  const kindsArg = process.argv.find((value) => value.startsWith("--kinds="))?.slice(8);
  const requestedKinds = new Set((kindsArg ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const candidates = (await withDatabaseRole("app_service", actor.label, () => sources().list({ limit: 100 })))
    .filter((source) => ["rss", "api", "agent_search"].includes(source.kind))
    .filter((source) => !requestedKinds.size || requestedKinds.has(source.kind))
    .filter((source) => source.config && ["pending", ...(retryFailed ? ["failed"] : [])]
      .includes(String((source.config as Record<string, unknown>).verificationState)));
  const results: Array<{ slug: string; status: string; items: number; enabled: boolean; error?: string }> = [];

  for (const source of candidates) {
    const result = await connectorFor(source.kind).fetch(source);
    const validItems = result.items.filter((item) => {
      if (!item.title.trim() || !item.url || !isSecurePublicUrl(item.url)) return false;
      if (source.kind !== "rss" && !item.publisher?.homepageUrl) return false;
      // A discovery record must contain usable source language; a bare title
      // is not enough material to create evidence or a later editorial claim.
      return Boolean(item.excerpt?.trim() && item.excerpt.trim().length >= 40);
    });
    const enabled = result.status === "success" && validItems.length > 0;
    await withDatabaseRole("app_service", actor.label, () => sources().update(source.id, {
      active: enabled,
      config: {
        ...(source.config as Record<string, unknown>),
        verificationState: enabled ? "verified" : "failed",
        verifiedAt: new Date().toISOString(),
        verificationItems: validItems.length,
        verificationError: result.errorMessage ?? null,
      },
      changeSummary: enabled ? "Source verified and enabled" : "Source verification failed; remains disabled",
    }, actor));
    results.push({
      slug: source.slug,
      status: result.status,
      items: validItems.length,
      enabled,
      ...(result.errorMessage ? { error: result.errorMessage } : {}),
    });
  }

  console.log(JSON.stringify({ checked: results.length, results }, null, 2));
}

function isSecurePublicUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(closeDb);

import { loadEnvConfig } from "@next/env";
import {
  BRIEFING_ATOM_CANDIDATES,
  BRIEFING_DISCOVERY_QUERIES,
  BRIEFING_OFFICIAL_API_CANDIDATES,
  BRIEFING_PRIORITY_DOMAINS,
  BRIEFING_RSS_CANDIDATES,
} from "@/server/modules/sources/catalog";
import { deriveSourceLogicalKey } from "@/server/modules/sources/service";
import { sourceFamilies, sources } from "@/server/modules/sources";
import { closeDb, withDatabaseRole } from "@/server/db/client";

const actor = { label: "setup:briefing-discovery", userId: null };

// Keep direct operator scripts aligned with Next's environment loading. This
// only reads local configuration and does not expose credentials in output.
loadEnvConfig(process.cwd());

async function family(slug: string, label: string, description: string) {
  const existing = (await sourceFamilies().list()).find((entry) => entry.slug === slug);
  return existing ?? sourceFamilies().create({ slug, label, description });
}

async function main() {
  await withDatabaseRole("app_service", actor.label, seed);
}

async function seed() {
  const all = await sources().list({ limit: 100 });
  const existingBySlug = new Map(all.map((entry) => [entry.slug, entry]));
  let created = 0;
  let retiredGrounding = 0;
  let retiredGdelt = 0;

  for (const entry of all.filter((source) => source.kind === "google_search" && source.active)) {
    await sources().update(entry.id, {
      active: false,
      changeSummary: "Retired: Google Search Grounding is not a permanent discovery connector",
    }, actor);
    retiredGrounding++;
  }

  for (const entry of all.filter((source) => source.kind === "gdelt" && source.active)) {
    await sources().update(entry.id, {
      active: false,
      changeSummary: "Retired: briefing discovery uses verified RSS, official APIs, and Google Agent Search only",
    }, actor);
    retiredGdelt++;
  }

  for (const candidate of BRIEFING_RSS_CANDIDATES) {
    const existing = existingBySlug.get(candidate.slug);
    if (existing) {
      if (existing.feedUrl !== candidate.feedUrl || existing.name !== candidate.name
        || existing.homepageUrl !== candidate.homepageUrl) {
        await sources().update(existing.id, {
          name: candidate.name,
          homepageUrl: candidate.homepageUrl,
          feedUrl: candidate.feedUrl,
          language: candidate.language,
          country: candidate.country,
          active: false,
          config: {
            ...(existing.config && typeof existing.config === "object" ? existing.config as Record<string, unknown> : {}),
            category: candidate.category,
            verificationState: "pending",
            verificationError: null,
          },
          changeSummary: "RSS endpoint updated from the verified briefing source catalog; re-verification required",
        }, actor);
      }
      continue;
    }
    const sourceFamily = await family(
      `outlet-${candidate.slug}`,
      candidate.name,
      `Publisher family for ${candidate.name}; upstream wire relationships are resolved during clustering.`,
    );
    await sources().create({
      sourceFamilyId: sourceFamily.id,
      kind: "rss",
      slug: candidate.slug,
      logicalKey: deriveSourceLogicalKey({ kind: "rss", feedUrl: candidate.feedUrl })!,
      name: candidate.name,
      homepageUrl: candidate.homepageUrl,
      feedUrl: candidate.feedUrl,
      language: candidate.language,
      country: candidate.country,
      active: false,
      config: { category: candidate.category, verificationState: "pending" },
    }, actor);
    created++;
  }

  for (const candidate of [...BRIEFING_ATOM_CANDIDATES, ...BRIEFING_OFFICIAL_API_CANDIDATES]) {
    const existing = existingBySlug.get(candidate.slug);
    if (existing) continue;
    const isAtom = "sourceFamilySlug" in candidate;
    const sourceFamily = await family(
      isAtom ? candidate.sourceFamilySlug : `official-api-${candidate.slug}`,
      candidate.name,
      `Publisher family for ${candidate.name}; upstream relationships are resolved during clustering.`,
    );
    await sources().create({
      sourceFamilyId: sourceFamily.id,
      kind: isAtom ? "rss" : "api",
      slug: candidate.slug,
      logicalKey: deriveSourceLogicalKey({
        kind: isAtom ? "rss" : "api",
        feedUrl: candidate.feedUrl,
        config: "config" in candidate ? candidate.config : undefined,
      })!,
      name: candidate.name,
      homepageUrl: candidate.homepageUrl,
      feedUrl: candidate.feedUrl,
      language: candidate.language,
      country: candidate.country,
      active: false,
      config: {
        category: candidate.category,
        verificationState: "pending",
        ...(isAtom ? {} : candidate.config),
      },
    }, actor);
    created++;
  }

  for (const connectorKind of ["agent_search"] as const) {
    const discoveryFamily = await family(
      `briefing-${connectorKind}`,
      "Google Agent Search discovery",
      "Discovery service only. Evidence is reassigned to each original publisher.",
    );
    for (const query of BRIEFING_DISCOVERY_QUERIES) {
      const slug = `${connectorKind}-${query.slug}`;
      if (existingBySlug.has(slug)) continue;
      await sources().create({
        sourceFamilyId: discoveryFamily.id,
        kind: connectorKind,
        slug,
        logicalKey: deriveSourceLogicalKey({ kind: connectorKind, config: { query: query.query } })!,
        name: `${query.name} — Agent Search`,
        language: "en",
        country: "IL",
        active: false,
        config: {
          query: query.query,
          group: query.group,
          verificationState: "pending",
          allowedDomains: BRIEFING_PRIORITY_DOMAINS,
        },
      }, actor);
      created++;
    }
  }

  console.log(JSON.stringify({ created, retiredGrounding, retiredGdelt, candidatesRemainInactive: true }));
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(closeDb);

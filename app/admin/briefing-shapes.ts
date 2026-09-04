/**
 * The wire shapes of the routes that predate `server/contracts/admin-console.ts`
 * — `admin/status`, `admin/user-count`, `admin/briefing`, `admin/health/deep`
 * and the publications list — as the console has always read them. Moved
 * here unchanged from `AdminStatus.tsx` and `PublicationManager.tsx` when the
 * console was split into areas. Everything the contract describes is imported
 * from the contract; these are only the shapes it does not yet cover.
 */

export type Status = {
  status: string;
  environment: string;
  region: string;
  aiBudgetUsd: number;
  integrations: Record<string, boolean>;
  resourceFingerprints?: Record<string, string | null>;
  publicReadCache: { hits: number; misses: number; hitRatio: number | null; loads: number; averageLoadMs: number | null };
};

export type UserCount = { registeredUsers: number };

export type SourceHealth = {
  id: string; name: string; kind: string; active: boolean; consecutiveFailures: number;
  lastSuccessfulFetchAt: string | null; disabledReason: string | null; verificationError: string | null;
  attempts: number; successfulAttempts: number; itemsSeen: number; itemsNew: number;
};

export type BriefingStatus = {
  latestRunAt: string | null; failedRuns: number; unprocessedEvidence: number;
  automaticPublicationPaused: boolean; clustersLast24Hours: number; sources: SourceHealth[];
  jobs: Array<{ state: string; count: number; oldestAt: string | null }>;
  quarantine: Array<{ id: string; candidateKey: string; stage: string; reason: string; createdAt: string }>;
  runs: Array<{ id: string; localDate: string; stage: string; status: string; inputCount: number; outputCount: number; error: string | null; startedAt: string }>;
  spend: { last24HoursUsd: number; last30DaysUsd: number; byModel: Array<{ model: string; stage: string; costUsd: number; calls: number }> };
  googleUsage: { attemptsThisMonth: number; successfulQueriesThisMonth: number; estimatedSpendUsd: number | null; monthlyBudgetUsd: number | null };
  pipelineCounts: { rawResults: number; uniqueResults: number; enrichedEvidence: number; extractedClaims: number; rawBytes30d: number };
  narrativeTrends: Array<{ id: string; title: string; status: string; observationCount: number; lastSeenAt: string | null }>;
  alerts: Array<{ id: string; kind: string; severity: string; message: string; createdAt: string; notifiedAt: string | null }>;
  migration: { available: boolean; applied: number; latestId: number | null; latestAppliedAt: string | null };
};

export type DeepHealth = { status: string; checks: Record<string, { status: string; latencyMs: number }> };

export type Publication = {
  id: string; publicId: string; title: string; summary: string | null; body: string;
  section: "daily_brief" | "israel_update" | "war_update" | "narrative_watch";
  status: "draft" | "under_review" | "approved" | "published" | "updated" | "archived";
  editorialTopic: string | null; primaryActor: string | null; arena: string | null; featuredIsraelStory: boolean;
  narrativeWatchDetails: {
    exactClaim: string; propagators: string[]; arenas: string[]; trendDirection: string;
    israeliPosition: string | null; securityContext: string | null;
    supportingEvidenceIds: string[]; contradictingEvidenceIds: string[];
    verificationState: string; knownUnknowns: string[];
    /* Optional on purpose. This panel reads the admin list, which serves the
       raw jsonb rather than the normalised public projection, so rows written
       before the field existed genuinely have no key. Declaring it required
       here would have TypeScript assert a value the row may not carry.
       Read it as `=== "analysis"` and never as the negation. */
    evidenceBasis?: "sourced" | "analysis";
  } | null;
  briefingRunId: string | null;
  createdAt: string;
};

export type Traceability = {
  briefingRun: { id: string; localDate: string; stage: string; status: string } | null;
  edition: { id: string; contractVersion: string; promptVersion: string; status: string } | null;
  modelRuns: Array<{ id: string; model: string; profile: string; stage: string; costUsd: number }>;
  claims: Array<{ id: string; title: string; assessment: string; aiRunId: string | null; evidenceCount: number }>;
  sources: Array<{ id: string; title: string; publisher: string; url: string | null; retrievalStatus: string }>;
};

/* ── The draft preview route ────────────────────────────────────────────── */

/**
 * `GET /api/v1/admin/briefing/draft` is read pre-contract, like the routes
 * above. The shape is the briefing service's `draftPreview()` payload —
 * the persisted draft artifact's rendered output, exactly what the daily
 * publication path turns into publications, served before publication so a
 * failed or in-progress edition stays reviewable.
 */
export type DraftPreview = {
  localDate: string;
  dailyBrief: { title: string; summary: string; body: string };
  articles: Array<{
    section: "daily_brief" | "israel_update" | "war_update" | "narrative_watch";
    title: string;
    summary: string;
    body: string;
  }>;
};

/**
 * Today's Israel-local `YYYY-MM-DD`, computed the way the server computes it
 * (`server/modules/briefing/service.ts` — `en-CA` under `Asia/Jerusalem`).
 * The layering boundary lets `app/**` import only `@/server/contracts/*`, so
 * the formula is mirrored here rather than imported; a drift would surface
 * as a draft preview read one day off the edition the pipeline filed.
 */
export function israelLocalDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

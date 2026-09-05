import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { publication } from "@/server/db/schema";
import { publicationService } from "@/server/modules/publications/service";
import { createPublicationSchema, updatePublicationSchema } from "@/server/contracts/publication";
import { listPublicPublicationsSchema } from "@/server/contracts/publication";
import type { NarrativeWatchDetails } from "@/server/contracts/publication";

const actor = { label: "admin:test", userId: null };

/** The editable half of a monitoring record — what a human legitimately sets. */
const details = {
  exactClaim: "A widely repeated claim that no published source documents.",
  propagators: ["An account network"],
  arenas: ["social"],
  trendDirection: "rising" as const,
  israeliPosition: "The official position answering the claim.",
  securityContext: null,
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  verificationState: "refuted" as const,
  knownUnknowns: ["What the originating account intended."],
};

async function analysisRecord(db: Awaited<ReturnType<typeof freshDatabase>>) {
  const svc = publicationService(db);
  const row = await svc.create({
    kind: "news_update",
    section: "narrative_watch",
    title: "A claim answered from reasoning alone",
    body: "This record answers the claim from public context rather than from a cited source.",
    language: "en",
    narrativeWatchDetails: { ...details, evidenceBasis: "analysis" },
  }, actor);
  return { svc, id: row.id };
}

/**
 * `evidenceBasis` is the disclosure that separates "we documented this" from
 * "this is our own reasoning". It is derived from whether the record cites
 * anything, so nothing a client sends may move it — and the failure to guard
 * that is silent rather than loud: an unsourced record relabelled `sourced`
 * still renders, just as a documented report.
 */
describe("evidenceBasis cannot be set through the update contract", () => {
  /* Stripped rather than rejected, and deliberately so: the admin form spreads
     the whole stored details object back on save, so a strict schema would
     fail every legitimate edit. What matters is that the value cannot survive
     the parse and reach the write. */
  it("drops one a client tries to send instead of honouring it", () => {
    const parsed = updatePublicationSchema.safeParse({
      changeSummary: "Attempt to relabel the record.",
      narrativeWatchDetails: { ...details, evidenceBasis: "sourced" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.narrativeWatchDetails).not.toHaveProperty("evidenceBasis");
  });

  it("keeps an unsourced record marked as analysis when an editor edits it", async () => {
    const db = await freshDatabase();
    const { svc, id } = await analysisRecord(db);

    await svc.update(id, {
      changeSummary: "Sharpen the claim wording.",
      narrativeWatchDetails: { ...details, exactClaim: "A sharpened statement of the same claim." },
    }, actor);

    const [row] = await db.select().from(publication).where(eq(publication.id, id));
    const stored = row!.narrativeWatchDetails as NarrativeWatchDetails;
    expect(stored.evidenceBasis).toBe("analysis");
    expect(stored.exactClaim).toBe("A sharpened statement of the same claim.");
  });

  /* The dangerous direction: a PATCH that simply omits the key. The create
     schema defaults it to "sourced", so a shared shape here would strip the
     disclosure from an unsourced record without anyone typing the word. */
  it("does not let an omitted key silently relabel an unsourced record", async () => {
    const db = await freshDatabase();
    const { svc, id } = await analysisRecord(db);

    await svc.update(id, {
      changeSummary: "Edit that mentions no basis at all.",
      title: "A retitled record",
    }, actor);

    const [row] = await db.select().from(publication).where(eq(publication.id, id));
    expect((row!.narrativeWatchDetails as NarrativeWatchDetails).evidenceBasis).toBe("analysis");
  });

  it("leaves a sourced record sourced", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const row = await svc.create({
      kind: "news_update",
      section: "narrative_watch",
      title: "A claim answered with cited sources",
      body: "This record answers the claim using the evidence collected for it.",
      language: "en",
      narrativeWatchDetails: { ...details, evidenceBasis: "sourced" },
    }, actor);

    await svc.update(row.id, {
      changeSummary: "Adjust the arenas.",
      narrativeWatchDetails: { ...details, arenas: ["social", "broadcast"] },
    }, actor);

    const [stored] = await db.select().from(publication).where(eq(publication.id, row.id));
    expect((stored!.narrativeWatchDetails as NarrativeWatchDetails).evidenceBasis).toBe("sourced");
  });
});

/** `war_update` is retired: no write path may create or relabel a publication
 *  into it, while the value stays legal in the enum so existing rows keep
 *  reading and filtering cleanly. */
describe("war_update is rejected on write shapes and accepted on read shapes", () => {
  it("rejects war_update on create and update, accepts the writable sections", () => {
    expect(createPublicationSchema.safeParse({
      kind: "news_update", section: "war_update", title: "T", body: "B", language: "en",
    }).success).toBe(false);
    expect(updatePublicationSchema.safeParse({ section: "war_update", changeSummary: "Relabel." }).success).toBe(false);
    expect(updatePublicationSchema.safeParse({ section: "israel_update", changeSummary: "Relabel." }).success).toBe(true);
  });

  it("keeps war_update legal on read and filter shapes", () => {
    expect(listPublicPublicationsSchema.safeParse({ section: "war_update" }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation, type TestDatabase } from "@/server/db/testing";
import { narrativeService } from "@/server/modules/narratives/service";
import { readActivity } from "@/server/contracts/narrative";
import { ATTRIBUTION_NEEDS_REVIEW } from "@/server/contracts/enums";
import {
  actor,
  appUser,
  entityVersion,
  narrative,
  narrativeObservation,
} from "@/server/db/schema";

/**
 * The question this phase exists to answer is not "how many accounts pushed
 * this" but "how many INDEPENDENT SOURCE FAMILIES did". Most of what follows
 * is a way of checking that the difference survives.
 */

const who = { label: "analyst@example.org", userId: null };

/** Builds a source inside a named family, so a test can control exactly how
 *  much independence a set of observations really has. */
async function makeSource(db: TestDatabase, familySlug: string, sourceSlug: string) {
  const fam = (
    await db.execute(sql`
      INSERT INTO source_family (slug, label) VALUES (${familySlug}, ${familySlug})
      ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label RETURNING id`)
  ).rows[0] as { id: string };
  const src = (
    await db.execute(sql`
      INSERT INTO source (source_family_id, kind, slug, name, language)
      VALUES (${fam.id}, 'manual', ${sourceSlug}, ${sourceSlug}, 'en') RETURNING id`)
  ).rows[0] as { id: string };
  return src.id;
}

async function makeEvidence(db: TestDatabase, sourceId: string, title: string) {
  return (
    await db.execute(sql`
      INSERT INTO evidence (source_id, kind, title, language)
      VALUES (${sourceId}, 'social_post', ${title}, 'en') RETURNING id`)
  ).rows[0] as { id: string };
}

async function seedUser(db: TestDatabase, name: string, isAutomated = false) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: `auth|${name}`, displayName: name, isAutomated })
    .returning();
  return row!;
}

describe("the observation is the evidence", () => {
  it("refuses an observation with no evidence behind it", async () => {
    const db = await freshDatabase();
    const [n] = await db
      .insert(narrative)
      .values({ publicId: "n1", title: "A narrative", language: "en" })
      .returning();

    const v = await violation(
      db.execute(sql`
        INSERT INTO narrative_observation (narrative_id, evidence_id)
        VALUES (${n!.id}, NULL)`),
    );
    expect(v.code, "an attribution with no source must be impossible").toBe(
      SQLSTATE.notNullViolation,
    );
  });

  it("keeps sightings append-only — a correction is a new row", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative(
      { slug: "n2", title: "A narrative", language: "en" },
      who,
    );
    const src = await makeSource(db, "wire-a", "a1");
    const ev = await makeEvidence(db, src, "a post");
    await svc.observe(n.id, { evidenceId: ev.id }, who);

    const v = await violation(
      db.execute(sql`UPDATE narrative_observation SET platform = 'rewritten'`),
    );
    expect(v.message).toMatch(/narrative_observation is append-only/);
  });
});

describe("attributing to a state or a network", () => {
  it("keeps the SQL list and the contract list in agreement", async () => {
    /* The trigger hardcodes ('state','network'); this is the TypeScript copy.
       Same deliberate duplication as NEVER_AUTOMATED_CAPABILITIES. */
    expect([...ATTRIBUTION_NEEDS_REVIEW].sort()).toEqual(["network", "state"]);
  });

  it("refuses an automated identity confirming a state attribution", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "n3", title: "A narrative", language: "en" }, who);
    const src = await makeSource(db, "wire-a", "a2");
    const ev = await makeEvidence(db, src, "a post");
    const [stateActor] = await db
      .insert(actor)
      .values({ publicId: "some-state", kind: "state", name: "A State" })
      .returning();
    const robot = await seedUser(db, "Ingest Worker", true);

    const v = await violation(
      db.execute(sql`
        INSERT INTO narrative_observation (narrative_id, actor_id, evidence_id, confirmed_by, confirmed_at)
        VALUES (${n.id}, ${stateActor!.id}, ${ev.id}, ${robot.id}, now())`),
    );
    expect(v.message).toMatch(/must be confirmed by a human reviewer/);
  });

  it("allows a human to confirm it", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "n4", title: "A narrative", language: "en" }, who);
    const src = await makeSource(db, "wire-a", "a3");
    const ev = await makeEvidence(db, src, "a post");
    const [stateActor] = await db
      .insert(actor)
      .values({ publicId: "some-state", kind: "state", name: "A State" })
      .returning();
    const human = await seedUser(db, "An Analyst");

    await db.execute(sql`
      INSERT INTO narrative_observation (narrative_id, actor_id, evidence_id, confirmed_by, confirmed_at)
      VALUES (${n.id}, ${stateActor!.id}, ${ev.id}, ${human.id}, now())`);
    const rows = await db.select().from(narrativeObservation);
    expect(rows).toHaveLength(1);
  });

  it("does not count an unconfirmed state attribution toward the signal", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "n5", title: "A narrative", language: "en" }, who);
    const [stateActor] = await db
      .insert(actor)
      .values({ publicId: "some-state", kind: "state", name: "A State" })
      .returning();

    for (const s of ["a", "b", "c"]) {
      const src = await makeSource(db, `fam-${s}`, `src-${s}`);
      const ev = await makeEvidence(db, src, `post ${s}`);
      await svc.observe(n.id, { evidenceId: ev.id, actorId: stateActor!.id }, who);
    }

    /* The rows exist as leads… */
    expect(await db.select().from(narrativeObservation)).toHaveLength(3);
    /* …but drive no signal until a human stands behind them. */
    const { narratives } = await svc.now({ hours: 24, limit: 10 });
    expect(narratives).toEqual([]);
  });
});

describe("derived columns follow the observations", () => {
  it("moves first_seen, last_seen and the count", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "n6", title: "A narrative", language: "en" }, who);
    expect(n.observationCount).toBe(0);
    expect(n.lastSeenAt).toBeNull();

    const src = await makeSource(db, "wire-a", "a4");
    for (const t of ["one", "two"]) {
      const ev = await makeEvidence(db, src, t);
      await svc.observe(n.id, { evidenceId: ev.id }, who);
    }

    const [after] = await db.select().from(narrative).where(eq(narrative.id, n.id));
    expect(after!.observationCount).toBe(2);
    expect(after!.firstSeenAt).not.toBeNull();
    expect(after!.lastSeenAt).not.toBeNull();
  });

  it("refuses an application write to them", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "n7", title: "A narrative", language: "en" }, who);
    const v = await violation(
      db.execute(sql`UPDATE narrative SET observation_count = 999 WHERE id = ${n.id}`),
    );
    expect(v.message).toMatch(/derived from narrative_observation/);
  });
});

describe("amplification versus spread — the point of the phase", () => {
  /** Six accounts inside ONE family, against three accounts across THREE. */
  async function seedBoth(db: TestDatabase) {
    const svc = narrativeService(db);
    const amplified = await svc.createNarrative(
      { slug: "amplified", title: "נרטיב מוגבר", language: "he" },
      who,
    );
    const spreading = await svc.createNarrative(
      { slug: "spreading", title: "נרטיב מתפשט", language: "he" },
      who,
    );

    for (let i = 0; i < 6; i++) {
      const src = await makeSource(db, "megaphone", `mega-${i}`);
      const ev = await makeEvidence(db, src, `amp ${i}`);
      const [a] = await db
        .insert(actor)
        .values({ publicId: `amp-${i}`, kind: "platform_account", name: `amp${i}` })
        .returning();
      await svc.observe(amplified.id, { evidenceId: ev.id, actorId: a!.id }, who);
    }

    for (let i = 0; i < 3; i++) {
      const src = await makeSource(db, `independent-${i}`, `ind-${i}`);
      const ev = await makeEvidence(db, src, `spread ${i}`);
      const [a] = await db
        .insert(actor)
        .values({ publicId: `spr-${i}`, kind: "platform_account", name: `spr${i}` })
        .returning();
      await svc.observe(spreading.id, { evidenceId: ev.id, actorId: a!.id }, who);
    }
    return { svc };
  }

  it("tells one megaphone apart from a story actually travelling", async () => {
    const db = await freshDatabase();
    const { svc } = await seedBoth(db);
    const { narratives } = await svc.now({ hours: 24, limit: 10 });

    const amp = narratives.find((n) => n.publicId === "amplified")!;
    const spread = narratives.find((n) => n.publicId === "spreading")!;

    /* The amplified one looks BIGGER by every naive measure… */
    expect(amp.observations).toBeGreaterThan(spread.observations);
    expect(amp.distinctActors).toBeGreaterThan(spread.distinctActors);

    /* …and the family count is what gives it away. */
    expect(amp.distinctFamilies).toBe(1);
    expect(spread.distinctFamilies).toBe(3);
    expect(amp.reading).toBe("likely_amplification");
    expect(spread.reading).toBe("independent_spread");
  });

  it("would rank the megaphone first if we sorted by volume — which is why the reading exists", async () => {
    const db = await freshDatabase();
    const { svc } = await seedBoth(db);
    const { narratives } = await svc.now({ hours: 24, limit: 10 });
    expect(narratives[0]!.publicId, "ordering is by volume").toBe("amplified");
    expect(narratives[0]!.reading, "but the reading says what it really is").toBe(
      "likely_amplification",
    );
  });

  it("excludes sightings from outside the window", async () => {
    const db = await freshDatabase();
    const svc = narrativeService(db);
    const n = await svc.createNarrative({ slug: "old", title: "Old", language: "en" }, who);
    const src = await makeSource(db, "wire-a", "a5");
    const ev = await makeEvidence(db, src, "long ago");
    await svc.observe(
      n.id,
      { evidenceId: ev.id, observedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() },
      who,
    );

    expect((await svc.now({ hours: 24, limit: 10 })).narratives).toEqual([]);
    expect((await svc.now({ hours: 24 * 120, limit: 10 })).narratives).toHaveLength(1);
  });
});

describe("readActivity", () => {
  it("calls three families with one voice each independent spread", () => {
    expect(readActivity(3, 3)).toBe("independent_spread");
  });
  it("calls many voices from one family amplification", () => {
    expect(readActivity(6, 1)).toBe("likely_amplification");
  });
  it("refuses to call two families anything confident", () => {
    expect(readActivity(2, 2)).toBe("mixed");
  });
  it("does not divide by zero", () => {
    expect(readActivity(5, 0)).toBe("mixed");
  });
});

describe("narratives are versioned like every other entity", () => {
  it("records a version on creation", async () => {
    const db = await freshDatabase();
    await narrativeService(db).createNarrative(
      { slug: "versioned", title: "A narrative", language: "en" },
      who,
    );
    const versions = await db.select().from(entityVersion);
    expect(versions.map((v) => v.entityType)).toContain("narrative");
  });

  it("carries no assessment column — a theme is not true or false", async () => {
    const db = await freshDatabase();
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'narrative'`);
    const names = cols.rows.map((c) => (c as { column_name: string }).column_name);
    expect(names).not.toContain("assessment");
    expect(names).not.toContain("confidence_summary");
  });
});

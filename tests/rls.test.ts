import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { as, assertRole, freshDatabase, violation, type TestDatabase } from "@/server/db/testing";

/**
 * Row-level security, asserted from the roles themselves.
 *
 * These are the tests the Phase 1 plan called "RLS negative tests", and they
 * are the reason `as()` refuses to run unless `current_user` actually
 * changed: `SET LOCAL ROLE` outside a transaction is a silent no-op, so a
 * suite that skipped that assertion would run every case as the table owner
 * and pass while proving nothing. Every test below would be green against a
 * database with RLS switched off entirely, were it not for `assertRole`.
 *
 * Written as "this role cannot see this row", never "the service does not
 * return it" — the service is not what stands between an anonymous reader and
 * an unpublished assessment.
 */

async function seedCorpus(db: TestDatabase) {
  const [family] = (
    await db.execute(sql`INSERT INTO source_family (slug, label) VALUES ('wire', 'Wire') RETURNING id`)
  ).rows as { id: string }[];
  const [source] = (
    await db.execute(sql`
      INSERT INTO source (source_family_id, kind, slug, name, language)
      VALUES (${family!.id}, 'manual', 'manual', 'Manual', 'en') RETURNING id`)
  ).rows as { id: string }[];

  const [publicEvidence] = (
    await db.execute(sql`
      INSERT INTO evidence (source_id, kind, title, language, data_class)
      VALUES (${source!.id}, 'article', 'A public document', 'en', 'public') RETURNING id`)
  ).rows as { id: string }[];
  const [restrictedEvidence] = (
    await db.execute(sql`
      INSERT INTO evidence (source_id, kind, title, language, data_class)
      VALUES (${source!.id}, 'document', 'A restricted document', 'en', 'restricted') RETURNING id`)
  ).rows as { id: string }[];

  const [draftItem] = (
    await db.execute(sql`
      INSERT INTO information_item (public_id, type, title, canonical_text, language)
      VALUES ('draft-item', 'claim', 'An unpublished claim', 'Still under review.', 'en') RETURNING id`)
  ).rows as { id: string }[];

  const [author] = (
    await db.execute(sql`
      INSERT INTO app_user (external_id, display_name) VALUES ('auth|author', 'Author') RETURNING id`)
  ).rows as { id: string }[];
  const [reviewer] = (
    await db.execute(sql`
      INSERT INTO app_user (external_id, display_name) VALUES ('auth|reviewer', 'Reviewer') RETURNING id`)
  ).rows as { id: string }[];

  const [publishedItem] = (
    await db.execute(sql`
      INSERT INTO information_item (public_id, type, title, canonical_text, language, created_by)
      VALUES ('published-item', 'claim', 'A published claim', 'Checked and published.', 'en', ${author!.id})
      RETURNING id`)
  ).rows as { id: string }[];

  await db.execute(sql`UPDATE information_item SET status = 'under_review' WHERE id = ${publishedItem!.id}`);
  await db.execute(sql`UPDATE information_item SET status = 'reviewed' WHERE id = ${publishedItem!.id}`);
  const [assessment] = (
    await db.execute(sql`
      INSERT INTO item_assessment (
        item_id, value, summary, known_gaps,
        confidence_evidence_coverage, confidence_source_independence, confidence_source_authority,
        confidence_media_provenance, confidence_temporal_consistency, confidence_geographic_consistency,
        confidence_contradiction_level, confidence_translation_certainty, confidence_human_review_state,
        confidence_remaining_gaps, confidence_summary, eligibility, created_by)
      VALUES (${publishedItem!.id}, 'verified', 'Corroborated.', 'None.',
        'high','high','high','not_applicable','high','high','limited','high','high','high','high','{}'::jsonb, ${author!.id})
      RETURNING id`)
  ).rows as { id: string }[];
  await db.execute(sql`UPDATE item_assessment SET approved_by = ${reviewer!.id} WHERE id = ${assessment!.id}`);
  await db.execute(
    sql`UPDATE information_item SET status = 'approved', approved_by = ${reviewer!.id} WHERE id = ${publishedItem!.id}`,
  );
  await db.execute(
    sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${publishedItem!.id}`,
  );

  return { publicEvidence: publicEvidence!.id, restrictedEvidence: restrictedEvidence!.id, draftItem: draftItem!.id, publishedItem: publishedItem!.id, reviewer: reviewer!.id };
}

describe("the harness itself", () => {
  it("actually changes role, which is what makes every test below mean anything", async () => {
    const db = await freshDatabase();
    await as(db, "app_public", "anon", async (tx) => {
      await assertRole(tx, "app_public");
    });
    await as(db, "app_staff", "staff@example.org", async (tx) => {
      await assertRole(tx, "app_staff");
    });
  });
});

describe("app_public", () => {
  it("sees a published item", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_public", "anon", async (tx) => {
      const rows = await tx.execute(sql`SELECT id FROM information_item`);
      expect(rows.rows.map((r) => (r as { id: string }).id)).toEqual([seeded.publishedItem]);
    });
  });

  it("cannot see an unpublished item", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_public", "anon", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM information_item WHERE id = ${seeded.draftItem}`,
      );
      expect(rows.rows).toEqual([]);
    });
  });

  it("cannot see restricted evidence", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_public", "anon", async (tx) => {
      const rows = await tx.execute(sql`SELECT id, data_class FROM evidence`);
      const classes = rows.rows.map((r) => (r as { data_class: string }).data_class);
      expect(classes).toEqual(["public"]);
      expect(rows.rows.map((r) => (r as { id: string }).id)).not.toContain(seeded.restrictedEvidence);
    });
  });

  it("cannot read chat transcripts at all", async () => {
    const db = await freshDatabase();
    await db.execute(sql`
      INSERT INTO chat_thread (created_by_label) VALUES ('analyst@example.org')`);
    await as(db, "app_public", "anon", async (tx) => {
      await expect(tx.execute(sql`SELECT id FROM chat_thread`)).rejects.toThrow();
    });
  });

  it("cannot read the AI cost ledger", async () => {
    const db = await freshDatabase();
    await as(db, "app_public", "anon", async (tx) => {
      await expect(tx.execute(sql`SELECT id FROM ai_run`)).rejects.toThrow();
    });
  });

  it("may submit a report but may not read any", async () => {
    const db = await freshDatabase();
    await as(db, "app_public", "anon", async (tx) => {
      await tx.execute(sql`
        INSERT INTO report (public_id, body) VALUES ('r-anon', 'Something looks wrong.')`);
    });

    /* Refused at the GRANT level, before RLS is even consulted — app_public
       holds INSERT on `report` and no SELECT at all. That is stronger than an
       empty result set: there is no policy to get wrong, because there is no
       read privilege to narrow. */
    await as(db, "app_public", "anon", async (tx) => {
      const v = await violation(tx.execute(sql`SELECT id FROM report`));
      expect(v.code, "insufficient_privilege").toBe("42501");
      expect(v.message).toMatch(/permission denied for table report/);
    });
  });

  it("cannot submit a report that claims to be already triaged", async () => {
    const db = await freshDatabase();
    await as(db, "app_public", "anon", async (tx) => {
      await expect(
        tx.execute(sql`
          INSERT INTO report (public_id, body, status)
          VALUES ('r-forged', 'Skip the queue.', 'investigating')`),
      ).rejects.toThrow();
    });
  });

  it("cannot write to an information item", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_public", "anon", async (tx) => {
      await expect(
        tx.execute(sql`UPDATE information_item SET title = 'Rewritten' WHERE id = ${seeded.publishedItem}`),
      ).rejects.toThrow();
    });
  });
});

describe("app_staff", () => {
  it("sees unpublished items", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_staff", "staff@example.org", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM information_item WHERE id = ${seeded.draftItem}`,
      );
      expect(rows.rows).toHaveLength(1);
    });
  });

  it("cannot see restricted evidence without the capability", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_staff", "staff@example.org", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM evidence WHERE id = ${seeded.restrictedEvidence}`,
      );
      expect(rows.rows, "restricted evidence needs evidence.restricted.read").toEqual([]);
    });
  });

  it("sees restricted evidence once granted the capability", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    const [cleared] = (
      await db.execute(sql`
        INSERT INTO app_user (external_id, display_name) VALUES ('auth|cleared', 'Cleared Analyst')
        RETURNING id`)
    ).rows as { id: string }[];
    await db.execute(sql`
      INSERT INTO capability_grant (user_id, capability, rationale)
      VALUES (${cleared!.id}, 'evidence.restricted.read', 'Handles sensitive material.')`);

    await as(db, "app_staff", "Cleared Analyst", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM evidence WHERE id = ${seeded.restrictedEvidence}`,
      );
      expect(rows.rows).toHaveLength(1);
    });
  });

  it("loses that access when the identity is disabled", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    const [cleared] = (
      await db.execute(sql`
        INSERT INTO app_user (external_id, display_name, disabled_at)
        VALUES ('auth|former', 'Former Analyst', now()) RETURNING id`)
    ).rows as { id: string }[];
    await db.execute(sql`
      INSERT INTO capability_grant (user_id, capability, rationale)
      VALUES (${cleared!.id}, 'evidence.restricted.read', 'Previously handled sensitive material.')`);

    await as(db, "app_staff", "Former Analyst", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM evidence WHERE id = ${seeded.restrictedEvidence}`,
      );
      expect(rows.rows, "a disabled identity keeps no access").toEqual([]);
    });
  });
});

describe("app_service", () => {
  it("may write ingested rows", async () => {
    const db = await freshDatabase();
    await as(db, "app_service", "cron:ingest", async (tx) => {
      const rows = await tx.execute(sql`
        INSERT INTO information_item (public_id, type, title, canonical_text, language)
        VALUES ('service-written', 'claim', 'Detected by a connector', 'Text.', 'en')
        RETURNING id`);
      expect(rows.rows).toHaveLength(1);
    });
  });

  it("cannot read restricted evidence, and cannot be granted the capability", async () => {
    const db = await freshDatabase();
    const seeded = await seedCorpus(db);
    await as(db, "app_service", "cron:ingest", async (tx) => {
      const rows = await tx.execute(
        sql`SELECT id FROM evidence WHERE id = ${seeded.restrictedEvidence}`,
      );
      expect(rows.rows).toEqual([]);
    });

    /* And the capability that would grant it cannot be given to an automated
       identity at all — the Phase 1 trigger refuses it. */
    const [robot] = (
      await db.execute(sql`
        INSERT INTO app_user (external_id, display_name, is_automated)
        VALUES ('svc|ingest', 'Ingest Worker', true) RETURNING id`)
    ).rows as { id: string }[];
    await expect(
      db.execute(sql`
        INSERT INTO capability_grant (user_id, capability, rationale)
        VALUES (${robot!.id}, 'evidence.restricted.read', 'Convenience.')`),
    ).rejects.toThrow();
  });
});

describe("publications under RLS", () => {
  it("hides a draft from the public and shows it to staff", async () => {
    const db = await freshDatabase();
    await db.execute(sql`
      INSERT INTO publication (kind, public_id, title, body, language)
      VALUES ('brief', 'draft-brief', 'An unpublished brief', 'Body.', 'en')`);

    await as(db, "app_public", "anon", async (tx) => {
      const rows = await tx.execute(sql`SELECT id FROM publication`);
      expect(rows.rows).toEqual([]);
    });
    await as(db, "app_staff", "staff@example.org", async (tx) => {
      const rows = await tx.execute(sql`SELECT id FROM publication`);
      expect(rows.rows).toHaveLength(1);
    });
  });
});

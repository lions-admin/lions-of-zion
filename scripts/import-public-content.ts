import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { appUser, publication, searchDocument } from "../server/db/schema";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const connectionString = requiredEnvironmentVariable("DATABASE_URL");
const configuredAdminEmail = requiredEnvironmentVariable("ADMIN_EMAIL").toLowerCase();

const pool = new Pool({ connectionString });
const database = drizzle(pool, { casing: "snake_case" });

const pages = [
  ["israels-story", "Israel’s Story", "The long arc: history, identity, and the context the noise leaves out."],
  ["geopolitical-brief", "Geopolitical Brief", "The daily strategic picture: verified developments, their context, and what they change."],
  ["war-update", "War Update", "Sourced, time-stamped updates from the front and the home front."],
  ["fake-resistance", "Fake Resistance", "Inside the influence machine: how manufactured outrage is built and amplified."],
  ["october-7", "October 7", "The record of October 7: testimony, evidence, and remembrance."],
  ["our-heroes", "Our Heroes", "The people behind the story: the fallen, the fighters, the rescuers."],
  ["we-are", "We Are", "Who Lions of Zion are, why this network exists, and how it works."],
  ["methodology", "Methodology", "How claims are sourced, labeled, and corrected across every desk."],
  ["corrections", "Corrections", "The policy for handling errors, and the public record of every correction made."],
  ["support-us", "Support Us", "Ways to join the effort: amplify verified truth, contribute skills, sustain the work."],
] as const;

async function main() {
  const [admin] = await database
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, configuredAdminEmail))
    .limit(1);
  if (!admin) {
    throw new Error("Sign in to /admin once before importing public content so the publish approval is attributable.");
  }

  for (const [slug, title, summary] of pages) {
    const canonicalUrl = `https://lionsofzion.io/${slug}`;
    const [row] = await database
      .insert(publication)
      .values({
        kind: "brief",
        publicId: `site-${slug}`,
        title,
        summary,
        body: `${summary}\n\nCanonical page: ${canonicalUrl}`,
        language: "en",
        status: "published",
        publishedAt: new Date(),
        approvedBy: admin.id,
      })
      .onConflictDoUpdate({
        target: publication.publicId,
        set: { title, summary, body: `${summary}\n\nCanonical page: ${canonicalUrl}`, updatedAt: new Date() },
      })
      .returning();
    if (!row) continue;

    await database
      .insert(searchDocument)
      .values({ entityType: "brief", entityId: row.id, title, body: `${summary}\n${canonicalUrl}`, language: "en" })
      .onConflictDoUpdate({
        target: [searchDocument.entityType, searchDocument.entityId],
        set: { title, body: `${summary}\n${canonicalUrl}`, language: "en", updatedAt: new Date() },
      });
  }
  console.log(`Imported ${pages.length} existing public pages. Embeddings remain idempotently queued by content hash.`);
}

main().finally(() => pool.end());

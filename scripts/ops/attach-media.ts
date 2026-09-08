/**
 * VA-49.3 / 49.4 — attach the approved hero images to their records.
 *
 * ## Why this does not go through the editorial package
 *
 * The obvious route — a `whole-site-update` package with `updates[].media` —
 * **cannot express a media-only change**, and finding that out is worth more
 * than the images:
 *
 *   * `updatePublicationSchema` refuses a patch in which only `changeSummary`
 *     is defined, and
 *   * `incoherentEditorialUpdate` (`publications/rules.ts`) rejects an update
 *     that "applies no change" — and **media is not among the fields it
 *     inspects**, so attaching a picture does not count as applying anything.
 *
 * So the package path would require inventing a text revision to carry the
 * image, which would append a correction to the public log describing an
 * edit that never happened. That is precisely the failure VA-46 exists to
 * prevent. Refusing to fabricate it is the point.
 *
 * ## What this does instead
 *
 * The same three steps `applyEditorial` performs internally, through the media
 * module's own public API: `materializeExternalMedia` (fetch, measure, store
 * in Blob — no database), then `insertMedia` + `attachToPublication` inside one
 * transaction. The publication row is never written, so no version row and no
 * correction entry is created — correct, because the article's text did not
 * change. `insertMedia` is idempotent on `content_hash`, so re-running this is
 * safe.
 *
 * **Known consequence, not a defect introduced here:** `mediaDisposition` stays
 * `null` on these records, because it is only ever written by a publication-row
 * write. Eleven live records already sit in that state. It is open question 4
 * in the PUXI plan and is deliberately not worked around, since the workaround
 * would be an UPDATE on a versioned table outside `recordVersion()`.
 *
 * Every image below is from `docs/reviews/production-ux-integrity/VA-49-media-proposal.md`,
 * where each licence was verified against the Commons `imageinfo` API. The Nir
 * Oz candidate was rejected by the owner on 2026-09-08 and is absent.
 *
 * Read-only by default. `--apply` performs the attachments.
 */

import { db } from "@/server/db/client";
import { mediaRepo, materializeExternalMedia } from "@/server/modules/media";
import { publications } from "@/server/modules/publications";
import { externalMediaSchema } from "@/server/contracts/external-briefing";
import { isArticleSafeMedia } from "@/server/contracts/editorial-media";
import { toEditorialMedia } from "@/server/modules/media";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL to the Production connection string for this one command.");
  process.exit(2);
}

const CLEARED = (basis: string, reference: string) => ({
  status: "cleared" as const,
  basis,
  reference,
  clearedAt: "2026-09-08",
  surfaces: ["homepage", "article"] as ("homepage" | "article")[],
});

const ATTACHMENTS = [
  {
    publicId: "be-eri-location-file-the-attack-the-failed-respo-hexu7",
    note: "The only candidate earning role:documentation — it photographs the aftermath of the event this dossier is about, at the place it names, dated.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Kibbutz_Be%27eri_after_the_massacre%2C_houses_that_were_burned_by_Hamas_%287%29.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Kibbutz_Be%27eri_after_the_massacre,_houses_that_were_burned_by_Hamas_(7).jpg",
      role: "documentation" as const,
      credit: "Tomer Persico (תומר פרסיקו) / Wikimedia Commons, CC BY-SA 3.0",
      alt: "Burned and gutted single-storey houses in Kibbutz Be'eri, photographed weeks after the 7 October 2023 attack.",
      caption: "Kibbutz Be'eri, 6 November 2023: houses burned during the 7 October attack.",
      sensitivity: "sensitive" as const,
      focalPoint: { x: 50, y: 40 },
      rights: CLEARED("CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Kibbutz_Be%27eri_after_the_massacre,_houses_that_were_burned_by_Hamas_(7).jpg"),
    },
  },
  {
    publicId: "nova-location-file-what-the-evidence-establishes-mybn8",
    note: "archival-context, deliberately not documentation: a 2025 memorial is evidence of commemoration, not of the attack. The caption's second sentence says so and is load-bearing.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Nova_Festival_Memorial_Site_Reim_Parking_Lot_-_Avney_Moreshet_-_b1cf3781.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Nova_Festival_Memorial_Site_Reim_Parking_Lot_-_Avney_Moreshet_-_b1cf3781.jpg",
      role: "archival-context" as const,
      credit: "Israel Parker (ישראל פרקר) / Avney Moreshet archive via Wikimedia Commons, CC BY-SA 4.0",
      alt: "The Nova festival memorial site in the Re'im parking lot, where the 7 October 2023 attack on the festival took place.",
      caption: "The Nova memorial at the Re'im parking lot, November 2025. The memorial marks the site; it is not a record of the attack itself.",
      sensitivity: "sensitive" as const,
      rights: CLEARED("CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Nova_Festival_Memorial_Site_Reim_Parking_Lot_-_Avney_Moreshet_-_b1cf3781.jpg"),
    },
  },
  {
    publicId: "bab-al-mandeb-and-hormuz-why-yemen-s-fighting-pu-ws71p",
    note: "The article's subject is the geography; satellite imagery of the chokepoint is data about the thing discussed, not decoration around it.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/8/85/Bab-el-Mandeb_Strait%2C_Africa-Arabia_%28ASTER%29.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Bab-el-Mandeb_Strait,_Africa-Arabia_(ASTER).jpg",
      role: "archival-context" as const,
      credit: "NASA/METI/AIST/Japan Space Systems and the U.S./Japan ASTER Science Team",
      alt: "Satellite image of the Bab-el-Mandeb strait, with Yemen on the Arabian side and Djibouti and Eritrea on the African side of the narrow passage.",
      caption: "The Bab-el-Mandeb strait, imaged by ASTER on 10 April 2017. The passage separates Yemen from Djibouti and Eritrea and carries traffic between the Red Sea and the Gulf of Aden.",
      sensitivity: "safe" as const,
      rights: CLEARED("Public domain (NASA/JPL ASTER)", "https://commons.wikimedia.org/wiki/File:Bab-el-Mandeb_Strait,_Africa-Arabia_(ASTER).jpg"),
    },
  },
  {
    publicId: "seven-turning-points-in-israel-s-story-what-the--qntuw",
    note: "PD-Israel, verified by reading the file page wikitext rather than trusting the summary tag.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Declaration_of_State_of_Israel_1948.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Declaration_of_State_of_Israel_1948.jpg",
      role: "archival-context" as const,
      credit: "Rudi Weissenstein / Government Press Office, National Photo Collection of Israel — public domain",
      alt: "David Ben-Gurion reading the Declaration of the Establishment of the State of Israel on 14 May 1948, beneath a portrait of Theodor Herzl.",
      caption: "Tel Aviv, 14 May 1948: Ben-Gurion reads the Declaration of the Establishment of the State of Israel. The first of the primary documents this article works through.",
      sensitivity: "safe" as const,
      rights: CLEARED("Public domain — PD-Israel (published 1948)", "https://commons.wikimedia.org/wiki/File:Declaration_of_State_of_Israel_1948.jpg"),
    },
  },
  {
    publicId: "official-shelter-data-available-as-tensions-rise-5csmr",
    note: "The article is about where shelters are; a photograph of the object it tells readers to locate is the thing itself. The caption's second sentence carries the article's own caveat.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1b/20260304_185748_Bomb_shelter_in_Israel.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:20260304_185748_Bomb_shelter_in_Israel.jpg",
      role: "archival-context" as const,
      credit: "Rakoon / Wikimedia Commons, CC0",
      alt: "A public bomb shelter in Israel, photographed in March 2026.",
      caption: "A public shelter in Israel, March 2026. Municipal open data lists locations like this one; it does not confirm that any given shelter is open or ready.",
      sensitivity: "safe" as const,
      focalPoint: { x: 50, y: 55 },
      rights: CLEARED("CC0 1.0", "https://commons.wikimedia.org/wiki/File:20260304_185748_Bomb_shelter_in_Israel.jpg"),
    },
  },
  {
    publicId: "ben-gurion-university-team-develops-aerogel-that-0y2we",
    note: "LOWEST CONFIDENCE, and the proposal says so. A campus aerial is location photography of the institution and tells a reader nothing about an aerogel; the caption has to state what the picture is not. Attached on the owner's instruction; `--skip-bgu` leaves it off.",
    media: {
      inputUrl: "https://upload.wikimedia.org/wikipedia/commons/6/64/Ben_Gurion_university_and_Health_sciences_campus.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ben_Gurion_university_and_Health_sciences_campus.jpg",
      role: "archival-context" as const,
      credit: "Omer berner / Wikimedia Commons, CC BY-SA 4.0",
      alt: "Aerial view of the Ben-Gurion University of the Negev campus and health sciences campus in Be'er Sheva.",
      caption: "Ben-Gurion University of the Negev, Be'er Sheva. The aerogel result described here was produced by a BGU team; this photograph shows the institution, not the experiment.",
      sensitivity: "safe" as const,
      rights: CLEARED("CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Ben_Gurion_university_and_Health_sciences_campus.jpg"),
    },
  },
];

const APPLY = process.argv.includes("--apply");
const SKIP_BGU = process.argv.includes("--skip-bgu");
const RUN_ID = `ops-media-${new Date().toISOString().slice(0, 10)}`;

async function main() {
  const service = publications();
  let failures = 0;
  let attached = 0;

  for (const entry of ATTACHMENTS) {
    if (SKIP_BGU && entry.publicId.startsWith("ben-gurion")) {
      console.log(`SKIP  ${entry.publicId}\n      --skip-bgu\n`);
      continue;
    }
    try {
      const row = await service.resolveEditorialTarget({ publicId: entry.publicId });
      const existing = await mediaRepo(db()).heroMedia(row.id);
      if (existing) {
        console.log(`SKIP  ${entry.publicId}\n      already carries a hero\n`);
        continue;
      }

      /* Parsed against the real contract before any network work, so a bad
         rights block fails here rather than after an upload. */
      const parsed = externalMediaSchema.parse(entry.media);
      console.log(`${APPLY ? "ATTACH" : "would attach"}  ${entry.publicId}`);
      console.log(`  role    ${parsed.role} · ${parsed.rights.basis}`);
      console.log(`  why     ${entry.note}`);

      if (!APPLY) { console.log(""); continue; }

      const draft = await materializeExternalMedia(parsed, {
        runId: RUN_ID,
        candidateKey: entry.publicId,
        composer: "ops:va-49-media",
      });

      await db().transaction(async (tx) => {
        const store = mediaRepo(tx);
        const asset = await store.insertMedia(draft);
        const projected = toEditorialMedia(asset);
        /* The same gate `applyEditorial` applies before it will publish an
           image: if the article page would refuse to render it, do not attach
           it. */
        if (!projected || !isArticleSafeMedia(projected)) {
          throw new Error("the stored asset is not article-safe — refusing to attach");
        }
        await store.attachToPublication(row.id, asset.id, "hero");
      });
      attached += 1;
      console.log(`  attached (${draft.width}×${draft.height})\n`);
    } catch (cause) {
      failures += 1;
      console.error(`FAILED ${entry.publicId}: ${(cause as Error).message}\n`);
    }
  }

  console.log(APPLY ? `${attached} attached, ${failures} failed.` : "DRY RUN. Nothing was changed. Re-run with --apply.");
  if (failures) process.exit(1);
}

void main();

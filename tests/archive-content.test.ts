import { describe, expect, it } from "vitest";
import {
  type ArchivePackageName,
  assetSrcSet,
  assetUrl,
  getIndex,
  getManifest,
  getMediaRegistry,
  getRecord,
  pickVersion,
} from "@/lib/content/archive";
import {
  DOCUMENTATION_PACKAGE,
  UNCATEGORISED,
  categorySlug,
  documentationLocaleParams,
  documentationParams,
  getDocumentationGroups,
} from "@/lib/content/documentation";
import {
  TESTIMONIES_PACKAGE,
  getTestimonyIndex,
  testimonyLocaleParams,
  testimonyParams,
} from "@/lib/content/testimonies";

const PACKAGES: ArchivePackageName[] = [TESTIMONIES_PACKAGE, DOCUMENTATION_PACKAGE];

/**
 * The archive routes prerender ~1,177 pages straight from imported JSON. A
 * broken reference does not fail loudly at runtime here — it either crashes a
 * production build or, worse, renders a record with a hole in it. These tests
 * are what catch that at the seam instead.
 */
describe("archive packages", () => {
  it.each(PACKAGES)("%s: the index matches its manifest", async (pkg) => {
    const [manifest, index] = await Promise.all([getManifest(pkg), getIndex(pkg)]);
    expect(index.length).toBe(manifest.counts.records);
    expect(index.length).toBeGreaterThan(0);
  });

  it.each(PACKAGES)("%s: every index entry carries a readable title", async (pkg) => {
    /* Only one of the two source pipelines writes `title` onto the group, so
       the importer takes it from each record instead. When it did not, the
       index rendered 179 slugs — structurally valid and useless to read. */
    const index = await getIndex(pkg);
    const untitled = index.filter((entry) => !entry.title).map((entry) => entry.id);
    expect(untitled).toEqual([]);

    const slugAsTitle = index.filter((entry) => entry.title === entry.id).map((e) => e.id);
    expect(slugAsTitle).toEqual([]);

    /* Nine source titles were the page's <title> tag verbatim, dragging the
       site's own chrome into the index. The importer strips exactly those two
       suffixes; this keeps them stripped across re-imports. */
    const withChrome = index
      .filter((entry) => /October7\s+(Blog|Nova\s*Fest)\s*$/i.test(entry.title ?? ""))
      .map((e) => e.id);
    expect(withChrome).toEqual([]);
  });

  it.each(PACKAGES)("%s: every id is unique and route-safe", async (pkg) => {
    const index = await getIndex(pkg);
    const ids = index.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      /* The same shape the schema enforces, and the reason the importer
         normalises source slugs: some were 309 characters and percent-encoded. */
      expect(id).toMatch(/^[a-z0-9À-ɏ-]+$/);
      expect(Buffer.byteLength(id)).toBeLessThanOrEqual(255);
    }
  });

  it.each(PACKAGES)("%s: every record resolves and carries its default language", async (pkg) => {
    const index = await getIndex(pkg);
    for (const entry of index) {
      const record = await getRecord(pkg, entry.id);
      expect(record, `missing record ${entry.id}`).not.toBeNull();
      expect(record!.versions[record!.default_language]).toBeDefined();
      expect(entry.languages).toContain(entry.defaultLanguage);
    }
  });
});

describe("archive media references", () => {
  it.each(PACKAGES)("%s: every block media_id resolves", async (pkg) => {
    const [index, media] = await Promise.all([getIndex(pkg), getMediaRegistry(pkg)]);
    const unresolved: string[] = [];

    for (const entry of index) {
      const record = await getRecord(pkg, entry.id);
      for (const version of Object.values(record!.versions)) {
        for (const block of version.content_blocks) {
          if (block.media_id && !media.has(block.media_id)) {
            unresolved.push(`${version.story_id}:${block.media_id}`);
          }
          if (block.thumbnail_media_id && !media.has(block.thumbnail_media_id)) {
            unresolved.push(`${version.story_id}:${block.thumbnail_media_id}`);
          }
        }
      }
    }

    expect(unresolved).toEqual([]);
  });

  it.each(PACKAGES)("%s: every locally held video has a poster", async (pkg) => {
    const [index, media] = await Promise.all([getIndex(pkg), getMediaRegistry(pkg)]);
    const missing: string[] = [];

    for (const entry of index) {
      const record = await getRecord(pkg, entry.id);
      for (const version of Object.values(record!.versions)) {
        for (const block of version.content_blocks) {
          if (block.type !== "video" || !block.media_id) continue;
          const item = media.get(block.media_id);
          /* The two YouTube-hosted videos have no file and no poster by
             design; the renderer states that rather than showing a gap. */
          if (!item?.package_path) continue;
          const poster = block.thumbnail_media_id ?? item.thumbnail_media_id;
          if (!poster) missing.push(`${version.story_id}:${block.media_id}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("only the two external videos lack a file, and they say why", async () => {
    const media = await getMediaRegistry(TESTIMONIES_PACKAGE);
    const external = [...media.values()].filter((item) => !item.package_path);

    expect(external).toHaveLength(2);
    for (const item of external) {
      expect(item.validation_status).toBe("external-reference");
      expect(item.external_platform).toBeTruthy();
    }
  });

  it.each(PACKAGES)("%s: srcset entries all point inside the package", async (pkg) => {
    const media = await getMediaRegistry(pkg);
    for (const item of media.values()) {
      for (const variant of item.web_variants ?? []) {
        /* Relative paths are what let the same package serve from a CDN or a
           local symlink. An absolute one would pin it to one machine. */
        expect(variant.path.startsWith("/")).toBe(false);
        expect(variant.path).toMatch(/^assets\//);
      }
    }
  });
});

describe("asset URLs", () => {
  it("strips the package's assets/ prefix and keeps the rest", () => {
    expect(assetUrl("october7", "assets/web/images/ab/x-w480.webp")).toBe(
      "/archive/october7/web/images/ab/x-w480.webp",
    );
  });

  it("builds a srcset only when the source had variants", async () => {
    const media = await getMediaRegistry(TESTIMONIES_PACKAGE);
    const withVariants = [...media.values()].find((m) => m.web_variants?.length);
    const without = [...media.values()].find((m) => !m.web_variants?.length);

    expect(assetSrcSet("october7", withVariants!)).toContain(" 480w");
    expect(assetSrcSet("october7", without!)).toBe("");
  });
});

describe("record lookup is not a file path", () => {
  it.each([
    "../../../etc/passwd",
    "..%2f..%2fsecrets",
    "foo/bar",
    "UPPERCASE",
  ])("refuses %s", async (id) => {
    await expect(getRecord(TESTIMONIES_PACKAGE, id)).resolves.toBeNull();
  });

  it("returns null for an id that simply is not there", async () => {
    await expect(getRecord(TESTIMONIES_PACKAGE, "no-such-record")).resolves.toBeNull();
  });
});

describe("route parameters", () => {
  it("testimonies build one page per record plus each extra language", async () => {
    const [index, base, locales] = await Promise.all([
      getIndex(TESTIMONIES_PACKAGE),
      testimonyParams(),
      testimonyLocaleParams(),
    ]);

    expect(base).toHaveLength(index.length);

    const extra = index.reduce((sum, entry) => sum + entry.languages.length - 1, 0);
    expect(locales).toHaveLength(extra);
  });

  it("documentation builds one page per record plus each extra language", async () => {
    const [index, base, locales] = await Promise.all([
      getIndex(DOCUMENTATION_PACKAGE),
      documentationParams(),
      documentationLocaleParams(),
    ]);

    expect(base).toHaveLength(index.length);
    const extra = index.reduce((sum, entry) => sum + entry.languages.length - 1, 0);
    expect(locales).toHaveLength(extra);
  });

  it("never emits a locale route for a record's default language", async () => {
    /* Two URLs for one version would compete for a single canonical, so the
       bare route owns the default and this route owns everything else. */
    const [index, testimonies, documentation] = await Promise.all([
      getIndex(TESTIMONIES_PACKAGE),
      testimonyLocaleParams(),
      documentationLocaleParams(),
    ]);
    const defaults = new Map(index.map((entry) => [entry.id, entry.defaultLanguage]));

    for (const param of testimonies) {
      expect(param.locale).not.toBe(defaults.get(param.slug));
    }

    const docIndex = await getIndex(DOCUMENTATION_PACKAGE);
    const docDefaults = new Map(docIndex.map((entry) => [entry.id, entry.defaultLanguage]));
    for (const param of documentation) {
      expect(param.locale).not.toBe(docDefaults.get(param.slug));
    }
  });

  it("gives the uncategorised record a reachable route", async () => {
    /* The source published one record with no category. Rule 4 forbids
       inventing one, so the route files it under a literal segment — without
       which it would be unreachable. */
    const index = await getIndex(DOCUMENTATION_PACKAGE);
    const loose = index.filter((entry) => !entry.category);
    expect(loose.length).toBeGreaterThan(0);

    const params = await documentationParams();
    for (const entry of loose) {
      expect(params).toContainEqual({ category: UNCATEGORISED, slug: entry.id });
    }
    expect(categorySlug(null)).toBe(UNCATEGORISED);
  });

  it("every record appears in exactly one documentation group", async () => {
    const [groups, index] = await Promise.all([
      getDocumentationGroups(),
      getIndex(DOCUMENTATION_PACKAGE),
    ]);

    const seen = groups.flatMap((group) => group.records.map((r) => r.id));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(index.length);
  });
});

describe("the two archives share one contract", () => {
  it("documentation block types are a subset of testimony block types", async () => {
    const collect = async (pkg: ArchivePackageName) => {
      const index = await getIndex(pkg);
      const types = new Set<string>();
      for (const entry of index) {
        const record = await getRecord(pkg, entry.id);
        for (const version of Object.values(record!.versions)) {
          for (const block of version.content_blocks) types.add(block.type);
        }
      }
      return types;
    };

    const [testimony, documentation] = await Promise.all([
      collect(TESTIMONIES_PACKAGE),
      collect(DOCUMENTATION_PACKAGE),
    ]);

    /* This is what lets one renderer serve both with no branching. If it ever
       fails, the renderer needs a new case before the import lands. */
    for (const type of documentation) {
      expect(testimony.has(type)).toBe(true);
    }
  });

  it("picks the default version when no locale is asked for", async () => {
    const index = await getTestimonyIndex();
    const multi = index.find((entry) => entry.languages.length > 1)!;
    const record = await getRecord(TESTIMONIES_PACKAGE, multi.id);

    expect(pickVersion(record!).locale).toBe(record!.default_language);
    const other = multi.languages.find((l) => l !== multi.defaultLanguage)!;
    expect(pickVersion(record!, other).locale).toBe(other);
  });
});

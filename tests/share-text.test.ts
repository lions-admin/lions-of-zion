import { describe, expect, it } from "vitest";
import {
  SHARE_ATTRIBUTION,
  SHARE_CTA,
  TEASER_QUOTE_MAX,
  TCO_URL_WEIGHT,
  X_POST_LIMIT,
  buildShareQuote,
  buildXShareText,
  facebookShareUrl,
  stripSourceBreadcrumb,
  xIntentUrl,
  xWeightedLength,
} from "@/lib/content/share-text";

/**
 * The share text is generated from testimony, so the failure mode this file
 * guards is not "the post is too long" — it is a quote cut mid-sentence in a
 * survivor's account. Every assertion below is about a boundary.
 */

/** What a whole post costs: the quote block plus the link X appends. */
const postWeight = (text: string) =>
  xWeightedLength(text) + 1 + TCO_URL_WEIGHT;

describe("X weighting", () => {
  it("counts Latin, Hebrew and Cyrillic at one", () => {
    expect(xWeightedLength("abc")).toBe(3);
    expect(xWeightedLength("שלום")).toBe(4);
    expect(xWeightedLength("привет")).toBe(6);
  });

  it("counts CJK at two, which is why String.length is not enough", () => {
    expect(xWeightedLength("日本語")).toBe(6);
    expect("日本語".length).toBe(3);
  });

  it("counts an emoji once as a code point, not twice as UTF-16 units", () => {
    /* "🕯".length is 2; iterating code points is what keeps a post that
       renders as one glyph from being charged as two characters of four. */
    expect(xWeightedLength("🕯")).toBe(2);
  });

  it("treats curly quotes and dashes as weight one", () => {
    /* The archive's own copy is full of these — a "…" charged at 2 would
       silently shrink every quote. */
    expect(xWeightedLength("“—’")).toBe(3);
  });
});

describe("buildShareQuote — sentence boundaries", () => {
  const three = "First sentence here. Second sentence here. Third sentence here.";

  it("returns the whole text when it already fits", () => {
    expect(buildShareQuote(three, 200)).toBe(three);
  });

  it("stops at a sentence boundary rather than mid-sentence", () => {
    const quote = buildShareQuote(three, 45);
    expect(quote).toBe("First sentence here. Second sentence here.");
    expect(quote.endsWith(".")).toBe(true);
  });

  it("keeps only the first sentence when the second does not fit", () => {
    expect(buildShareQuote(three, 25)).toBe("First sentence here.");
  });

  it("never emits a partial word", () => {
    const text =
      "We ran towards the shelter as the sirens began. Nobody spoke for a long time.";
    for (let budget = 10; budget <= 80; budget += 1) {
      const quote = buildShareQuote(text, budget);
      if (!quote) continue;
      const stripped = quote.replace(/…$/, "").trim();
      /* Every word in the result must be a whole word from the source. */
      for (const word of stripped.split(" ")) {
        expect(text.includes(word)).toBe(true);
      }
      expect(xWeightedLength(quote)).toBeLessThanOrEqual(budget);
    }
  });

  it("falls back to a clause boundary when no whole sentence fits", () => {
    const text =
      "The blinds were shut, the doors were locked, and nobody made a sound at all.";
    const quote = buildShareQuote(text, 48);
    expect(quote).toBe("The blinds were shut, the doors were locked…");
    expect(xWeightedLength(quote)).toBeLessThanOrEqual(48);
  });

  it("does not leave the clause separator hanging before the ellipsis", () => {
    const text = "The blinds were shut, the doors were locked, and nobody spoke.";
    const quote = buildShareQuote(text, 30);
    expect(quote).toBe("The blinds were shut…");
    expect(quote).not.toContain(",…");
  });

  it("falls back to whole words when there is no clause boundary either", () => {
    const text = "A single very long unbroken sentence with no punctuation anywhere";
    const quote = buildShareQuote(text, 20);
    expect(quote.endsWith("…")).toBe(true);
    expect(quote.replace(/…$/, "").split(" ").every((w) => text.includes(w))).toBe(true);
    expect(xWeightedLength(quote)).toBeLessThanOrEqual(20);
  });

  it("returns nothing rather than a fragment when not even one word fits", () => {
    expect(buildShareQuote("Extraordinarily", 3)).toBe("");
    expect(buildShareQuote("anything", 0)).toBe("");
  });

  it("collapses the newlines and runs of space the records are full of", () => {
    expect(buildShareQuote("One.\n\n  Two.\tThree.", 100)).toBe("One. Two. Three.");
  });

  it("handles a Japanese full stop as a sentence boundary", () => {
    /* 661 of the 1,175 versions are not English, and seven of the archive's
       locales are. A boundary rule that only knew "." would cut these by
       word or not at all. */
    const text = "最初の文です。二番目の文です。三番目の文です。";
    const quote = buildShareQuote(text, 30);
    expect(quote).toBe("最初の文です。二番目の文です。");
    expect(xWeightedLength(quote)).toBeLessThanOrEqual(30);
  });

  it("does not insert spacing the witness did not write", () => {
    /* The quote is sliced out of the original rather than rejoined from
       pieces, so Japanese sentences stay run together as published. */
    const text = "最初の文です。二番目の文です。三番目の文です。";
    expect(buildShareQuote(text, 30)).not.toContain(" ");
  });

  it("keeps a closing quotation mark with its sentence", () => {
    const text = '“At least we die together.” That is what I said. And we ran.';
    expect(buildShareQuote(text, 30)).toBe("“At least we die together.”");
  });
});

describe("buildXShareText — the whole post fits 280", () => {
  const long =
    "We woke to the sound of the red alert siren and ran to the safe room. " +
    "The children were still asleep when it began. I held the handle shut " +
    "with both hands for six hours while my husband spoke to them quietly. " +
    "Nobody came for a very long time, and we did not know if anyone would.";

  it("fits inside the limit once the t.co link is counted", () => {
    const text = buildXShareText({ title: "A testimony", text: long });
    expect(postWeight(text)).toBeLessThanOrEqual(X_POST_LIMIT);
  });

  it("closes with the line that sends the reader to the archive", () => {
    const text = buildXShareText({ title: "A testimony", text: long });
    expect(text.endsWith(`\n\n${SHARE_CTA.testimony}`)).toBe(true);
    // The colon is what the appended t.co link reads as following on from.
    expect(text.endsWith(":")).toBe(true);
  });

  it("names the right thing for each archive", () => {
    const testimony = buildXShareText({ title: "T", text: long, kind: "testimony" });
    const record = buildXShareText({ title: "T", text: long, kind: "record" });
    expect(testimony).toContain("full testimony");
    expect(record).toContain("full record");
  });

  it("quotes the record's words so the post is not read as the sharer's", () => {
    const text = buildXShareText({ title: "A testimony", text: long });
    expect(text.startsWith("\u201c")).toBe(true);
    expect(text.split("\n")[0].endsWith("\u201d")).toBe(true);
  });

  it("ends the quote at a sentence, not mid-word", () => {
    const [first] = buildXShareText({ title: "A testimony", text: long }).split("\n");
    const quote = first.slice(1, -1); // strip the quote marks
    expect(quote.endsWith(".")).toBe(true);
    expect(long).toContain(quote);
  });

  it("teases rather than delivers — the quote stops short of the budget", () => {
    /* The point of the change (owner instruction, 2026-08-27): the post is a
       hook plus a link, not the record itself. A quote that fills every
       available unit hands the reader the whole thing and removes the reason
       to follow the link. */
    const [first] = buildXShareText({ title: "T", text: long }).split("\n");
    expect(xWeightedLength(first.slice(1, -1))).toBeLessThanOrEqual(TEASER_QUOTE_MAX);
  });

  it("never opens a shared post with the source site's breadcrumb", () => {
    /* 367 of the 505 october7 versions carry october7.org's nav as their
       first paragraph. The reader never sees it and neither should a post —
       a share is the one copy of a record that travels out of reach. */
    const withCrumb =
      "October 7\n>\nGaza Border Communities\n> Testimony of Noam G\n\n" +
      "Saturday, October 7th, 2023. Alarms were going off on my phone.";
    const text = buildXShareText({ title: "A testimony", text: withCrumb });
    expect(text.startsWith("\u201cSaturday, October 7th, 2023.")).toBe(true);
    expect(text).not.toContain(">");
    expect(text).not.toContain("Gaza Border Communities");
  });

  it("leaves a record that has no breadcrumb untouched", () => {
    const clean = "My name is Dorin C., from Kfar Aza. This was our home.";
    const text = buildXShareText({ title: "T", text: clean });
    expect(text).toBe(`\u201c${clean}\u201d\n\n${SHARE_CTA.testimony}`);
  });

  it("does not mistake a mid-record '>' for the breadcrumb", () => {
    const text = stripSourceBreadcrumb("A real paragraph.\n\nThen a\n> quoted line.");
    expect(text).toContain("A real paragraph.");
  });

  it("falls back to the title when the record has no body text", () => {
    const text = buildXShareText({ title: "From heaven to hell", text: null });
    expect(text).toBe(`\u201cFrom heaven to hell\u201d\n\n${SHARE_CTA.testimony}`);
  });

  it("falls back to the title when the body is only whitespace", () => {
    const text = buildXShareText({ title: "From heaven to hell", text: "   \n " });
    expect(text.startsWith("\u201cFrom heaven to hell")).toBe(true);
  });

  it("still fits when the record is in a double-weight script", () => {
    const japanese = "最初の文です。".repeat(60);
    const text = buildXShareText({ title: "証言", text: japanese });
    expect(postWeight(text)).toBeLessThanOrEqual(X_POST_LIMIT);
  });

  it("fits for every record-shaped input, however long", () => {
    const sizes = [1, 40, 200, 500, 5000];
    for (const size of sizes) {
      const body = "This is a sentence of the record. ".repeat(size);
      const text = buildXShareText({ title: "T", text: body });
      expect(postWeight(text)).toBeLessThanOrEqual(X_POST_LIMIT);
    }
  });
});

describe("intent URLs", () => {
  const url = "https://lionsofzion.io/october-7/testimonies/from-heaven-to-hell";

  it("puts the text and the url in the X post intent", () => {
    const href = xIntentUrl("A quote\n— Lions of Zion archive", url);
    const parsed = new URL(href);
    expect(parsed.origin + parsed.pathname).toBe("https://x.com/intent/post");
    expect(parsed.searchParams.get("url")).toBe(url);
    expect(parsed.searchParams.get("text")).toBe("A quote\n— Lions of Zion archive");
  });

  it("gives Facebook the link only — its text comes from the OG tags", () => {
    const href = facebookShareUrl(url);
    const parsed = new URL(href);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.facebook.com/sharer/sharer.php",
    );
    expect(parsed.searchParams.get("u")).toBe(url);
    expect([...parsed.searchParams.keys()]).toEqual(["u"]);
  });
});

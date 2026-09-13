/**
 * What travels with a shared archive file (owner instruction, 2026-09-13).
 *
 * The regression these tests exist for: the archive shared `{ files }` and
 * nothing else, so a reader who chose X from the system sheet arrived holding a
 * video with no title and no way back to the record. The caption is now part of
 * the payload, and these tests pin both halves of that — the text itself, and
 * the decision about whether this browser will carry it.
 */
import { describe, expect, it } from "vitest";
import { chooseMediaSharePayload } from "@/lib/content/media-share";
import { buildMediaShareText, X_POST_LIMIT, TCO_URL_WEIGHT, xWeightedLength } from "@/lib/content/share-text";

const URL_UNDER_TEST = "https://lionsofzion.io/october-7/documentation/a-record";
const file = () => new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });

describe("the caption that travels with a shared file", () => {
  it("carries the title and the link, in that order", () => {
    const text = buildMediaShareText("Aftermath of the attack on the festival car park", URL_UNDER_TEST);

    expect(text).toBe(`Aftermath of the attack on the festival car park\n${URL_UNDER_TEST}`);
  });

  it("keeps the whole post inside the 280-weight account, link cost included", () => {
    const text = buildMediaShareText("נ".repeat(400), URL_UNDER_TEST);
    const [title] = text.split("\n");

    expect(xWeightedLength(title!) + TCO_URL_WEIGHT).toBeLessThanOrEqual(X_POST_LIMIT);
  });

  it("never cuts inside a word", () => {
    const text = buildMediaShareText(`${"documented ".repeat(40)}testimony`, URL_UNDER_TEST);
    const [title] = text.split("\n");

    expect(title).not.toMatch(/documente…?$/);
    expect(title!.replace(/[…\s]+$/, "").endsWith("documented")).toBe(true);
  });

  it("still produces a caption when the title is a single unbroken run", () => {
    const text = buildMediaShareText("x".repeat(400), URL_UNDER_TEST);

    expect(text.split("\n")[0]!.length).toBeGreaterThan(0);
    expect(text.endsWith(URL_UNDER_TEST)).toBe(true);
  });
});

describe("choosing what this browser will actually accept", () => {
  it("sends the file with its caption when the browser takes both", () => {
    const payload = chooseMediaSharePayload(file(), "caption", () => true);

    expect(payload).toMatchObject({ text: "caption" });
    expect(payload?.files).toHaveLength(1);
  });

  it("falls back to the file alone rather than refusing the share", () => {
    const payload = chooseMediaSharePayload(file(), "caption", (data) => !("text" in data));

    expect(payload).not.toBeNull();
    expect(payload?.text).toBeUndefined();
    expect(payload?.files).toHaveLength(1);
  });

  it("reports nothing shareable when files themselves are refused", () => {
    expect(chooseMediaSharePayload(file(), "caption", () => false)).toBeNull();
  });

  it("attempts the caption on an implementation with no canShare to ask", () => {
    const payload = chooseMediaSharePayload(file(), "caption", undefined);

    expect(payload).toMatchObject({ text: "caption" });
  });
});

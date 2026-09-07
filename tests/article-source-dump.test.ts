import { describe, expect, it } from "vitest";
import { stripSourceDump } from "@/lib/source-dump";
import { publicSourceState } from "@/app/articles/[publicId]/page";

/**
 * VA-56 — the structured stack is the reader-facing source presentation, so
 * article prose must not also print the composer's raw block.
 *
 * The hard constraint, and the reason most of these tests are refusals: a page
 * may never print a citation and then deny having sources. `publicSourceState`
 * reads the body for absolute URLs precisely to catch that. So stripping is
 * only permitted when the information survives in the structured stack, and
 * every uncertain case returns the body untouched.
 */

const STACK = [
  "https://www.reuters.com/world/middle-east/example-2026-09-06/",
  "https://apnews.com/article/abc123",
];

const PROSE = "The account as filed.\n\nA second paragraph with the substance.";

describe("a trailing dump goes when the stack already carries it", () => {
  it("removes a heading and its address list", () => {
    const body = `${PROSE}\n\nSources:\n- ${STACK[0]}\n- ${STACK[1]}`;
    expect(stripSourceDump(body, STACK)).toBe(PROSE);
  });

  it("accepts the heading's common spellings and decorations", () => {
    for (const heading of ["Sources", "sources:", "**Sources:**", "## References", "Links:"]) {
      const body = `${PROSE}\n\n${heading}\n${STACK[0]}`;
      expect(stripSourceDump(body, STACK)).toBe(PROSE);
    }
  });

  it("accepts the labelled shape live records actually use", () => {
    // The real form on Production: a publisher, a date, then the address.
    const body = `${PROSE}\n\nSources:\n- Reuters, September 6, 2026: ${STACK[0]}\n- AP, September 6, 2026: ${STACK[1]}`;
    expect(stripSourceDump(body, STACK)).toBe(PROSE);
  });

  it("keeps a block whose lines are prose rather than citations", () => {
    const body = `${PROSE}\n\nSources:\nThe desk reviewed wire copy and two ministry statements.`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("ignores a Sources heading that is not the trailing block", () => {
    const body = `Sources:\n- ${STACK[0]}\n\nThe article continues well past that point and ends in prose.`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("accepts numbered and bulleted address lines", () => {
    const body = `${PROSE}\n\nSources:\n1. ${STACK[0]}\n2) ${STACK[1]}`;
    expect(stripSourceDump(body, STACK)).toBe(PROSE);
  });

  it("matches an address regardless of www, scheme, query or trailing slash", () => {
    const body = `${PROSE}\n\nSources:\n- http://reuters.com/world/middle-east/example-2026-09-06?utm=x`;
    expect(stripSourceDump(body, STACK)).toBe(PROSE);
  });
});

describe("it refuses whenever information could be lost", () => {
  it("keeps the block when the stack is empty", () => {
    const body = `${PROSE}\n\nSources:\n- ${STACK[0]}`;
    expect(stripSourceDump(body, [])).toBe(body);
  });

  it("keeps the block when it names an address the stack does not have", () => {
    const body = `${PROSE}\n\nSources:\n- ${STACK[0]}\n- https://example.com/not-in-the-stack`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("keeps a closing address that has no heading above it", () => {
    const body = `${PROSE}\n\n${STACK[0]}`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("keeps an inline citation inside a sentence", () => {
    const body = `${PROSE}\n\nReuters reported the figure at ${STACK[0]} on the day.`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("keeps a markdown link a writer put in the prose", () => {
    const body = `${PROSE}\n\nSee [the wire report](${STACK[0]}) for the full text.`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("never returns an empty article when the body was only a dump", () => {
    const body = `Sources:\n- ${STACK[0]}`;
    expect(stripSourceDump(body, STACK)).toBe(body);
  });

  it("leaves a body with no block alone", () => {
    expect(stripSourceDump(PROSE, STACK)).toBe(PROSE);
    expect(stripSourceDump("", STACK)).toBe("");
  });
});

describe("stripping can never flip the visible source state", () => {
  it("keeps the state 'listed' after a dump is removed", () => {
    const body = `${PROSE}\n\nSources:\n- ${STACK[0]}\n- ${STACK[1]}`;
    const stripped = stripSourceDump(body, STACK);

    expect(stripped).not.toContain("https://");
    // The stack is non-empty, so the state is decided before the body is read.
    expect(publicSourceState({ sourceCount: STACK.length, isAnalysis: false, body: stripped })).toBe("listed");
  });

  it("leaves a stackless record 'pending' rather than making it 'unsourced'", () => {
    const body = `${PROSE}\n\nSources:\n- ${STACK[0]}`;
    const stripped = stripSourceDump(body, []);

    expect(stripped).toBe(body);
    expect(publicSourceState({ sourceCount: 0, isAnalysis: false, body: stripped })).toBe("pending");
  });
});

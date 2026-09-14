/**
 * The search panel's result status — VA-17.
 *
 * The audit's finding was that a phone reader meets the query field and then
 * developer chrome, and that the two sentences describing the answer sat in a
 * footer below the whole answer. At 375 an eight-result set put that footer
 * 2,166px down the document, so "semantic matching is unavailable in this
 * deployment" was rendered where nobody reads it.
 *
 * `resultStatus` is the pure half of the fix, and these are the cases that a
 * screenshot cannot pin: which states get a count, which state gets no
 * matcher sentence at all, and that an empty answer is left to the empty
 * state rather than being told twice.
 */
import { describe, expect, it } from "vitest";
import { resultStatus } from "@/components/search/vocabulary";

describe("resultStatus", () => {
  it("counts an answered result set and names the query it answers", () => {
    expect(resultStatus("results", 8, "Haifa").count).toBe("8 results for “Haifa”");
  });

  it("says result, not results, for one", () => {
    expect(resultStatus("results", 1, "Haifa").count).toBe("1 result for “Haifa”");
  });

  it("omits the query when none was echoed back", () => {
    expect(resultStatus("results", 3, "").count).toBe("3 results");
  });

  it("leaves an empty answer to the empty state rather than saying zero", () => {
    /* `PanelEmpty` already names the query in a full sentence. "0 results for
       X" above it is the same fact twice, in two registers. */
    expect(resultStatus("no-results", 0, "Haifa").count).toBeNull();
  });

  it.each(["idle", "loading", "invalid-query", "error"] as const)(
    "shows no count in %s, where there is no answer to count",
    (state) => {
      expect(resultStatus(state, 0, "").count).toBeNull();
    },
  );

  it("keeps a carried result set from being counted while a newer query loads", () => {
    /* `useSearch` keeps the previous hits on screen, dimmed, during the next
       request. Counting them would attach the old total to the new query. */
    expect(resultStatus("loading", 8, "Haifa").count).toBeNull();
  });

  it("attaches no capability note to a full answer, or to the wait for one", () => {
    /* UX-28. "Matching on words, names and meaning." rendered above every
       state, including the pending one — a capability note nobody asked for,
       over "Searching…". A full answer needs no caveat. */
    expect(resultStatus("results", 2, "Haifa").matching).toBeNull();
    expect(resultStatus("loading", 0, "").matching).toBeNull();
    expect(resultStatus("idle", 0, "").matching).toBeNull();
    expect(resultStatus("no-results", 0, "Haifa").matching).toBeNull();
  });

  it("states plainly that a fallback answer had no semantic arm", () => {
    expect(resultStatus("fallback", 2, "Haifa").matching).toBe(
      "Showing word-and-name matches. Semantic matching is unavailable in this deployment.",
    );
  });

  it("says which window of a paged answer is on screen", () => {
    /* "25 results" was a true statement about the response and a false one
       about the reader's situation: nineteen could not be opened and the
       twenty-five were all there would ever be, because nothing could page.
       Both halves are honest now. */
    expect(
      resultStatus("results", 10, "October 7", { offset: 10, total: 34, totalIsFloor: false }).count,
    ).toBe("Showing 11\u201320 of 34 results for \u201cOctober 7\u201d");
  });

  it("counts a short last page by what is actually on it", () => {
    expect(
      resultStatus("results", 4, "October 7", { offset: 30, total: 34, totalIsFloor: false }).count,
    ).toBe("Showing 31\u201334 of 34 results for \u201cOctober 7\u201d");
  });

  it("keeps the plain count when the whole answer fits on one page", () => {
    /* No pager renders, so "Showing 1\u20137 of 7" would be arithmetic about a
       control the reader cannot see. */
    expect(
      resultStatus("results", 7, "Haifa", { offset: 0, total: 7, totalIsFloor: false }).count,
    ).toBe("7 results for \u201cHaifa\u201d");
  });

  it("says a ceiling is a floor rather than printing it as a total", () => {
    /* Retrieval has a candidate ceiling. "of 200" would be an invented number
       of the same kind as showing the RRF score as a confidence. */
    expect(
      resultStatus("results", 10, "Israel", { offset: 0, total: 200, totalIsFloor: true }).count,
    ).toBe("Showing 1\u201310 of at least 200 results for \u201cIsrael\u201d");
  });

  it("leaves an empty answer to the empty state, paged or not", () => {
    expect(
      resultStatus("no-results", 0, "Haifa", { offset: 0, total: 0, totalIsFloor: false }).count,
    ).toBeNull();
  });

  it("claims no matcher at all when the search failed", () => {
    /* A request that did not complete matched nothing. Printing "matching on
       words and names" above "The search failed" describes a capability the
       reader did not get. */
    const status = resultStatus("error", 0, "Haifa");
    expect(status.matching).toBeNull();
    expect(status.count).toBeNull();
  });
});

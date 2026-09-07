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
    expect(resultStatus("results", 8, "Haifa", true).count).toBe("8 results for “Haifa”");
  });

  it("says result, not results, for one", () => {
    expect(resultStatus("results", 1, "Haifa", true).count).toBe("1 result for “Haifa”");
  });

  it("omits the query when none was echoed back", () => {
    expect(resultStatus("results", 3, "", true).count).toBe("3 results");
  });

  it("leaves an empty answer to the empty state rather than saying zero", () => {
    /* `PanelEmpty` already names the query in a full sentence. "0 results for
       X" above it is the same fact twice, in two registers. */
    expect(resultStatus("no-results", 0, "Haifa", true).count).toBeNull();
  });

  it.each(["idle", "loading", "invalid-query", "error"] as const)(
    "shows no count in %s, where there is no answer to count",
    (state) => {
      expect(resultStatus(state, 0, "", true).count).toBeNull();
    },
  );

  it("keeps a carried result set from being counted while a newer query loads", () => {
    /* `useSearch` keeps the previous hits on screen, dimmed, during the next
       request. Counting them would attach the old total to the new query. */
    expect(resultStatus("loading", 8, "Haifa", true).count).toBeNull();
  });

  it("distinguishes semantic matching from lexical", () => {
    expect(resultStatus("results", 2, "Haifa", true).matching).toBe(
      "Matching on words, names and meaning.",
    );
    expect(resultStatus("results", 2, "Haifa", false).matching).toBe(
      "Matching on words and names.",
    );
  });

  it("states plainly that a fallback answer had no semantic arm", () => {
    expect(resultStatus("fallback", 2, "Haifa", false).matching).toBe(
      "Showing word-and-name matches. Semantic matching is unavailable in this deployment.",
    );
  });

  it("claims no matcher at all when the search failed", () => {
    /* A request that did not complete matched nothing. Printing "matching on
       words and names" above "The search failed" describes a capability the
       reader did not get. */
    const status = resultStatus("error", 0, "Haifa", true);
    expect(status.matching).toBeNull();
    expect(status.count).toBeNull();
  });
});

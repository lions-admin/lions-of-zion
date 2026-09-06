import { describe, expect, it } from "vitest";
import { previewSentences, splitSentences } from "@/lib/preview-sentences";

const SHAPIRA =
  "Sheltering with roughly two dozen others in a roadside shelter during the attack on the Nova festival, Shapira stood by the entrance and threw back seven grenades that were hurled in by Hamas gunmen. The eighth exploded in his hands, killing him. At least seven people who sheltered with him survived.";

describe("previewSentences", () => {
  it("shows whole sentences within the budget and hides the rest", () => {
    const { shown, hidden } = previewSentences(
      "First sentence here. Second sentence here. Third sentence here.",
      45,
    );
    expect(shown).toBe("First sentence here. Second sentence here.");
    expect(hidden).toBe("Third sentence here.");
  });

  it("always shows the first sentence, however long, and never a fragment", () => {
    const { shown, hidden } = previewSentences(SHAPIRA, 120);
    expect(shown).toMatch(/gunmen\.$/);
    expect(shown).not.toMatch(/threw$/);
    expect(hidden).toBe(
      "The eighth exploded in his hands, killing him. At least seven people who sheltered with him survived.",
    );
  });

  it("keeps every word of the text, in order", () => {
    const { shown, hidden } = previewSentences(SHAPIRA, 200);
    expect(`${shown} ${hidden}`).toBe(SHAPIRA);
  });

  it("returns a one-sentence text whole", () => {
    expect(previewSentences("  Only one sentence, no stop  ", 10)).toEqual({
      shown: "Only one sentence, no stop",
      hidden: "",
    });
    expect(previewSentences("", 10)).toEqual({ shown: "", hidden: "" });
  });
});

describe("splitSentences", () => {
  it("does not end a sentence on a rank, an initial, an abbreviation or U.S.", () => {
    expect(
      splitSentences(
        "Maj.-Gen. (ret.) Noam Tibon drove south. Dr. J. Cohen met U.S. officials on 7 Oct. 2023. Then they left.",
      ),
    ).toEqual([
      "Maj.-Gen. (ret.) Noam Tibon drove south.",
      "Dr. J. Cohen met U.S. officials on 7 Oct. 2023.",
      "Then they left.",
    ]);
  });

  it("ends a sentence on a question, an exclamation, an ellipsis or a closing quote", () => {
    expect(
      splitSentences('Was it so? It was! He said "Go." Then silence… Nothing more.'),
    ).toEqual([
      "Was it so?",
      "It was!",
      'He said "Go."',
      "Then silence…",
      "Nothing more.",
    ]);
  });

  it("does not split before a lowercase continuation", () => {
    expect(splitSentences("Costs rose approx. two percent. Then fell.")).toEqual([
      "Costs rose approx. two percent.",
      "Then fell.",
    ]);
  });
});

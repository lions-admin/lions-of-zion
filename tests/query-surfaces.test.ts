import { describe, expect, it } from "vitest";
import { entityLabel, entityLabelPlural, groupByEntity } from "@/components/search/vocabulary";
import { toExchanges } from "@/components/ask/exchanges";
import { ENTITY_TYPES } from "@/server/contracts/enums";
import type { ChatMessageView } from "@/server/contracts/chat";

/**
 * The two pieces of `/search` and `/ask` that can be wrong without anyone
 * noticing: what a result kind is called, and which answer belongs to which
 * question. Everything else on those surfaces is rendering, and this suite
 * runs in a node environment with no DOM.
 */

describe("result kinds", () => {
  it("names every entity type the enum can produce", () => {
    for (const type of ENTITY_TYPES) {
      const label = entityLabel(type);
      expect(label, type).not.toBe(type);
      expect(label, type).not.toMatch(/_/);
    }
  });

  it("pluralises the one label that does not take an s", () => {
    expect(entityLabelPlural("geopolitical_analysis")).toBe("Analyses");
    expect(entityLabelPlural("brief")).toBe("Briefs");
  });

  it("groups by kind and leads with what the desk published", () => {
    const groups = groupByEntity([
      { entityType: "evidence" as const, id: 1 },
      { entityType: "information_item" as const, id: 2 },
      { entityType: "brief" as const, id: 3 },
      { entityType: "information_item" as const, id: 4 },
    ]);

    expect(groups.map((g) => g.type)).toEqual(["brief", "information_item", "evidence"]);
    /* Relevance order survives inside a group — grouping reorders kinds, never
       the hits within one. */
    expect(groups[1]!.items.map((i) => i.id)).toEqual([2, 4]);
  });

  it("returns nothing for nothing, rather than an empty group", () => {
    expect(groupByEntity([])).toEqual([]);
  });
});

const message = (
  seq: number,
  role: ChatMessageView["role"],
  content: string,
): ChatMessageView => ({
  id: `m-${seq}`,
  threadId: "t-1",
  seq,
  role,
  content,
  citations: [],
  createdAt: "2026-09-02T00:00:00.000Z",
});

describe("pairing a transcript into records", () => {
  it("attaches each answer to the question before it", () => {
    const exchanges = toExchanges([
      message(1, "user", "First question"),
      message(2, "assistant", "First answer"),
      message(3, "user", "Second question"),
      message(4, "assistant", "Second answer"),
    ]);

    expect(exchanges).toHaveLength(2);
    expect(exchanges[0]!.question).toBe("First question");
    expect(exchanges[0]!.answer?.content).toBe("First answer");
    expect(exchanges[1]!.answer?.content).toBe("Second answer");
  });

  it("leaves a question unanswered rather than borrowing the next answer", () => {
    /* The service writes the question and the answer in separate
       transactions, so a turn whose model call failed leaves exactly this. */
    const exchanges = toExchanges([
      message(1, "user", "Unanswered"),
      message(2, "user", "Answered"),
      message(3, "assistant", "The answer"),
    ]);

    expect(exchanges.map((e) => e.question)).toEqual(["Unanswered", "Answered"]);
    expect(exchanges[0]!.answer).toBeNull();
    expect(exchanges[1]!.answer?.content).toBe("The answer");
  });

  it("keeps an answer that has no question in front of it", () => {
    const exchanges = toExchanges([message(1, "assistant", "Orphaned")]);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]!.question).toBe("");
    expect(exchanges[0]!.answer?.content).toBe("Orphaned");
  });

  it("drops a system message rather than rendering one it cannot interpret", () => {
    const exchanges = toExchanges([
      message(1, "system", "Some instruction"),
      message(2, "user", "A question"),
      message(3, "assistant", "An answer"),
    ]);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]!.question).toBe("A question");
  });
});

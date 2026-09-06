import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUTBOX_QUEUE_TOPIC, QUEUE_TOPIC_NAME, assertQueueTopicName } from "@/server/core/queue";

/**
 * The root cause of two days of runs that never ran.
 *
 * Vercel Queues refuses a topic name outside `[A-Za-z0-9_-]{1,256}` — at
 * `send()`, with a 400 the drain records as `last_error` and retries against
 * forever. `OUTBOX_QUEUE_TOPIC` was `"outbox.dispatch"` from 2026-09-05 to
 * 2026-09-07: every deploy was green, the drain cron returned 200 every
 * fifteen minutes, 3,348 outbox rows carried the refusal, and not one was
 * ever handed to the queue. Nothing checked the name locally; this does.
 */
describe("the outbox queue topic", () => {
  it("is a name Vercel Queues will accept", () => {
    expect(OUTBOX_QUEUE_TOPIC).toMatch(QUEUE_TOPIC_NAME);
  });

  it("refuses the name that broke Production, and any other with a dot", () => {
    expect(() => assertQueueTopicName("outbox.dispatch")).toThrow(/not a valid Vercel Queue topic/);
    expect(() => assertQueueTopicName("editorial.run-process")).toThrow();
    expect(() => assertQueueTopicName("")).toThrow();
    expect(assertQueueTopicName("outbox-dispatch")).toBe("outbox-dispatch");
    expect(assertQueueTopicName("source_ingest")).toBe("source_ingest");
  });

  /* The producer and the trigger name the same topic, or the queue accepts
     every send and delivers none of them to this route. */
  it("is the topic vercel.json triggers the dispatch route on", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      functions: Record<string, { experimentalTriggers?: Array<{ type: string; topic: string }> }>;
    };
    const route = config.functions["app/api/internal/queue/outbox-dispatch/route.ts"];
    expect(route?.experimentalTriggers).toEqual([expect.objectContaining({ type: "queue/v2beta", topic: OUTBOX_QUEUE_TOPIC })]);
    for (const [path, fn] of Object.entries(config.functions)) {
      for (const trigger of fn.experimentalTriggers ?? []) {
        expect(trigger.topic, `${path} trigger topic`).toMatch(QUEUE_TOPIC_NAME);
      }
    }
  });
});

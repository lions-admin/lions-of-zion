import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { outbox } from "@/server/db/schema";

const editorial = vi.hoisted(() => ({ processEditorialRun: vi.fn(), deliverEditorialRunReport: vi.fn() }));
vi.mock("@/server/modules/editorial-update", () => editorial);
vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { consumerFor } from "@/server/jobs/consumers";
import { dispatchOutboxMessage, MAX_OUTBOX_CONSUMER_DELIVERIES, outboxRetry } from "@/server/modules/outbox";
import { TOPICS } from "@/server/core/outbox";

/**
 * The queue callback carries the outbox row's own topic and resolves it to a
 * consumer by name. This pins that the two editorial topics resolve to the
 * editorial module — and that the message the drain builds (topic + payload +
 * subject) is what the consumer receives, run identity intact.
 */
describe("outbox message dispatch", () => {
  it("routes editorial.run-process to the durable executor with the run identity", async () => {
    editorial.processEditorialRun.mockResolvedValue(undefined);
    const payload = { runId: "96eea424-179c-48a0-aeee-a7ea8f83181d" };
    await dispatchOutboxMessage({ outboxId: "3568", topic: TOPICS.editorialRunProcess, payload, entityType: "system", entityId: payload.runId });
    expect(editorial.processEditorialRun).toHaveBeenCalledWith(payload);
  });

  it("routes editorial.run-report to the report deliverer", async () => {
    editorial.deliverEditorialRunReport.mockResolvedValue(undefined);
    await dispatchOutboxMessage({ topic: TOPICS.editorialRunReport, payload: { runId: "r" }, entityType: "system", entityId: "r" });
    expect(editorial.deliverEditorialRunReport).toHaveBeenCalledWith({ runId: "r" });
  });

  it("registers a consumer for every live topic", () => {
    for (const topic of Object.values(TOPICS)) expect(consumerFor(topic), topic).toBeDefined();
  });

  it("throws on an unregistered topic so the queue retries rather than acknowledging silently", async () => {
    await expect(dispatchOutboxMessage({ topic: "nobody.home", payload: {}, entityType: null, entityId: null }))
      .rejects.toThrow(/No consumer registered/);
  });

  it("rethrows a consumer failure so the queue redelivers it", async () => {
    editorial.processEditorialRun.mockRejectedValueOnce(new Error("worker crashed"));
    await expect(dispatchOutboxMessage({ topic: TOPICS.editorialRunProcess, payload: { runId: "r" }, entityType: "system", entityId: "r" }))
      .rejects.toThrow("worker crashed");
  });

  it("records a consumer failure and marks a poison message after bounded deliveries", async () => {
    const db = await freshDatabase();
    const [row] = await db.insert(outbox).values({ topic: "nobody.home", payload: {} }).returning();
    await expect(dispatchOutboxMessage(
      { outboxId: String(row!.id), topic: "nobody.home", payload: {}, entityType: null, entityId: null },
      { deliveryCount: MAX_OUTBOX_CONSUMER_DELIVERIES }, db,
    )).rejects.toThrow(/No consumer registered/);

    const [stored] = await db.select().from(outbox).where(eq(outbox.id, row!.id));
    expect(stored).toMatchObject({
      consumerAttempts: MAX_OUTBOX_CONSUMER_DELIVERIES,
      consumerLastError: expect.stringMatching(/No consumer registered/),
      consumedAt: null,
      deadLetteredAt: expect.any(Date),
    });
    expect(outboxRetry({ deliveryCount: MAX_OUTBOX_CONSUMER_DELIVERIES })).toEqual({ acknowledge: true });
    expect(outboxRetry({ deliveryCount: 1 })).toEqual({ afterSeconds: 30 });
  });
});

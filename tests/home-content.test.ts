import { describe, expect, it } from "vitest";
import {
  getAllMilestones,
  getLatestMilestone,
  getRecentMilestones,
} from "@/lib/content/home";
import { getOctober7Record } from "@/lib/content/october-7";
import { getWarUpdateEdition } from "@/lib/content/war-update";

/**
 * The home page's front-page band claims one thing about freshness — "this is
 * the latest documented milestone" — and these tests are what keep that claim
 * true as the content changes underneath it.
 */
describe("home front-page content", () => {
  it("orders every milestone newest first", async () => {
    const milestones = getAllMilestones();
    expect(milestones.length).toBeGreaterThan(0);

    const dates = milestones.map((entry) => entry.datetime);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it("keeps the historical October 7 record while excluding hostage news from active surfaces", async () => {
    const [warUpdate, october7] = await Promise.all([
      getWarUpdateEdition(),
      getOctober7Record(),
    ]);

    expect(warUpdate.entries.some((entry) => entry.id === "hostages-released")).toBe(false);
    expect(october7.timeline.some((entry) => entry.id === "final-hostages")).toBe(true);

    const ids = getAllMilestones().map((entry) => entry.id);
    expect(ids).not.toContain("hostages-released");
    expect(ids).toContain("final-hostages");
  });

  it("gives every milestone a unique id, so the merge cannot collide", async () => {
    const ids = getAllMilestones().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attributes every milestone to a real section route", async () => {
    const milestones = getAllMilestones();
    const routes = new Set(["/war-update", "/october-7", "/geopolitical-brief"]);

    for (const milestone of milestones) {
      expect(routes.has(milestone.section.href)).toBe(true);
      expect(milestone.section.label.length).toBeGreaterThan(0);
    }
  });

  it("dates every milestone as a real ISO day", async () => {
    for (const milestone of getAllMilestones()) {
      expect(milestone.datetime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(milestone.datetime).getTime())).toBe(false);
    }
  });

  it("reports the newest milestone as the latest one", async () => {
    const latest = getLatestMilestone();
    const all = getAllMilestones();
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(all[0].id);

    const newest = all.reduce(
      (carry, entry) => (entry.datetime > carry ? entry.datetime : carry),
      all[0].datetime,
    );
    expect(latest?.datetime).toBe(newest);
  });

  it("caps the recent list without reordering it", async () => {
    const recent = getRecentMilestones(3);
    const all = getAllMilestones();

    expect(recent).toHaveLength(3);
    expect(recent.map((entry) => entry.id)).toEqual(all.slice(0, 3).map((entry) => entry.id));
  });

  it("asks for more than it has without failing", async () => {
    const all = getAllMilestones();
    const recent = getRecentMilestones(all.length + 25);
    expect(recent).toHaveLength(all.length);
  });
});

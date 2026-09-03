import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routeFamily } from "@/components/site/route-family";
import { BADGE_GRAMMAR, type BadgeStatus } from "@/components/ui/Badge";
import { BUTTON_SEMANTIC_VARIANTS } from "@/components/ui/Button";

const ROOT = process.cwd();

function readRepo(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function remToPx(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)rem$/);
  if (!match) return null;
  return Number(match[1]) * 16;
}

describe("route-family mapping", () => {
  it("maps desk, dossier, and institution from shipped route ids", () => {
    expect(routeFamily("geopolitical-brief")).toBe("desk");
    expect(routeFamily("updates")).toBe("desk");
    expect(routeFamily("fact-check")).toBe("desk");
    expect(routeFamily("search")).toBe("desk");
    expect(routeFamily("ask")).toBe("desk");
    expect(routeFamily("methodology")).toBe("institution");
    expect(routeFamily("corrections")).toBe("institution");
    expect(routeFamily("we-are")).toBe("institution");
    expect(routeFamily("support-us")).toBe("institution");
    expect(routeFamily("account")).toBe("institution");
    expect(routeFamily("october-7")).toBe("dossier");
    expect(routeFamily("fake-resistance")).toBe("dossier");
    expect(routeFamily("articles")).toBe("dossier");
  });
});

describe("badge grammar", () => {
  it("gives every shipped status a visible text label", () => {
    const statuses = Object.keys(BADGE_GRAMMAR) as BadgeStatus[];
    expect(statuses.length).toBeGreaterThan(8);
    for (const status of statuses) {
      const label = BADGE_GRAMMAR[status].label.trim();
      expect(label.length, `status ${status} must have a text label`).toBeGreaterThan(0);
    }
  });
});

describe("button style contract", () => {
  it("exports the five semantic variants and floors coarse targets at 44px", () => {
    expect([...BUTTON_SEMANTIC_VARIANTS]).toEqual([
      "primary",
      "secondary",
      "ghost",
      "text",
      "danger",
    ]);

    const globals = readRepo("app/globals.css");
    const control = globals.match(/--control-h:\s*([^;]+);/);
    expect(control, "shipped --control-h is missing").toBeTruthy();
    const controlPx = remToPx(control![1]);
    expect(controlPx, `--control-h should be rem-based, got ${control![1]}`).toBeTypeOf("number");
    expect(controlPx!).toBeGreaterThanOrEqual(44);

    const css = readRepo("components/ui/button.module.css");
    for (const variant of BUTTON_SEMANTIC_VARIANTS) {
      expect(css, `missing .${variant} in shipped button CSS`).toContain(`.${variant}`);
    }
    expect(css).toMatch(/@media \(pointer:\s*coarse\)/);
    expect(css).toMatch(/--btn-h:\s*var\(--control-h\)/);
    expect(css).toContain("min-height: var(--btn-h)");
  });
});

describe("type measure floor (SYS-004)", () => {
  it("keeps public body at least 16px and metadata at least 12px", () => {
    const globals = readRepo("app/globals.css");
    const body = globals.match(/--t-body:\s*([^;]+);/);
    const data = globals.match(/--t-data:\s*([^;]+);/);
    expect(body).toBeTruthy();
    expect(data).toBeTruthy();
    expect(remToPx(body![1])!).toBeGreaterThanOrEqual(16);
    expect(remToPx(data![1])!).toBeGreaterThanOrEqual(12);
  });
});

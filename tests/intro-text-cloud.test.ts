import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { buildTextCloud, measureTextWidth } from "@/components/intro/textCloud";
import {
  INTRO_LINE_WIDTH_FRACTION,
  computeIntroLayout,
  introLineBudget,
  quantizeIntroWidth,
} from "@/components/intro/introLayout";
import { ROLLING_STORY_LINES_BY_LAYOUT } from "@/components/intro/rolling-story-timeline";
import { viewSize } from "@/components/intro-scene/config";

/* The sampler is pure and node-safe; it just needs the same font the browser
   loads. Nothing under tests/ has exercised it before, which is how a cap that
   was 170vw on a tablet went unnoticed. */
const font = new FontLoader().parse(
  JSON.parse(
    readFileSync(join(process.cwd(), "public/assets/gentilis_regular.typeface.json"), "utf8"),
  ),
);

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1254, 1254],
  [1440, 900],
  [2560, 1080],
] as const;

/** What `IntroText` does: measure every rolling line, then solve one scale. */
function storyScaleFor(width: number, height: number) {
  const layout = computeIntroLayout(width, height);
  const lines = ROLLING_STORY_LINES_BY_LAYOUT[layout.name];
  const widest = Math.max(
    ...lines.slice(0, -1).map((line) => measureTextWidth(line, font)),
    0.001,
  );
  return { layout, lines, scale: Math.min(layout.fontScale, layout.lineMaxWidth / widest) };
}

describe("intro text cloud", () => {
  it.each(VIEWPORTS)("keeps every story line within 86vw at %sx%s", (width, height) => {
    const { layout, lines, scale } = storyScaleFor(width, height);
    const { viewWidth } = viewSize(quantizeIntroWidth(width), height);
    const limit = viewWidth * INTRO_LINE_WIDTH_FRACTION;

    lines.slice(0, -1).forEach((line) => {
      expect(measureTextWidth(line, font) * scale).toBeLessThanOrEqual(limit + 1e-6);
      expect(measureTextWidth(line, font) * scale).toBeLessThanOrEqual(
        layout.lineMaxWidth + 1e-6,
      );
    });
  });

  /* The regression this rule exists for is not on a phone. A tablet in portrait
     is 768px wide, so it takes the *desktop* line breaks, and the old cap of
     8.65 world units was 170% of that frame — the widest desktop line simply
     ran off both sides. */
  it("fits the desktop line breaks in a portrait tablet frame", () => {
    const { layout, lines, scale } = storyScaleFor(768, 1024);
    expect(layout.name).toBe("desktop");
    const widest = Math.max(...lines.slice(0, -1).map((line) => measureTextWidth(line, font)));
    expect(widest * scale).toBeLessThanOrEqual(layout.halfWidth * 2 * INTRO_LINE_WIDTH_FRACTION);
    // And the old constant really was out of frame, so this is not a no-op.
    expect(8.65).toBeGreaterThan(layout.halfWidth * 2);
  });

  it.each(VIEWPORTS)("gives every story line the same type size at %sx%s", (width, height) => {
    const { lines, scale } = storyScaleFor(width, height);
    const built = lines
      .slice(0, -1)
      .map((line, index) =>
        buildTextCloud([line], font, {
          ...introLineBudget(index, lines.length, computeIntroLayout(width, height).name, false),
          maxWidth: computeIntroLayout(width, height).lineMaxWidth,
          fontScale: scale,
          centerY: 0,
          lineHeight: 0.5,
          outlineRatio: 0.27,
          seed: index,
        }),
      );

    built.forEach((cloud) => expect(cloud.scale).toBeCloseTo(scale, 9));
    /* Which is the point: solved per line, the cap would bind on the long ones
       only and the type size would step between rows. */
    expect(new Set(built.map((cloud) => cloud.scale.toFixed(9))).size).toBe(1);
  });

  it("reports the width it actually rendered", () => {
    const cloud = buildTextCloud(["Join us."], font, {
      maxParticles: 4_000,
      maxWidth: 1,
      fontScale: 10,
      density: 300,
    });
    // The cap bound, so the achieved width is the cap and the scale reflects it.
    expect(cloud.width).toBeCloseTo(1, 6);
    expect(cloud.scale).toBeLessThan(10);
    expect(cloud.count).toBeGreaterThan(0);
  });
});

/**
 * The entry path a text particle travels — lion surface → throat → glyph — as
 * pure CPU math, so the one part of it that is a *timing* contract can be
 * tested without a GPU. `tsl/introTextMaterial.ts` imports these constants and
 * reproduces these three functions as nodes; `tests/intro-preroll.test.ts`
 * pins the shape they have to keep.
 *
 * ## Why a lead exists at all
 *
 * §3 of `fixhomeTODO.md` asks for a stream pre-roll at 4.20–4.35 s: "a narrow
 * particle throat begins below the lion so the first text line does not appear
 * from nowhere". Phase A gave that window an envelope
 * (`getTextFlowEnvelope`, opening over `STREAM_PREROLL_START` → `STORY_START`)
 * and Phase C built the path, but the path's only parameter was the line's
 * `build`, which is flat zero until `STORY_START`. Nothing moved: the pre-roll
 * rendered an empty frame and the first glyphs still arrived out of nothing.
 *
 * The fix is a *lead*: a small leading subset of the first line's particles
 * follows the flow envelope down the first leg of the path, parks in the
 * throat, and is then overtaken by its own build. The path parameter is
 *
 *     t = max(built(order, build), lead(flow, order))
 *
 * — the maximum of two continuous functions, so there is no seam at
 * `STORY_START` where the build takes over, and `built(order, 1) === 1` for
 * every particle keeps the line finishing on exactly its existing schedule.
 * The lead is capped at `STREAM_THROAT_T`, so a leading particle never runs
 * past the throat and into its glyph early.
 */

/**
 * Build-order stagger. `order` is the particle's normalised x position within
 * its line, so a line draws left to right; each particle then spends
 * `STREAM_TRAVEL_WINDOW` of the build in flight, and the last one lands
 * exactly at `build = 1`.
 */
export const STREAM_STAGGER_SPAN = 0.72;
export const STREAM_TRAVEL_WINDOW = 1 - STREAM_STAGGER_SPAN;

/** Where along the entry path the particle passes through the throat. */
export const STREAM_THROAT_T = 0.42;

/**
 * Share of a line's build order that leads during the pre-roll. These are the
 * particles whose build starts first anyway — the leftmost glyphs — so the
 * handover from lead to build happens where the two are already closest.
 */
export const STREAM_LEAD_SHARE = 0.18;

/**
 * The rolling line that pre-rolls: the first one, the only line that would
 * otherwise arrive with no stream in front of it. Every later line enters
 * while the previous one is still on screen and draws from the lion through
 * the same throat on its own `build`.
 */
export const STREAM_PREROLL_LINE = 0;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** GLSL `smoothstep`, which is what the TSL node compiles to. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * How much of the lead this particle takes, 1 at the head of the build order
 * and 0 from `STREAM_LEAD_SHARE` on. A ramp rather than a step, so the throat
 * fills from one side instead of a block of particles moving as a sheet.
 */
export function streamLeadShare(order: number): number {
  return 1 - smoothstep(0, STREAM_LEAD_SHARE, clamp01(order));
}

/**
 * The particle's path parameter contributed by the flow envelope alone —
 * 0 before the pre-roll opens, at most `STREAM_THROAT_T` when it is fully
 * open, and 0 for any particle outside the leading subset.
 */
export function streamLead(flow: number, order: number): number {
  return clamp01(flow) * streamLeadShare(order) * STREAM_THROAT_T;
}

/** The particle's path parameter contributed by its line's build progress. */
export function streamBuilt(order: number, build: number): number {
  const start = clamp01(order) * STREAM_STAGGER_SPAN;
  return smoothstep(start, start + STREAM_TRAVEL_WINDOW, build);
}

/**
 * The path parameter the material actually uses. Continuous in both arguments,
 * equal to `streamBuilt` wherever the build has caught up, and exactly 1 for
 * every particle at `build = 1`.
 */
export function streamPathParameter(
  flow: number,
  order: number,
  build: number,
): number {
  return Math.max(streamBuilt(order, build), streamLead(flow, order));
}

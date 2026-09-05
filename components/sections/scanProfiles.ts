/**
 * How loud the shared scan backdrop runs behind each kind of public route.
 *
 * One pure map, no database, no React: `EditorialShell` reads it for every
 * reading route and `app/page.tsx` reads it for the home band, so a page or a
 * shell can pick intensity, density and speed without touching the backdrop
 * internals (`ScanBackdrop.tsx`, `sections.module.css`).
 *
 * The family is the unit, not the route — SYS-002 already says the family
 * changes "density, scan strength, and measure — never colour", and this is
 * where scan strength now lives. Before this map the same numbers were
 * `.page[data-family] .row` overrides in the stylesheet, which the home band
 * (no `.page`, no family) could not reach.
 *
 * The scale: `intensity` multiplies the row opacity ceiling (0.34) that the
 * stylesheet owns, so `1` is "as loud as the design allows", not "opaque".
 * A page's own `register` still stacks on top — `muted` is a per-page dimmer
 * relative to its family, `silent` renders nothing at all.
 */
import { routeFamily, type RouteFamily } from '@/components/site/route-family';

export type ScanRegister = 'default' | 'muted' | 'silent';
export type ScanDensity = 'low' | 'medium' | 'high';
export type ScanSpeed = 'still' | 'slow' | 'normal';

export interface ScanProfile {
  register: ScanRegister;
  /** 0..1 — see `clampScanIntensity`. */
  intensity: number;
  density: ScanDensity;
  speed: ScanSpeed;
}

/** `NaN`, `undefined` and out-of-range values all land inside `0..1`. */
export function clampScanIntensity(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/**
 * The contrast budget these numbers answer to (§7 audit, 2026-09-04).
 *
 * Effective row opacity is `0.34 × register × intensity`, and inside
 * `--content-w` the `.rowField` mask multiplies it by a further 0.25. Every
 * surface a reader reads sits inside that mask: `.withRails` widens
 * `--content-w` over both rails at the 1220px breakpoint, and below it the
 * rails are `display: none` and everything is in the measure column.
 *
 * The binding token is `--ink-lo` (#88837b) — captions, metadata, TOC links,
 * the home file numbers — which reads 4.93:1 on the brightest pixel of
 * `--scan-ground` before the scan adds anything, against a 4.5 floor. So the
 * whole scan layer has 0.43 of ratio to spend, and these intensities are what
 * fits inside it against a loud verified row (`--ink`, the brightest thing
 * the backdrop paints). The numbers are recomputed and asserted per family in
 * `tests/intro-accessibility.test.ts`; raising one fails that suite.
 */
export const FAMILY_SCAN_PROFILES: Readonly<Record<RouteFamily, ScanProfile>> = {
  /* Live tools keep a live-tool presence: the fullest of the three, at the
     stylesheet's normal drift.

     0.5, down from 0.6 in the §7 audit. At 0.6 the masked reading column put
     `--ink-lo` at 4.51:1 — over the floor by 0.01, which is not a margin, and
     desk is the family whose column carries the most 12–13px data-face
     metadata (fact-check rung labels, update stamps, search facets). 0.5
     reads 4.59:1 and is also exactly the register desk ran at before the
     profile map existed. */
  desk: { register: 'default', intensity: 0.5, density: 'medium', speed: 'normal' },
  /* Long reading. Low and slow, so a dossier reads as a file open on a desk
     with the monitor still running somewhere behind it. */
  dossier: { register: 'default', intensity: 0.45, density: 'medium', speed: 'slow' },
  /* Policy and trust pages read as documents; the scan is a rumour. */
  institution: { register: 'default', intensity: 0.3, density: 'low', speed: 'slow' },
};

/**
 * The home band. Low and slow because the home is the one route with another
 * moving layer — the typographic field — and the two are never on screen at
 * full strength together; `home.module.css` documents the layering.
 *
 * 0.30, down from 0.35 in the §7 audit, and the one profile that was over the
 * line rather than close to it. The home is the only route whose mask is
 * narrower than its chrome: `.scanDock` sets `--content-w` to the masthead's
 * 48rem column, while `.fileIndex` below it runs the full `--chrome-w`, so
 * the eight file numbers (`.fileNo`, `--ink-lo` at `--t-data`) are the one
 * piece of small text on the site that meets the band **unmasked**. At 0.35
 * that measured 4.48:1; at 0.30 it is 4.64:1. Widening the dock's mask over
 * the file index instead would have dimmed the band across the whole screen,
 * which is the same as deleting it.
 */
export const HOME_SCAN_PROFILE: ScanProfile = {
  register: 'default',
  intensity: 0.3,
  density: 'low',
  speed: 'slow',
};

/** What `silent` means as a profile: nothing renders, so the rest is moot. */
export const SILENT_SCAN_PROFILE: ScanProfile = {
  register: 'silent',
  intensity: 0,
  density: 'low',
  speed: 'still',
};

/**
 * Operator and debug surfaces, kept off the public backdrop on purpose.
 *
 * `/admin` and `/admin/login` are the operations console, and `/pipeline` is
 * the ingestion visualiser, which has its own purpose-specific motion. None of
 * them wear `EditorialShell`, so none would mount the backdrop by accident
 * today — this list is what makes the exclusion a decision rather than a side
 * effect of that, and `tests/global-scan-backdrop.test.ts` pins both halves:
 * the map answers `silent` for each, and the three page roots mount no
 * backdrop.
 *
 * A fourth entry, `/particle-demo`, was the GPU scene's tuning bench. It went
 * with the particle subsystem on 2026-09-05.
 */
export const INTERNAL_ROUTE_IDS = ['admin', 'admin/login', 'pipeline'] as const;

export function isInternalRoute(routeId: string): boolean {
  return (INTERNAL_ROUTE_IDS as readonly string[]).includes(routeId);
}

/** The profile for a route id, by family; internal routes are `silent`. */
export function scanProfileForRoute(routeId: string): ScanProfile {
  if (isInternalRoute(routeId)) return SILENT_SCAN_PROFILE;
  if (routeId === 'home') return HOME_SCAN_PROFILE;
  return FAMILY_SCAN_PROFILES[routeFamily(routeId)];
}

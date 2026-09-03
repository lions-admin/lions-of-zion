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

export const FAMILY_SCAN_PROFILES: Readonly<Record<RouteFamily, ScanProfile>> = {
  /* Live tools keep a live-tool presence: the fullest of the three, at the
     stylesheet's normal drift. */
  desk: { register: 'default', intensity: 0.6, density: 'medium', speed: 'normal' },
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
 */
export const HOME_SCAN_PROFILE: ScanProfile = {
  register: 'default',
  intensity: 0.35,
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
 * `/admin` and `/admin/login` are the operations console; `/pipeline` is the
 * ingestion visualiser, which has its own purpose-specific motion; and
 * `/particle-demo` is the GPU scene's tuning bench, which is already a moving
 * layer. None of them wear `EditorialShell`, so none of them would mount the
 * backdrop by accident today — this list is what makes the exclusion a
 * decision rather than a side effect of that, and
 * `tests/global-scan-backdrop.test.ts` pins both halves: the map answers
 * `silent` for each, and the four page roots mount no backdrop.
 */
export const INTERNAL_ROUTE_IDS = ['admin', 'admin/login', 'particle-demo', 'pipeline'] as const;

export function isInternalRoute(routeId: string): boolean {
  return (INTERNAL_ROUTE_IDS as readonly string[]).includes(routeId);
}

/** The profile for a route id, by family; internal routes are `silent`. */
export function scanProfileForRoute(routeId: string): ScanProfile {
  if (isInternalRoute(routeId)) return SILENT_SCAN_PROFILE;
  if (routeId === 'home') return HOME_SCAN_PROFILE;
  return FAMILY_SCAN_PROFILES[routeFamily(routeId)];
}

/**
 * The shared coordinate contract.
 *
 * One module owns the answer to "how big is the world, and where is anything in
 * it". Before this existed, the homepage measured its wrapper element and the
 * intro measured `window`, with two different pixel-ratio caps, and the lion's
 * cover fit was a two-branch heuristic that failed at both ends of the aspect
 * range. A navigation layer registered against the lion's composition would
 * have inherited every one of those failures one layer up.
 *
 * Everything here is measurement. Art direction — which text cloud to build,
 * how a scene eases — stays in the scenes.
 */

/* ------------------------------------------------------------------ *
 * Composition constants
 *
 * These describe the one composition both scenes share. They were previously
 * local to `LionExperience`'s effect body; they are exported now because the
 * cover fit, the focal point and the nav layout are all derived from them and
 * a second copy is how a quantisation scale silently drifts.
 * ------------------------------------------------------------------ */

/** Camera field of view, degrees. */
export const CAMERA_FOV = 34;
/** Camera distance from the lion's plane. */
export const CAMERA_Z = 10;

/** The lion plane, in world units. 16:9, matching the source photograph. */
export const PLANE_H = 6.15;
export const PLANE_W = PLANE_H * (16 / 9);

/**
 * The lion mesh sits centred in its group. It used to carry a private +0.14
 * lift, duplicated again in the particle sampler, which meant two constants
 * decided vertical framing and neither knew about the cover fit. All vertical
 * framing is `planeOffsetY` now, and it is solved for rather than chosen.
 */

/**
 * The face, in plane UV space. Eyes were measured on the source image at
 * (0.439, 0.562) and (0.559, 0.566); v = 0.65 sits just above them, which is
 * the point the composition should hold as the frame narrows.
 */
export const FACE_V = 0.65;

/**
 * Per-frame parallax amplitudes, in world units. The composition must stay
 * covered with all of these at their extreme simultaneously, which is why the
 * cover fit adds them rather than trusting a hand-picked safety factor.
 */
export const PARALLAX = {
  lionX: 0.18,
  lionY: 0.14,
  cameraX: 0.18,
  cameraY: 0.1,
} as const;

/** Amplitude of the lion's breathing micro-scale; it can shrink the plane. */
export const BREATH_AMPLITUDE = 0.0045;

/**
 * How much of the image width the composition frames, as the aspect narrows.
 * 1.0 is "whatever cover requires"; the portrait end reproduces the original
 * art direction of moving in on the face, but as a continuous function rather
 * than as a branch.
 */
const PORTRAIT_ZOOM_MAX = 1.12;

/** The aspect band over which the framing drifts from wide to face-centred. */
const FACE_BIAS_WIDE = 1.3;
const FACE_BIAS_NARROW = 0.75;

/**
 * Where the navigation ring hangs relative to the lion's face. The ring is tied
 * to the composition's focal point — a ring centred on the viewport would drift
 * off the lion on every aspect that is not 16:9 — but it hangs below the eyes,
 * so the central mark never lands on them.
 */
const NAV_FOCAL_BIAS = 0.3;

export type QualityTier = "ultra" | "high" | "medium" | "low" | "fallback";

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportSnapshot {
  /** CSS pixels of the observed element. */
  width: number;
  height: number;
  aspect: number;
  /** The one pixel-ratio policy, for every scene. */
  dpr: number;
  tier: QualityTier;
  reducedMotion: boolean;
  coarsePointer: boolean;

  /** World half-extents of the visible area at the lion's plane. */
  halfW: number;
  halfH: number;

  /** The Stage 0 cover fit. */
  planeScale: number;
  planeOffsetY: number;

  /** World position of the lion's face under the current fit. */
  focalX: number;
  focalY: number;

  /** Where a ring built around this composition should be centred. */
  navCenterX: number;
  navCenterY: number;

  /** Device safe-area insets, CSS pixels. */
  safeArea: SafeArea;
}

/* ------------------------------------------------------------------ *
 * The fit
 * ------------------------------------------------------------------ */

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Visible world height at the lion's plane. Constant — only width varies. */
export function visibleHeight(): number {
  return 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * CAMERA_Z;
}

/**
 * The cover fit, in one continuous piece.
 *
 * Cover is guaranteed by construction: the required scale is solved for, with
 * the parallax and the breathing already inside it. The focal pan then takes
 * whatever vertical headroom the resulting scale leaves over, which is why
 * there is no threshold anywhere in here to cross — at every aspect the frame
 * is covered, and the face moves toward centre only as far as it can without
 * breaking that.
 */
export function fitComposition(aspect: number): {
  planeScale: number;
  planeOffsetY: number;
  focalY: number;
  halfW: number;
  halfH: number;
} {
  const visH = visibleHeight();
  const visW = visH * aspect;

  const maxShiftX = PARALLAX.lionX + PARALLAX.cameraX;
  const maxShiftY = PARALLAX.lionY + PARALLAX.cameraY;
  // The breathing scale dips below 1, so the plane must be solved for at its
  // smallest, not its nominal size.
  const shrink = 1 - BREATH_AMPLITUDE;

  // The scale that covers the frame with every parallax at its extreme and no
  // pan applied. Both axes bind on some aspect; the wider one wins.
  const coverX = (visW + 2 * maxShiftX) / (PLANE_W * shrink);
  const coverY = (visH + 2 * maxShiftY) / (PLANE_H * shrink);
  const coverScale = Math.max(coverX, coverY);

  // How far this aspect wants to move in on the face, 0 wide → 1 portrait.
  const faceBias = smoothstep(FACE_BIAS_WIDE, FACE_BIAS_NARROW, aspect);

  // Extra zoom, whose only purpose is to buy the pan somewhere to go.
  const planeScale = coverScale * (1 + faceBias * (PORTRAIT_ZOOM_MAX - 1));

  // Vertical slack this scale leaves over, in world units, and the pan that
  // fits inside it. Cover is never traded away for art direction: the pan
  // takes the headroom that exists and stops there.
  const slack = (PLANE_H * planeScale * shrink) / 2 - (visH / 2 + maxShiftY);
  const maxPan = Math.max(0, slack / (PLANE_H * planeScale));
  const pan = Math.min(faceBias * (FACE_V - 0.5), maxPan);

  return {
    planeScale,
    planeOffsetY: -pan * PLANE_H * planeScale,
    focalY: (FACE_V - 0.5 - pan) * PLANE_H * planeScale,
    halfW: visW / 2,
    halfH: visH / 2,
  };
}

/* ------------------------------------------------------------------ *
 * Device policy
 * ------------------------------------------------------------------ */

function detectTier(coarse: boolean, width: number): QualityTier {
  if (!hasWebGL()) return "fallback";

  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;

  if (coarse || width < 860) return width < 600 || cores <= 4 ? "low" : "medium";
  if (cores >= 8 && width >= 1440) return "ultra";
  return "high";
}

let webglSupport: boolean | null = null;

/** Cached, because creating a probe context is not free and never changes. */
export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    webglSupport = Boolean(
      probe.getContext("webgl2") ||
        probe.getContext("webgl") ||
        probe.getContext("experimental-webgl"),
    );
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const DPR_BY_TIER: Record<QualityTier, number> = {
  ultra: 1.9,
  high: 1.75,
  medium: 1.5,
  low: 1.35,
  fallback: 1,
};

/** The one pixel-ratio policy. Both scenes and the nav layer read this. */
export function dprFor(tier: QualityTier, reducedMotion: boolean): number {
  const device =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cap = reducedMotion ? Math.min(1.25, DPR_BY_TIER[tier]) : DPR_BY_TIER[tier];
  return Math.min(device, cap);
}

function readSafeArea(): SafeArea {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;" +
    "padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);" +
    "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const area: SafeArea = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return area;
}

/**
 * How much the plane overhangs the frame, with every parallax at its extreme
 * and the breathing scale at its minimum. Zero is exactly covered; negative is
 * a gap. `scripts/verify-composition.mjs` reads this to check that the scene is
 * really using the fit, rather than that the fit is merely correct on paper.
 *
 * Development only — `process.env.NODE_ENV` is substituted at build time, so
 * this and the global it writes are absent from a production bundle.
 */
function publishForVerification(snapshot: ViewportSnapshot): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;

  const shrink = 1 - BREATH_AMPLITUDE;
  const maxShiftX = PARALLAX.lionX + PARALLAX.cameraX;
  const maxShiftY = PARALLAX.lionY + PARALLAX.cameraY;
  const halfPlaneW = (PLANE_W * snapshot.planeScale * shrink) / 2;
  const halfPlaneH = (PLANE_H * snapshot.planeScale * shrink) / 2;

  (window as unknown as { __lionFit?: unknown }).__lionFit = {
    aspect: snapshot.aspect,
    tier: snapshot.tier,
    dpr: snapshot.dpr,
    planeScale: snapshot.planeScale,
    planeOffsetY: snapshot.planeOffsetY,
    focalY: snapshot.focalY,
    navCenterY: snapshot.navCenterY,
    marginX: halfPlaneW - (snapshot.halfW + maxShiftX),
    marginY: Math.min(
      halfPlaneH + snapshot.planeOffsetY - (snapshot.halfH + maxShiftY),
      halfPlaneH - snapshot.planeOffsetY - (snapshot.halfH + maxShiftY),
    ),
    imageWidthShown: (snapshot.halfW * 2) / (PLANE_W * snapshot.planeScale),
  };
}

/* ------------------------------------------------------------------ *
 * The observer
 * ------------------------------------------------------------------ */

export type ViewportListener = (snapshot: ViewportSnapshot) => void;

/**
 * World position at the plane to CSS pixels, against a given snapshot.
 *
 * Free-standing because the DOM navigation has to place elements from the same
 * numbers the shaders use, and it holds a snapshot rather than the observer.
 */
export function worldToScreenIn(
  snapshot: ViewportSnapshot,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: (x / snapshot.halfW) * 0.5 * snapshot.width + snapshot.width / 2,
    y: snapshot.height / 2 - (y / snapshot.halfH) * 0.5 * snapshot.height,
  };
}

/**
 * Measures one element and notifies subscribers when the measurement changes.
 *
 * The element, not the window: the scenes are sized `100dvh` and read back with
 * `clientHeight`, and on iOS the URL bar collapses the element without a
 * dependable window event. `window.resize` is still listened to, but only for
 * the pixel-ratio decision.
 */
export class Viewport {
  private listeners = new Set<ViewportListener>();
  private observer: ResizeObserver | null = null;
  private motionQuery: MediaQueryList | null = null;
  private pointerQuery: MediaQueryList | null = null;
  private snapshot: ViewportSnapshot;
  private element: HTMLElement | null = null;
  private frame = 0;

  constructor() {
    this.snapshot = this.measure(1280, 720);
  }

  /** Start observing. Returns a teardown. */
  observe(element: HTMLElement): () => void {
    this.element = element;

    const update = () => this.schedule();

    this.observer = new ResizeObserver(update);
    this.observer.observe(element);

    if (typeof window !== "undefined") {
      window.addEventListener("resize", update);
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.pointerQuery = window.matchMedia("(pointer: coarse)");
      this.motionQuery.addEventListener("change", update);
      this.pointerQuery.addEventListener("change", update);
    }

    this.recompute();

    return () => {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.observer?.disconnect();
      this.observer = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", update);
      }
      this.motionQuery?.removeEventListener("change", update);
      this.pointerQuery?.removeEventListener("change", update);
      this.motionQuery = null;
      this.pointerQuery = null;
      this.listeners.clear();
      this.element = null;
    };
  }

  /** At most one notification per frame, however many events arrive. */
  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.recompute();
    });
  }

  private recompute() {
    const el = this.element;
    if (!el) return;
    const width = el.clientWidth || 1;
    const height = el.clientHeight || 1;
    this.snapshot = this.measure(width, height);
    publishForVerification(this.snapshot);
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private measure(width: number, height: number): ViewportSnapshot {
    const aspect = width / height;
    const reducedMotion =
      this.motionQuery?.matches ??
      (typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false);
    const coarsePointer =
      this.pointerQuery?.matches ??
      (typeof window !== "undefined"
        ? window.matchMedia("(pointer: coarse)").matches
        : false);
    const tier = detectTier(coarsePointer, width);
    const fit = fitComposition(aspect);

    return {
      width,
      height,
      aspect,
      dpr: dprFor(tier, reducedMotion),
      tier,
      reducedMotion,
      coarsePointer,
      halfW: fit.halfW,
      halfH: fit.halfH,
      planeScale: fit.planeScale,
      planeOffsetY: fit.planeOffsetY,
      focalX: 0,
      focalY: fit.focalY,
      navCenterX: 0,
      navCenterY: fit.focalY * NAV_FOCAL_BIAS,
      safeArea: readSafeArea(),
    };
  }

  get current(): ViewportSnapshot {
    return this.snapshot;
  }

  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Normalised device coordinates (-1..1) to world position at the plane. */
  ndcToWorld(ndcX: number, ndcY: number): { x: number; y: number } {
    return { x: ndcX * this.snapshot.halfW, y: ndcY * this.snapshot.halfH };
  }

  /** World position at the plane to CSS pixels within the observed element. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return worldToScreenIn(this.snapshot, x, y);
  }

  /** A DOM rect within the observed element, as a world-space box. */
  rectToWorld(rect: DOMRect): {
    x: number;
    y: number;
    halfW: number;
    halfH: number;
  } {
    const s = this.snapshot;
    const cx = ((rect.left + rect.width / 2) / s.width) * 2 - 1;
    const cy = 1 - ((rect.top + rect.height / 2) / s.height) * 2;
    return {
      x: cx * s.halfW,
      y: cy * s.halfH,
      halfW: (rect.width / s.width) * s.halfW,
      halfH: (rect.height / s.height) * s.halfH,
    };
  }
}

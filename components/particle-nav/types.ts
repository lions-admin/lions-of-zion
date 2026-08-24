export interface NavNode {
  id: string;
  /** DOM label text — rendered as a real link, never canvas type. */
  label: string;
  href: string;
  /** Baked single-channel SDF (public path) for the icon particle cluster. */
  iconSdfUrl: string;
}

export interface ParticleNavTheme {
  /** Deep field behind everything. */
  background: string;
  /** Resting particle gold. */
  gold: string;
  /** Excited particle colour (velocity-driven ramp end). */
  excited: string;
  /** Hover/focus ring + focus outline colour. */
  hover: string;
  /** Intelligence-network scan blue. */
  starBlue: string;
}

export interface SimParams {
  springStiffness: number;
  springDamping: number;
  curlAmp: number;
  curlFreq: number;
  curlTimescale: number;
  repelRadius: number;
  repelStrength: number;
  streamFraction: number;
  streamDurationMs: number;
  returnDurationMs: number;
  pointSizeMin: number;
  pointSizeMax: number;
  bloomThreshold: number;
  bloomStrength: number;
  bloomRadius: number;
  idleRotateDegPerSec: number;
  parallaxDeg: number;
  parallaxDamping: number;
  pulseLoopSec: number;
  pulseStaggerSec: number;
  activateImpulse: number;
  activateDollyDistance: number;
}

export interface ParticleNavProps {
  /** 6–10 nodes, clockwise from 12 o'clock. Configuration, not geometry. */
  nodes: NavNode[];
  /** Orbit radius of the spoke nodes in world units. */
  radius?: number;
  /** Overrides the tier-selected lion particle budget (matching a baked LOD). */
  particleBudget?: 180_000 | 90_000 | 45_000;
  theme?: Partial<ParticleNavTheme>;
  /** Force the WebGL2 backend — the fallback must be tested deliberately. */
  forceWebGL?: boolean;
  /**
   * Mount the GPU scene. DOM links and the fallback poster always render;
   * integration hosts may delay the expensive renderer during an intro.
   */
  active?: boolean;
  /** Dev-only: live simulation parameter overrides (demo route control panel). */
  simOverrides?: Partial<SimParams>;
  /** Dev-only: called once per second with the measured frame time. */
  onFrameStats?: (ms: number, fps: number) => void;
}

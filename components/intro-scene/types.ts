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
  pointSizeMin: number;
  pointSizeMax: number;
  bloomThreshold: number;
  bloomStrength: number;
  bloomRadius: number;
  idleRotateDegPerSec: number;
  parallaxDeg: number;
  parallaxDamping: number;
}

export interface IntroSceneProps {
  /** Overrides the tier-selected lion particle budget (matching a baked LOD). */
  particleBudget?: 180_000 | 90_000 | 45_000;
  theme?: Partial<ParticleNavTheme>;
  /** Force the WebGL2 backend — the fallback must be tested deliberately. */
  forceWebGL?: boolean;
  /** Mount the GPU scene. The poster always renders. */
  active?: boolean;
}

/**
 * Layer 5 — Bézier connectors. A plane strip whose vertices are swept along a
 * quadratic Bézier in the vertex stage (never THREE.Line — it cannot hold
 * thickness, brief §4.1). Dash animation via fract(t − time·speed), plus
 * staggered travelling glow points; hover triples dash speed, activate floods
 * gold (brief §7).
 */
import { AdditiveBlending, Color, DoubleSide, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import {
  color,
  cameraPosition,
  clamp,
  cross,
  float,
  fract,
  mix,
  normalize,
  smoothstep,
  time,
  uniform,
  uv,
} from 'three/tsl';
import type { ParticleNavTheme } from '../types';

export interface ConnectorHandle {
  material: MeshBasicNodeMaterial;
  uniforms: {
    start: ReturnType<typeof uniform>;
    ctrl: ReturnType<typeof uniform>;
    end: ReturnType<typeof uniform>;
    /** 0 idle → 1 hovered/focused (eased CPU-side). */
    active: ReturnType<typeof uniform>;
    /** 0→1 gold flood on activate. */
    flood: ReturnType<typeof uniform>;
    /** Travelling pulse phase 0..1, staggered per spoke, driven CPU-side. */
    pulsePhase: ReturnType<typeof uniform>;
    pxToWorld: ReturnType<typeof uniform>;
    reducedMotion: ReturnType<typeof uniform>;
  };
}

export function createConnectorMaterial(theme: ParticleNavTheme): ConnectorHandle {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });

  const uniforms = {
    start: uniform(new Vector3()),
    ctrl: uniform(new Vector3()),
    end: uniform(new Vector3()),
    active: uniform(0),
    flood: uniform(0),
    pulsePhase: uniform(0),
    pxToWorld: uniform(0.004),
    reducedMotion: uniform(0),
  };

  const t = uv().x;
  const omt = float(1).sub(t);
  const bez = uniforms.start
    .mul(omt.mul(omt))
    .add(uniforms.ctrl.mul(omt.mul(t).mul(2)))
    .add(uniforms.end.mul(t.mul(t)));
  // dB/dt — tangent of the quadratic
  const tangent = uniforms.ctrl.sub(uniforms.start).mul(omt.mul(2)).add(uniforms.end.sub(uniforms.ctrl).mul(t.mul(2)));
  const viewDir = normalize(cameraPosition.sub(bez));
  const side = normalize(cross(normalize(tangent), viewDir));

  // Reference-like hairline: nearly invisible at rest, crisp on intent.
  const widthPx = mix(float(0.7), float(1.4), uniforms.active);
  material.positionNode = bez.add(side.mul(uv().y.sub(0.5)).mul(widthPx.mul(uniforms.pxToWorld)));

  // ---- shading along t ----
  const dashSpeed = mix(float(0.12), float(0.36), uniforms.active); // ×3 on hover
  const dashT = mix(time.mul(dashSpeed), float(0), uniforms.reducedMotion);
  const dash = fract(t.mul(9).sub(dashT));
  const dashMask = smoothstep(0.0, 0.12, dash).mul(smoothstep(0.62, 0.5, dash));

  // travelling glow point (4.2 s loop, staggered per spoke — phase from CPU)
  const pulseD = fract(t.sub(uniforms.pulsePhase));
  const pulse = smoothstep(0.995, 1.0, float(1).sub(pulseD)).add(smoothstep(0.06, 0.0, pulseD)).mul(
    float(1).sub(uniforms.reducedMotion),
  );

  const gold = color(new Color(theme.gold));
  const bright = color(new Color(theme.excited));
  const hover = color(new Color(theme.hover));

  const base = mix(gold.mul(0.38), hover, uniforms.active);
  const lit = mix(base, bright, clamp(pulse, 0, 1));
  material.colorNode = mix(lit, bright, uniforms.flood);

  const baseAlpha = mix(float(0.07), float(0.48), uniforms.active);
  const alpha = baseAlpha
    .add(dashMask.mul(mix(0.035, 0.22, uniforms.active)))
    .add(pulse.mul(0.72))
    .add(uniforms.flood.mul(0.9));
  // fade the root where it exits the lion, keep the node end crisp
  const endFade = smoothstep(0.0, 0.12, t);
  material.opacityNode = clamp(alpha, 0, 1).mul(endFade);

  return { material, uniforms };
}

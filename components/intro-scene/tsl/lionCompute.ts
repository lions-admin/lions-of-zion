/**
 * Layer 3 — the only per-frame compute in the scene (brief §4).
 *
 * Per-particle state in instancedArray storage: position, velocity (vec4-aligned;
 * w unused). Homes and normals are read-only uploads from the bake; per-particle
 * seed is derived on-GPU from instanceIndex — it never ships.
 *
 * Forces per §6: spring to home, curl-noise drift, pointer repulsion, hover
 * stream (12% detach toward the active connector's Bézier), activate impulse.
 * The stream target is always DERIVED FROM HOME, so unhover return is
 * drift-free by construction (acceptance #2).
 */
import {
  Fn,
  If,
  float,
  vec3,
  vec4,
  hash,
  fract,
  mix,
  min,
  smoothstep,
  normalize,
  length,
  step,
  pow,
  uniform,
  instancedArray,
  instanceIndex,
  time,
} from 'three/tsl';
import { Vector3 } from 'three/webgpu';
import { curlNoise } from './curlNoise';
import type { DecodedLionBake } from '../binary/lionFormat';
import type { SimParams } from '../types';

const vec4Array = (data: Float32Array | number) =>
  typeof data === 'number' ? instancedArray(data, 'vec4') : instancedArray(data, 'vec4');
type Vec4Storage = ReturnType<typeof vec4Array>;

export interface LionSim {
  count: number;
  crownStart: number;
  positions: Vec4Storage;
  velocities: Vec4Storage;
  homes: Vec4Storage;
  origins: Vec4Storage;
  normals: Vec4Storage;
  uniforms: {
    assemble: ReturnType<typeof uniform>;
    delta: ReturnType<typeof uniform>;
    stiffness: ReturnType<typeof uniform>;
    damping: ReturnType<typeof uniform>;
    curlAmp: ReturnType<typeof uniform>;
    curlFreq: ReturnType<typeof uniform>;
    curlTimescale: ReturnType<typeof uniform>;
    pointer: ReturnType<typeof uniform>;
    repelRadius: ReturnType<typeof uniform>;
    repelStrength: ReturnType<typeof uniform>;
    streamFraction: ReturnType<typeof uniform>;
    hoverAmount: ReturnType<typeof uniform>;
    bezStart: ReturnType<typeof uniform>;
    bezCtrl: ReturnType<typeof uniform>;
    bezEnd: ReturnType<typeof uniform>;
    burst: ReturnType<typeof uniform>;
    reducedMotion: ReturnType<typeof uniform>;
  };
  initCompute: object;
  updateCompute: object;
  dispose(): void;
}

export function createLionSim(decoded: DecodedLionBake, params: SimParams): LionSim {
  const { count } = decoded.header;

  // Stable, deterministic launch positions spread across the viewport. The
  // entrance uses direct interpolation from these origins — not fluid forces.
  const originData = new Float32Array(count * 4);
  let state = 0x6d2b79f5;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const angle = random() * Math.PI * 2;
    const radius = 0.35 + Math.sqrt(random()) * 3.45;
    originData[o] = Math.cos(angle) * radius * 1.08 + (random() - 0.5) * 0.35;
    originData[o + 1] = Math.sin(angle) * radius * 0.84 + (random() - 0.5) * 0.28;
    originData[o + 2] = -0.55 + (random() - 0.5) * 1.1;
    originData[o + 3] = 0;
  }

  const origins = vec4Array(originData);
  const positions = vec4Array(originData.slice());
  const velocities = vec4Array(count);
  const homes = vec4Array(decoded.positions.slice());
  const normals = vec4Array(decoded.normals);

  const uniforms = {
    assemble: uniform(0),
    delta: uniform(1 / 60),
    stiffness: uniform(params.springStiffness),
    damping: uniform(params.springDamping),
    curlAmp: uniform(params.curlAmp),
    curlFreq: uniform(params.curlFreq),
    curlTimescale: uniform(params.curlTimescale),
    pointer: uniform(new Vector3(0, 0, 99)),
    repelRadius: uniform(params.repelRadius),
    repelStrength: uniform(params.repelStrength),
    streamFraction: uniform(params.streamFraction),
    hoverAmount: uniform(0),
    bezStart: uniform(new Vector3()),
    bezCtrl: uniform(new Vector3()),
    bezEnd: uniform(new Vector3()),
    burst: uniform(0),
    reducedMotion: uniform(0),
  };

  const initCompute = Fn(() => {
    positions.element(instanceIndex).assign(origins.element(instanceIndex));
    velocities.element(instanceIndex).assign(vec4(0, 0, 0, 0));
  })().compute(count) as object;

  const updateCompute = Fn(() => {
    const pos = positions.element(instanceIndex);
    const vel = velocities.element(instanceIndex);
    const home = homes.element(instanceIndex).xyz.toVar();
    const seed = hash(instanceIndex).toVar();

    const dt = min(uniforms.delta, float(1 / 30)).toVar();

    If(uniforms.assemble.lessThan(0.999), () => {
      // A precise gather, not a liquid simulation. Small per-particle delays
      // reveal streams travelling inward from the whole page, then every point
      // lands on its exact authored home position.
      const origin = origins.element(instanceIndex).xyz;
      const delay = hash(instanceIndex.add(431)).mul(0.2);
      const gather = smoothstep(delay, delay.add(0.76), uniforms.assemble).toVar();
      const arcSeed = vec3(
        hash(instanceIndex.add(701)).sub(0.5),
        hash(instanceIndex.add(907)).sub(0.5),
        hash(instanceIndex.add(1103)).sub(0.5),
      );
      const arc = arcSeed.mul(gather.mul(float(1).sub(gather)).mul(0.48));
      pos.xyz.assign(mix(origin, home, gather).add(arc));
      vel.xyz.assign(vec3(0, 0, 0));
    }).ElseIf(uniforms.reducedMotion.greaterThan(0.5), () => {
      // Designed path, not a switch-off: settle onto home + a static curl
      // offset so the field still looks composed, then hold.
      const offset = curlNoise(home.mul(uniforms.curlFreq)).mul(uniforms.curlAmp.mul(6));
      const target = home.add(offset);
      const blend = min(float(1), dt.mul(4));
      pos.xyz.assign(pos.xyz.add(target.sub(pos.xyz).mul(blend)));
      vel.xyz.assign(vec3(0, 0, 0));
    }).Else(() => {
      // Hover stream: the seed<fraction subset targets a point along the active
      // connector's Bézier instead of home. t along the curve comes from the
      // seed, so the stream is stable frame to frame.
      const inStream = step(seed, uniforms.streamFraction).toVar();
      const t = fract(seed.mul(13.7331)).toVar();
      const omt = float(1).sub(t);
      const bez = uniforms.bezStart
        .mul(omt.mul(omt))
        .add(uniforms.bezCtrl.mul(omt.mul(t).mul(2)))
        .add(uniforms.bezEnd.mul(t.mul(t)));
      const scatter = vec3(
        hash(instanceIndex.add(101)).sub(0.5),
        hash(instanceIndex.add(211)).sub(0.5),
        hash(instanceIndex.add(307)).sub(0.5),
      ).mul(0.22);
      const streamMix = uniforms.hoverAmount.mul(inStream);
      const target = home.add(bez.add(scatter).sub(home).mul(streamMix)).toVar();

      // Spring to target (which IS home whenever the stream is off).
      const force = target.sub(pos.xyz).mul(uniforms.stiffness).toVar();

      // Ambient curl drift — below conscious notice.
      const curl = curlNoise(
        pos.xyz.mul(uniforms.curlFreq).add(time.mul(uniforms.curlTimescale)),
      );
      force.addAssign(curl.mul(uniforms.curlAmp.mul(60)));

      // Pointer repulsion, smoothstep falloff.
      const dp = pos.xyz.sub(uniforms.pointer).toVar();
      const dist = length(dp).max(0.0001).toVar();
      const repel = smoothstep(uniforms.repelRadius, float(0), dist).mul(uniforms.repelStrength);
      force.addAssign(dp.div(dist).mul(repel));

      // Activate burst — radial impulse, uniform is a one-frame pulse.
      If(uniforms.burst.greaterThan(0.001), () => {
        vel.xyz.addAssign(normalize(pos.xyz.add(vec3(0, 0, 0.001))).mul(uniforms.burst));
      });

      vel.xyz.addAssign(force.mul(dt));
      // Damping is specified per 60 Hz step — dt-correct it.
      vel.xyz.mulAssign(pow(uniforms.damping, dt.mul(60)));
      pos.xyz.addAssign(vel.xyz.mul(dt));
    });
  })().compute(count);

  return {
    count,
    crownStart: decoded.header.crownStart,
    positions,
    velocities,
    homes,
    origins,
    normals,
    uniforms,
    initCompute,
    updateCompute,
    dispose() {
      // instancedArray storage is not garbage collected (brief §2.1).
      for (const node of [positions, velocities, homes, origins, normals]) {
        (node as unknown as { value?: { dispose(): void } }).value?.dispose();
        (node as unknown as { dispose?: () => void }).dispose?.();
      }
    },
  };
}

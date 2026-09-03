import { Color, NormalBlending, SpriteNodeMaterial, Vector3, type Node } from 'three/webgpu';
import {
  clamp,
  color,
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  STREAM_LEAD_SHARE,
  STREAM_STAGGER_SPAN,
  STREAM_THROAT_T,
  STREAM_TRAVEL_WINDOW,
} from '@/components/intro/streamPath';
import type { TextCloud } from '@/components/intro/textCloud';

export interface IntroTextMaterialOptions {
  coreColor?: string;
  edgeColor?: string;
  sizeMinPx?: number;
  sizeMaxPx?: number;
  alphaMin?: number;
  alphaMax?: number;
  /**
   * Per-particle lion source, vec4 per text particle: xyz a baked lion home in
   * lion-model space, w the particle's lane across the throat (0..1). Built by
   * `components/intro/lionSourceMap.ts`. With it, a particle enters by leaving
   * the lion; without it the material keeps the generic slide-in.
   */
  lionSources?: Float32Array;
}

/* World gap between the lion's lowest particle and the throat. */
const THROAT_GAP = 0.14;
/* The throat is narrow by design: a channel, not a curtain. Half-width, world. */
const THROAT_HALF_WIDTH = 0.11;
/* The throat never sits below the glyph it feeds; the second leg must fall. */
const THROAT_MIN_RISE = 0.3;
/* Restrained seeded curl on the path — zero at both ends, never a scatter. */
const CURL_AMPLITUDE = 0.035;
const LANE_DRIFT = 0.08;

/* The build-order stagger and the throat's place on the path are shared with
   `components/intro/streamPath.ts`, which mirrors this arithmetic on the CPU so
   `tests/intro-preroll.test.ts` can pin the pre-roll's timing without a GPU.
   The window is wide enough for the stream to be seen as a stream — 28% of an
   0.8 s entrance is ~220 ms per particle — and the last particle lands exactly
   at `build = 1`. */

export function createIntroTextMaterial(
  cloud: TextCloud,
  options: IntroTextMaterialOptions = {},
) {
  const packedPositions = new Float32Array(cloud.count * 4);
  const packedTraits = new Float32Array(cloud.count * 4);
  for (let i = 0; i < cloud.count; i++) {
    const p = i * 3;
    const q = i * 4;
    packedPositions[q] = cloud.positions[p];
    packedPositions[q + 1] = cloud.positions[p + 1];
    packedPositions[q + 2] = cloud.positions[p + 2];
    packedPositions[q + 3] = cloud.order[i];
    packedTraits[q] = cloud.seeds[p];
    packedTraits[q + 1] = cloud.seeds[p + 1];
    packedTraits[q + 2] = cloud.seeds[p + 2];
    packedTraits[q + 3] = cloud.edges[i];
  }
  if (options.lionSources && options.lionSources.length !== cloud.count * 4) {
    throw new Error(
      `introTextMaterial: lionSources holds ${options.lionSources.length / 4} particles, cloud has ${cloud.count}`,
    );
  }

  const positions = instancedArray(packedPositions, 'vec4');
  const traits = instancedArray(packedTraits, 'vec4');
  const sources = options.lionSources ? instancedArray(options.lionSources, 'vec4') : null;
  /* The trajectory is a uniform rather than a build option because it depends
     on the frame's width, and the frame changes on every resize. Baking it into
     the node graph would tie a rotation to a full glyph resample — the exact
     cost the layout's width quantiser exists to avoid. The lion transform and
     the row offset are uniforms for the same reason, one frame at a time: the
     source has to stay attached to a lion that is still rising while the rows
     beneath it shift. */
  const uniforms = {
    build: uniform(0),
    disperse: uniform(0),
    opacity: uniform(0),
    focus: uniform(0),
    pxToWorld: uniform(0.004),
    dpr: uniform(1),
    originBias: uniform(new Vector3(-1.5, -0.725, -0.65)),
    originSpan: uniform(new Vector3(-2.3, 1.45, 1.3)),
    windBias: uniform(new Vector3(2.4, 1.7, -1.6)),
    windSpan: uniform(new Vector3(3, 2.5, 3.2)),
    /** The lion group's scale and world Y — `ExperienceFrame.lionScale/lionY`. */
    lionScale: uniform(1),
    lionY: uniform(0),
    /** Lowest lion home in model space, so the throat hangs under the lion at any scale. */
    lionBottom: uniform(-0.85),
    /** World position of the sprite's parent group: the row this line occupies. */
    groupOffset: uniform(new Vector3()),
    /**
     * `ExperienceFrame.textFlow` for the line that pre-rolls, 0 for every
     * other unit. Carries the leading subset down to the throat before the
     * build starts — see `components/intro/streamPath.ts`.
     */
    flowLead: uniform(0),
  };
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
  });

  const point = positions.element(instanceIndex);
  const trait = traits.element(instanceIndex);
  const seed = trait.xyz;
  const glyph = point.xyz;
  const start = point.w.mul(STREAM_STAGGER_SPAN);
  const built = smoothstep(start, start.add(STREAM_TRAVEL_WINDOW), uniforms.build);
  const eraseStart = point.w.mul(0.52);
  const erased = smoothstep(eraseStart, eraseStart.add(0.3), uniforms.disperse);
  const windTarget = glyph.add(uniforms.windBias.add(seed.mul(uniforms.windSpan)));

  let visiblePosition;
  /* Alpha follows the path parameter, not the build: during the pre-roll the
     leading particles have left the lion while `build` is still zero, and a
     presence keyed on `build` would move them invisibly. */
  let presence;
  if (sources) {
    /* Everything below is in the sprite's group-local frame, which is the row
       frame: world = local + groupOffset. */
    const source = sources.element(instanceIndex);
    const lionLocal = source.xyz
      .mul(uniforms.lionScale)
      .add(vec3(0, uniforms.lionY, 0))
      .sub(uniforms.groupOffset);
    const lionBottomLocal = uniforms.lionBottom
      .mul(uniforms.lionScale)
      .add(uniforms.lionY)
      .sub(uniforms.groupOffset.y);
    /* (b) The throat: a narrow channel just under the settled lion. Lanes come
       from the source map so the channel stays narrow without a scatter, and
       a floor keeps the second leg falling even if the lion sits low. */
    const throatY = max(lionBottomLocal.sub(THROAT_GAP), glyph.y.add(THROAT_MIN_RISE));
    const lane = source.w.sub(0.5);
    const throat = vec3(
      lane.mul(THROAT_HALF_WIDTH * 2).add(seed.y.sub(0.5).mul(0.05)),
      throatY,
      glyph.z.add(seed.z.sub(0.5).mul(0.08)),
    );

    /* One progress drives both legs, so the path and the glyph stagger cannot
       drift apart: `built` is the same value that reveals the letter. The
       stream pre-roll adds the only other term — a lead, taken by the head of
       the build order and capped at the throat, so those particles are already
       out of the lion and gathered below it when the build starts. `max` of two
       continuous functions has no seam at the handover, and `built` reaches 1
       for every particle at `build = 1`, so the line still lands on schedule. */
    const leadShare = float(1).sub(smoothstep(0, STREAM_LEAD_SHARE, point.w));
    const lead = uniforms.flowLead.mul(leadShare).mul(STREAM_THROAT_T);
    const t = max(built, lead);
    const tA = clamp(t.div(STREAM_THROAT_T), 0, 1);
    const tB = clamp(t.sub(STREAM_THROAT_T).div(1 - STREAM_THROAT_T), 0, 1);

    /* (a → b) Out of the surface, drawn inward and down into the throat. The
       control point sits under the source, so the first motion is downward. */
    const ctrlA = vec3(
      lionLocal.x.mul(0.3),
      mix(lionLocal.y, throatY, 0.45),
      lionLocal.z.mul(0.5),
    );
    const legA = quadraticBezier(lionLocal, ctrlA, throat, tA);
    /* (b → c) Keep falling out of the throat, then fan across to the glyph. */
    const ctrlB = vec3(
      mix(throat.x, glyph.x, 0.22),
      mix(throatY, glyph.y, 0.55),
      glyph.z,
    );
    const legB = quadraticBezier(throat, ctrlB, glyph, tB);
    const onPath = mix(legA, legB, step(STREAM_THROAT_T, t));

    /* Curl is a texture on the stream, not a force: seeded, small, and gone at
       both ends so a particle leaves exactly from the lion and lands exactly
       on its glyph. */
    const envelope = sin(t.mul(Math.PI));
    const curl = vec3(
      sin(t.mul(9).add(seed.x.mul(6.2832))).mul(CURL_AMPLITUDE).add(seed.x.sub(0.5).mul(LANE_DRIFT)),
      0,
      cos(t.mul(7).add(seed.z.mul(6.2832))).mul(CURL_AMPLITUDE),
    ).mul(envelope);
    visiblePosition = onPath.add(curl);
    /* The reveal is the transfer, not a fade: a particle is drawn from the
       moment it leaves the lion. In flight it carries a little less alpha than
       when it has landed, which keeps the stream legible against the row it is
       still building and lets the settled glyph read at full weight. */
    presence = smoothstep(0, 0.04, t).mul(mix(float(0.6), float(1), t));
  } else {
    /* `bias + span * seed` reproduces the authored spans exactly: the old
       `(seed - 0.5) * s` forms are the same line with the half folded into the
       bias, which is what lets one uniform pair carry every axis. */
    const origin = glyph.add(uniforms.originBias.add(seed.mul(uniforms.originSpan)));
    visiblePosition = mix(origin, glyph, built);
    /* With no source the generic slide keeps its fade, since it has nothing
       to show. */
    presence = built;
  }

  const edgeDrift = sin(time.mul(0.9).add(seed.x.mul(18))).mul(trait.w).mul(0.012);
  material.positionNode = mix(visiblePosition, windTarget, erased).add(
    vec3(0, edgeDrift.mul(built).mul(float(1).sub(erased)), 0),
  );
  material.scaleNode = mix(
    float(options.sizeMinPx ?? 0.9),
    float(options.sizeMaxPx ?? 1.58),
    hash(instanceIndex.add(53)),
  )
    .mul(mix(float(1), float(1.25), uniforms.focus))
    .mul(uniforms.dpr)
    .mul(uniforms.pxToWorld);
  const printHead = smoothstep(0.075, 0, uniforms.build.sub(start.add(STREAM_TRAVEL_WINDOW * 0.7)).abs());
  material.colorNode = mix(
    color(new Color(options.coreColor ?? '#F1EDE4')),
    color(new Color(options.edgeColor ?? '#FFFFFF')),
    trait.w.mul(0.72).add(printHead.mul(0.18)),
  );
  material.opacityNode = smoothstep(0.5, 0.1, uv().sub(vec2(0.5)).length())
    .mul(presence)
    .mul(float(1).sub(erased))
    .mul(uniforms.opacity)
    .mul(mix(float(options.alphaMin ?? 0.82), float(options.alphaMax ?? 1), trait.w));

  const dispose = () => {
    material.dispose();
    const storages = sources ? [positions, traits, sources] : [positions, traits];
    for (const storage of storages) {
      (storage as unknown as { value?: { dispose(): void }; dispose?: () => void }).value?.dispose();
      (storage as unknown as { dispose?: () => void }).dispose?.();
    }
  };

  return { material, uniforms, dispose };
}

function quadraticBezier(p0: Node<'vec3'>, c: Node<'vec3'>, p1: Node<'vec3'>, t: Node<'float'>) {
  const omt = float(1).sub(t);
  return p0
    .mul(omt.mul(omt))
    .add(c.mul(omt.mul(t).mul(2)))
    .add(p1.mul(t.mul(t)));
}

export type IntroTextMaterialHandle = ReturnType<typeof createIntroTextMaterial>;

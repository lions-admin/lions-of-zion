'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Sprite } from 'three/webgpu';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import {
  ROLLING_STORY_LINES_BY_LAYOUT,
  ROLLING_POOL_SIZE,
} from '@/components/intro/rolling-story-timeline';
import { buildTextCloud } from '@/components/intro/textCloud';
import type { TextCloud } from '@/components/intro/textCloud';
import {
  createIntroTextMaterial,
  type IntroTextMaterialOptions,
} from '../tsl/introTextMaterial';
import type { ExperienceFrame } from '../introFrame';
import type { SafeAreaInsets } from '../config';

const CAMERA_Z = 8.2;
const FOV = 45;
const SKIP_WIDTH_PX = 132;
const SKIP_HEIGHT_PX = 52;
const SKIP_CLOUD_WIDTH = 1.06;
const SKIP_CLOUD_HEIGHT = 0.42;

interface TextUnit {
  sprite: Sprite;
  handle: ReturnType<typeof createIntroTextMaterial>;
}

interface TextSet {
  lines: TextUnit[];
  brand: TextUnit;
  skip: TextUnit;
}

function makeUnit(
  cloud: ReturnType<typeof buildTextCloud>,
  options?: IntroTextMaterialOptions,
): TextUnit {
  const handle = createIntroTextMaterial(cloud, options);
  const sprite = new Sprite(handle.material);
  sprite.count = cloud.count;
  sprite.frustumCulled = false;
  sprite.renderOrder = 20;
  sprite.visible = false;
  return { sprite, handle };
}

function disposeSet(set: TextSet) {
  for (const unit of [...set.lines, set.brand, set.skip]) unit.handle.dispose();
}

function buildCapsuleCloud(count: number): TextCloud {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const order = new Float32Array(count);
  const edges = new Float32Array(count);
  const sizes = new Float32Array(count);
  const radius = SKIP_CLOUD_HEIGHT * 0.5;
  const straight = SKIP_CLOUD_WIDTH - radius * 2;
  const perimeter = straight * 2 + Math.PI * radius * 2;
  const topFraction = straight / perimeter;
  const arcFraction = (Math.PI * radius) / perimeter;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const jitter = Math.sin(i * 91.731) * 0.0035;
    let x = 0;
    let y = 0;
    if (t < topFraction) {
      const local = t / topFraction;
      x = -straight * 0.5 + local * straight;
      y = radius;
    } else if (t < topFraction + arcFraction) {
      const local = (t - topFraction) / arcFraction;
      const angle = Math.PI * 0.5 - local * Math.PI;
      x = straight * 0.5 + Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
    } else if (t < topFraction * 2 + arcFraction) {
      const local = (t - topFraction - arcFraction) / topFraction;
      x = straight * 0.5 - local * straight;
      y = -radius;
    } else {
      const local = (t - topFraction * 2 - arcFraction) / arcFraction;
      const angle = -Math.PI * 0.5 - local * Math.PI;
      x = -straight * 0.5 + Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
    }
    const p = i * 3;
    positions[p] = x + jitter;
    positions[p + 1] = y + jitter * 0.5;
    positions[p + 2] = 0;
    const seed = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    seeds[p] = seed;
    seeds[p + 1] = (seed * 1.73) % 1;
    seeds[p + 2] = (seed * 2.31) % 1;
    order[i] = t;
    edges[i] = 1;
    sizes[i] = 1;
  }
  return { positions, seeds, order, edges, sizes, count };
}

function mergeClouds(...clouds: TextCloud[]): TextCloud {
  const count = clouds.reduce((sum, cloud) => sum + cloud.count, 0);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const order = new Float32Array(count);
  const edges = new Float32Array(count);
  const sizes = new Float32Array(count);
  let cursor = 0;
  for (const cloud of clouds) {
    positions.set(cloud.positions, cursor * 3);
    seeds.set(cloud.seeds, cursor * 3);
    order.set(cloud.order, cursor);
    edges.set(cloud.edges, cursor);
    sizes.set(cloud.sizes, cursor);
    cursor += cloud.count;
  }
  return { positions, seeds, order, edges, sizes, count };
}

export interface IntroTextProps {
  frameRef: { current: ExperienceFrame | null };
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  lightweight: boolean;
  safeArea: SafeAreaInsets;
  skipFocusRef: { current: number };
}

export function IntroText({
  frameRef,
  pxToWorldRef,
  dprRef,
  lightweight,
  safeArea,
  skipFocusRef,
}: IntroTextProps) {
  const size = useThree((state) => state.size);
  const layout = size.width < 720 ? 'mobile' : 'desktop';
  const viewHeight = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);
  const viewWidth = viewHeight * (size.width / Math.max(1, size.height));
  const mobileTextMaxWidth = Math.max(2.05, Math.min(2.68, viewWidth - 0.48));
  const groupRefs = useRef<(Group | null)[]>([]);
  const activeBySlotRef = useRef<
    (NonNullable<ExperienceFrame['story']>['activeLines'][number] | null)[]
  >(Array.from({ length: ROLLING_POOL_SIZE }, () => null));
  const brandRef = useRef<Group>(null);
  const skipRef = useRef<Group>(null);
  const [textSet, setTextSet] = useState<TextSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: TextSet | null = null;
    setTextSet(null);
    const loader = new FontLoader();
    loader.load(
      '/assets/gentilis_regular.typeface.json',
      (font: Font) => {
        const mobile = layout === 'mobile';
        const lines = ROLLING_STORY_LINES_BY_LAYOUT[layout];
        const lineUnits = lines.map((line, index) => {
          const final = index === lines.length - 1;
          const maxParticles = lightweight
            ? final ? 5_200 : 5_400
            : final ? 7_000 : mobile ? 5_200 : 7_500;
          return makeUnit(buildTextCloud([line], font, {
            maxParticles,
            maxWidth: final ? (mobile ? Math.min(2.58, mobileTextMaxWidth) : 3.55) : mobile ? mobileTextMaxWidth : 8.65,
            fontScale: final ? (mobile ? 0.58 : 0.7) : mobile ? 0.205 : 0.415,
            centerY: 0,
            lineHeight: 0.5,
            density: lightweight ? 350 : final ? 500 : mobile ? 390 : 440,
            outlineRatio: final ? 0.3 : 0.27,
            seed: index * 20_003 + (mobile ? 101 : 0),
          }));
        });
        const brand = makeUnit(buildTextCloud(['LIONSOFZION'], font, {
          maxParticles: lightweight ? 2_800 : 5_000,
          maxWidth: mobile ? Math.min(2.58, mobileTextMaxWidth) : 4.5,
          fontScale: mobile ? 0.235 : 0.38,
          centerY: 0,
          density: lightweight ? 390 : 470,
          outlineRatio: 0.32,
          seed: mobile ? 91_131 : 91_117,
        }));
        const skipText = buildTextCloud(['SKIP INTRO'], font, {
          maxParticles: lightweight ? 2_400 : 3_400,
          maxWidth: 0.72,
          fontScale: 0.13,
          centerY: 0,
          density: lightweight ? 310 : 430,
          outlineRatio: 0.42,
          seed: 71_903,
        });
        const skip = makeUnit(
          mergeClouds(skipText, buildCapsuleCloud(lightweight ? 1_050 : 1_650)),
          {
            coreColor: '#C9A24B',
            edgeColor: '#FFE9B0',
            sizeMinPx: 0.72,
            sizeMaxPx: 1.32,
            alphaMin: 0.5,
            alphaMax: 0.88,
          },
        );
        created = { lines: lineUnits, brand, skip };
        if (cancelled) disposeSet(created);
        else setTextSet(created);
      },
      undefined,
      (error) => console.error('[particle-nav] intro font load failed:', error),
    );
    return () => {
      cancelled = true;
      if (created) disposeSet(created);
    };
  }, [layout, lightweight, mobileTextMaxWidth]);

  useFrame(() => {
    if (!textSet) return;
    const experience = frameRef.current;
    const story = experience?.story;
    const activeBySlot = activeBySlotRef.current;
    activeBySlot.fill(null);
    for (const line of story?.activeLines ?? []) activeBySlot[line.slot] = line;

    for (let slot = 0; slot < ROLLING_POOL_SIZE; slot++) {
      const group = groupRefs.current[slot];
      const active = activeBySlot[slot];
      const units = textSet.lines;
      for (let i = slot; i < units.length; i += ROLLING_POOL_SIZE) units[i].sprite.visible = false;
      if (!group || !active || !experience) continue;
      const unit = units[active.index];
      if (!unit) continue;
      unit.sprite.visible = experience.textOpacity > 0.001;
      const enteringOffset = active.phase === 'enter' && active.index >= 4 ? 1 - active.build : 0;
      const top = layout === 'mobile' ? 0.38 : 0.55;
      const gap = layout === 'mobile' ? 0.62 : 0.68;
      group.position.set(0, top - (active.row + enteringOffset) * gap, 0.08);
      const emphasized = active.line.beatId === 'battlefield-for-truth' || active.isJoin;
      const u = unit.handle.uniforms;
      (u.build as { value: number }).value = active.build;
      (u.disperse as { value: number }).value = Math.max(active.disperse, story?.outroProgress ?? 0);
      (u.opacity as { value: number }).value = experience.textOpacity;
      (u.focus as { value: number }).value = emphasized ? active.isJoin ? 0.36 : 0.14 : 0;
      (u.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (u.dpr as { value: number }).value = dprRef.current;
    }

    if (brandRef.current && experience && story) {
      const brand = textSet.brand;
      brand.sprite.visible = story.brandProgress > 0.001 && experience.textOpacity > 0.001;
      brandRef.current.position.set(0, layout === 'mobile' ? -1.18 : -1.24, 0.08);
      const u = brand.handle.uniforms;
      (u.build as { value: number }).value = story.brandProgress;
      (u.disperse as { value: number }).value = story.outroProgress;
      (u.opacity as { value: number }).value = story.brandProgress * experience.textOpacity;
      (u.focus as { value: number }).value = 0.2;
      (u.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (u.dpr as { value: number }).value = dprRef.current;
    }

    if (skipRef.current && experience && story) {
      const worldPerPx = viewHeight / Math.max(1, size.height);
      const edgeGapPx = Math.min(40, Math.max(16, size.width * 0.03));
      const x = viewWidth * 0.5 -
        (safeArea.right + edgeGapPx + SKIP_WIDTH_PX * 0.5) * worldPerPx;
      const y = -viewHeight * 0.5 +
        (safeArea.bottom + edgeGapPx + SKIP_HEIGHT_PX * 0.5) * worldPerPx;
      const skip = textSet.skip;
      const visibility = experience.time >= 0.85 && experience.textOpacity > 0.001;
      skip.sprite.visible = visibility;
      skipRef.current.position.set(x, y, 0.12);
      skipRef.current.scale.setScalar((SKIP_WIDTH_PX * worldPerPx) / SKIP_CLOUD_WIDTH);
      const u = skip.handle.uniforms;
      (u.build as { value: number }).value = Math.max(0, Math.min(1, (experience.time - 0.85) / 0.9));
      (u.disperse as { value: number }).value = story.outroProgress;
      (u.opacity as { value: number }).value = experience.textOpacity;
      (u.focus as { value: number }).value = skipFocusRef.current;
      (u.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (u.dpr as { value: number }).value = dprRef.current;
    }
  });

  if (!textSet) return null;
  return (
    <>
      {Array.from({ length: ROLLING_POOL_SIZE }, (_, slot) => (
        <group key={slot} ref={(value) => { groupRefs.current[slot] = value; }}>
          {textSet.lines.filter((_, index) => index % ROLLING_POOL_SIZE === slot).map((unit, index) => (
            <primitive key={index} object={unit.sprite} />
          ))}
        </group>
      ))}
      <group ref={brandRef}><primitive object={textSet.brand.sprite} /></group>
      <group ref={skipRef}><primitive object={textSet.skip.sprite} /></group>
    </>
  );
}

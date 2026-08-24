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
import {
  createIntroTextMaterial,
  type IntroTextMaterialOptions,
} from '../tsl/introTextMaterial';
import type { ExperienceFrame } from '../introFrame';

const CAMERA_Z = 8.2;
const FOV = 45;

interface TextUnit {
  sprite: Sprite;
  handle: ReturnType<typeof createIntroTextMaterial>;
}

interface TextSet {
  lines: TextUnit[];
  brand: TextUnit;
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
  for (const unit of [...set.lines, set.brand]) unit.handle.dispose();
}

export interface IntroTextProps {
  frameRef: { current: ExperienceFrame | null };
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  lightweight: boolean;
}

export function IntroText({
  frameRef,
  pxToWorldRef,
  dprRef,
  lightweight,
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
        created = { lines: lineUnits, brand };
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
    </>
  );
}

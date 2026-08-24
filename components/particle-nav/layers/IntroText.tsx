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
import { createIntroTextMaterial } from '../tsl/introTextMaterial';
import type { ExperienceFrame } from '../introFrame';

interface TextUnit {
  sprite: Sprite;
  handle: ReturnType<typeof createIntroTextMaterial>;
}

interface TextSet {
  lines: TextUnit[];
  brand: TextUnit;
}

function makeUnit(cloud: ReturnType<typeof buildTextCloud>): TextUnit {
  const handle = createIntroTextMaterial(cloud);
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

export function IntroText({ frameRef, pxToWorldRef, dprRef, lightweight }: IntroTextProps) {
  const width = useThree((state) => state.size.width);
  const layout = width < 720 ? 'mobile' : 'desktop';
  const groupRefs = useRef<(Group | null)[]>([]);
  const brandRef = useRef<Group>(null);
  const [textSet, setTextSet] = useState<TextSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: TextSet | null = null;
    const loader = new FontLoader();
    loader.load(
      '/assets/gentilis_regular.typeface.json',
      (font: Font) => {
        const mobile = layout === 'mobile';
        const lines = ROLLING_STORY_LINES_BY_LAYOUT[layout];
        const lineUnits = lines.map((line, index) => {
          const final = index === lines.length - 1;
          const maxParticles = lightweight
            ? final ? 3_600 : 2_800
            : final ? 7_000 : mobile ? 5_200 : 7_500;
          return makeUnit(buildTextCloud([line], font, {
            maxParticles,
            maxWidth: final ? (mobile ? 2.95 : 3.55) : mobile ? 3 : 8.65,
            fontScale: final ? (mobile ? 0.66 : 0.7) : mobile ? 0.22 : 0.415,
            centerY: 0,
            lineHeight: 0.5,
            density: lightweight ? 190 : final ? 470 : mobile ? 335 : 420,
            outlineRatio: final ? 0.25 : 0.2,
            seed: index * 20_003 + (mobile ? 101 : 0),
          }));
        });
        const brand = makeUnit(buildTextCloud(['LIONSOFZION'], font, {
          maxParticles: lightweight ? 2_800 : 5_000,
          maxWidth: 4.5,
          fontScale: 0.38,
          centerY: 0,
          density: lightweight ? 260 : 450,
          outlineRatio: 0.28,
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
      setTextSet(null);
    };
  }, [layout, lightweight]);

  useFrame(() => {
    if (!textSet) return;
    const experience = frameRef.current;
    const story = experience?.story;
    const activeBySlot = Array.from({ length: ROLLING_POOL_SIZE }, () => null) as
      (NonNullable<typeof story>['activeLines'][number] | null)[];
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
      group.position.set(active.isJoin ? 0 : layout === 'mobile' ? -0.45 : 0, top - (active.row + enteringOffset) * gap, 0.08);
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

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Sprite, type Vector3 } from 'three/webgpu';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import {
  ROLLING_STORY_LINES_BY_LAYOUT,
  ROLLING_POOL_SIZE,
} from '@/components/intro/rolling-story-timeline';
import { buildTextCloud, measureTextWidth } from '@/components/intro/textCloud';
import {
  computeIntroLayout,
  introLayoutName,
  introLineBudget,
  introTravel,
  quantizeIntroWidth,
} from '@/components/intro/introLayout';
import {
  createIntroTextMaterial,
  type IntroTextMaterialOptions,
} from '../tsl/introTextMaterial';
import type { ExperienceFrame } from '../introFrame';

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
  /* One primitive key, so a resize drag resamples at most once per 16px bucket
     rather than once per frame — and so the layout object keeps its identity in
     between, which is what the effects below depend on. The breakpoint reads the
     raw width; only the width feeding the glyph solve is bucketed. */
  const layoutKey = `${introLayoutName(size.width)}|${quantizeIntroWidth(size.width)}|${size.height}|${lightweight}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const intro = useMemo(() => computeIntroLayout(size.width, size.height), [layoutKey]);
  const layout = intro.name;
  const groupRefs = useRef<(Group | null)[]>([]);
  const lineWidthsRef = useRef<number[]>([]);
  const activeBySlotRef = useRef<
    (NonNullable<ExperienceFrame['story']>['activeLines'][number] | null)[]
  >(Array.from({ length: ROLLING_POOL_SIZE }, () => null));
  const brandRef = useRef<Group>(null);
  const [textSet, setTextSet] = useState<TextSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: TextSet | null = null;
    const lineWidths: number[] = [];
    let brandWidth = 0;
    setTextSet(null);
    const loader = new FontLoader();
    loader.load(
      '/assets/gentilis_regular.typeface.json',
      (font: Font) => {
        const mobile = layout === 'mobile';
        const current = intro;
        const lines = ROLLING_STORY_LINES_BY_LAYOUT[layout];
        const final = lines.length - 1;
        /* Measure every rolling line first, then solve the scale once. Built a
           line at a time, each would take `min(fontScale, cap / itsOwnWidth)`
           and the type size would step between rows the moment the cap bound —
           which on a phone is most of them. The closing line and the brand are
           deliberately larger, so they keep their own solve. */
        const widest = Math.max(
          ...lines.slice(0, final).map((line) => measureTextWidth(line, font)),
          0.001,
        );
        const storyScale = Math.min(current.fontScale, current.lineMaxWidth / widest);
        const lineUnits = lines.map((line, index) => {
          const isFinal = index === final;
          const budget = introLineBudget(index, lines.length, layout, lightweight);
          const cloud = buildTextCloud([line], font, {
            maxParticles: budget.maxParticles,
            maxWidth: current.lineMaxWidth,
            fontScale: isFinal ? current.finalFontScale : storyScale,
            centerY: 0,
            lineHeight: 0.5,
            density: budget.density,
            outlineRatio: isFinal ? 0.3 : 0.27,
            seed: index * 20_003 + (mobile ? 101 : 0),
          });
          lineWidths.push(cloud.width);
          return makeUnit(cloud);
        });
        /* The name is three words everywhere else on the site, and the
           climax is where it is read most carefully. Gentilis' space glyph is
           outline-free (ha 306/1000), so it costs no particles and only
           advances the pen: the brand's advance goes 7.844em → 8.456em, which
           at `brandFontScale` is 3.21 world units on desktop and 1.99 on
           mobile — both well under `lineMaxWidth`, so `buildTextCloud`'s
           `min(fontScale, maxWidth / widest)` still never clamps and the
           wordmark does not shrink to fit the space. */
        const brandCloud = buildTextCloud(['LIONS OF ZION'], font, {
          maxParticles: lightweight ? 2_800 : 5_000,
          maxWidth: current.lineMaxWidth,
          fontScale: current.brandFontScale,
          centerY: 0,
          density: lightweight ? 390 : 470,
          outlineRatio: 0.32,
          seed: mobile ? 91_131 : 91_117,
        });
        brandWidth = brandCloud.width;
        const brand = makeUnit(brandCloud);
        created = { lines: lineUnits, brand };
        lineWidthsRef.current = [...lineWidths, brandWidth];
        if (cancelled) disposeSet(created);
        else setTextSet(created);
      },
      undefined,
      (error) => console.error('[intro-scene] intro font load failed:', error),
    );
    return () => {
      cancelled = true;
      if (created) disposeSet(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  /* Travel is per line and per frame width, but it only changes when one of
     those changes — so it is written here rather than in the frame loop. */
  useEffect(() => {
    if (!textSet) return;
    const widths = lineWidthsRef.current;
    const apply = (unit: TextUnit, width: number) => {
      const travel = introTravel(intro.halfWidth, width || intro.lineMaxWidth, intro.name);
      const u = unit.handle.uniforms;
      (u.originBias as { value: Vector3 }).value.set(...travel.originBias);
      (u.originSpan as { value: Vector3 }).value.set(...travel.originSpan);
      (u.windBias as { value: Vector3 }).value.set(...travel.windBias);
      (u.windSpan as { value: Vector3 }).value.set(...travel.windSpan);
    };
    textSet.lines.forEach((unit, index) => apply(unit, widths[index] ?? 0));
    apply(textSet.brand, widths[widths.length - 1] ?? 0);
  }, [textSet, intro]);

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
      const { rowTop, rowGap } = intro;
      group.position.set(0, rowTop - (active.row + enteringOffset) * rowGap, 0.08);
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
      brandRef.current.position.set(0, intro.brandY, 0.08);
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

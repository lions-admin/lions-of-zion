'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  Color,
  Group,
  NormalBlending,
  Sprite,
  SpriteNodeMaterial,
  WebGPURenderer,
} from 'three/webgpu';
import {
  color,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  normalize,
  smoothstep,
  step,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { decodeLionBake } from '@/components/particle-nav/binary/lionFormat';
import styles from './particle-chat-launcher.module.css';

const LION_URL = '/particles/lion-v2-45k.bin';
const LION_PARTICLE_COUNT = 12_900;
const GOLD = new Color('#dbb452');
const GOLD_BRIGHT = new Color('#ffd878');

interface ChatLionData {
  count: number;
  homes: Float32Array;
  origins: Float32Array;
}

interface ChatParticleCanvasProps {
  activeRef: { current: boolean };
  onReady: () => void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function random01(index: number, salt: number) {
  let value = Math.imul(index + salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function makeLionData(buffer: ArrayBuffer): ChatLionData {
  const decoded = decodeLionBake(buffer);
  const faceCount = decoded.header.crownStart;
  const count = Math.min(LION_PARTICLE_COUNT, faceCount);
  const homes = new Float32Array(count * 4);
  const origins = new Float32Array(count * 4);

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.floor((index * faceCount) / count);
    const sourceOffset = sourceIndex * 4;
    const offset = index * 4;
    const x = decoded.positions[sourceOffset] * 0.96;
    const y = decoded.positions[sourceOffset + 1] * 0.96 - 0.01;
    const z = decoded.positions[sourceOffset + 2] * 0.22;
    homes[offset] = x;
    homes[offset + 1] = y;
    homes[offset + 2] = z;

    const angle = random01(index, 37) * Math.PI * 2;
    const radius = 0.92 + Math.sqrt(random01(index, 103)) * 0.72;
    origins[offset] = Math.cos(angle) * radius;
    origins[offset + 1] = Math.sin(angle) * radius;
    origins[offset + 2] = (random01(index, 211) - 0.5) * 0.34;
  }

  return { count, homes, origins };
}

function useChatLionData() {
  const [data, setData] = useState<ChatLionData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LION_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`chat lion fetch failed (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) setData(makeLionData(buffer));
      })
      .catch((error) => console.error('[particle-chat] lion load failed:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

function makeRingData(radius: number, count: number, phase = 0) {
  const positions = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    const angle = phase + (index / count) * Math.PI * 2;
    const offset = index * 4;
    const jitter = (random01(index, count + 17) - 0.5) * 0.012;
    positions[offset] = Math.cos(angle) * (radius + jitter);
    positions[offset + 1] = Math.sin(angle) * (radius + jitter);
    positions[offset + 2] = 0.035;
  }
  return positions;
}

function makeTailData() {
  const points: [number, number][] = [
    [0.575, -0.585],
    [0.91, -0.94],
    [0.76, -0.57],
  ];
  const perSegment = 25;
  const positions = new Float32Array(perSegment * 2 * 4);
  let cursor = 0;
  for (let segment = 0; segment < 2; segment += 1) {
    const [x0, y0] = points[segment];
    const [x1, y1] = points[segment + 1];
    for (let index = 0; index < perSegment; index += 1) {
      const t = index / (perSegment - 1);
      positions[cursor] = x0 + (x1 - x0) * t;
      positions[cursor + 1] = y0 + (y1 - y0) * t;
      positions[cursor + 2] = 0.04;
      cursor += 4;
    }
  }
  return positions;
}

function makeParticleMaterial(
  positions: Float32Array,
  options: { opacity: number; sizeMin: number; sizeMax: number },
) {
  const storage = instancedArray(positions, 'vec4');
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const energy = uniform(0);
  const seed = hash(instanceIndex.add(593));
  material.positionNode = storage.element(instanceIndex).xyz;
  material.scaleNode = mix(float(options.sizeMin), float(options.sizeMax), seed)
    .mul(mix(0.95, 1.22, energy));
  material.colorNode = mix(color(GOLD), color(GOLD_BRIGHT), energy.mul(0.72).add(seed.mul(0.08)));
  const distance = uv().sub(vec2(0.5)).length();
  material.opacityNode = smoothstep(0.5, 0.1, distance)
    .mul(mix(options.opacity * 0.55, options.opacity, seed))
    .mul(mix(0.8, 1, energy));
  return { material, storage, energy };
}

function RingParticles({
  positions,
  activeRef,
  direction,
  opacity,
}: {
  positions: Float32Array;
  activeRef: { current: boolean };
  direction: 1 | -1;
  opacity: number;
}) {
  const groupRef = useRef<Group>(null);
  const energyRef = useRef(0);
  const handle = useMemo(
    () => makeParticleMaterial(positions, { opacity, sizeMin: 0.018, sizeMax: 0.029 }),
    [opacity, positions],
  );
  const sprite = useMemo(() => {
    const value = new Sprite(handle.material);
    value.count = positions.length / 4;
    value.frustumCulled = false;
    return value;
  }, [handle.material, positions.length]);
  const energyUniformRef = useRef(handle.energy);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    energyUniformRef.current = handle.energy;
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => {
      handle.material.dispose();
      (handle.storage as unknown as { value?: { dispose(): void } }).value?.dispose();
    };
  }, [handle]);

  useFrame((_, delta) => {
    const target = activeRef.current ? 1 : 0;
    energyRef.current += (target - energyRef.current) * (1 - Math.exp(-delta * 9));
    (energyUniformRef.current as { value: number }).value = energyRef.current;
    if (groupRef.current && !reducedMotionRef.current) {
      groupRef.current.rotation.z += direction * delta * (0.055 + energyRef.current * 0.11);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={sprite} />
    </group>
  );
}

function LionParticles({
  data,
  activeRef,
}: {
  data: ChatLionData;
  activeRef: { current: boolean };
}) {
  const homes = useMemo(() => instancedArray(data.homes, 'vec4'), [data.homes]);
  const origins = useMemo(() => instancedArray(data.origins, 'vec4'), [data.origins]);
  const materialHandle = useMemo(() => {
    const material = new SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    });
    const assemble = uniform(0);
    const energy = uniform(0);
    const seed = hash(instanceIndex.add(977));
    const home = homes.element(instanceIndex).xyz;
    const origin = origins.element(instanceIndex).xyz;
    const delay = hash(instanceIndex.add(431)).mul(0.2);
    const gather = smoothstep(delay, delay.add(0.76), assemble);
    const edgeParticle = step(float(0.84), seed);
    const excitedHome = home.add(
      normalize(home.add(vec3(0, 0, 0.001))).mul(edgeParticle.mul(energy).mul(0.026)),
    );
    material.positionNode = mix(origin, excitedHome, gather);
    material.scaleNode = mix(float(0.017), float(0.03), seed)
      .mul(mix(0.92, 1.16, energy));
    material.colorNode = mix(color(GOLD), color(GOLD_BRIGHT), energy.mul(0.7).add(seed.mul(0.09)));
    const distance = uv().sub(vec2(0.5)).length();
    material.opacityNode = smoothstep(0.5, 0.09, distance)
      .mul(mix(0.28, 0.68, seed))
      .mul(gather)
      .mul(mix(0.82, 1, energy));
    return { material, assemble, energy };
  }, [homes, origins]);
  const sprite = useMemo(() => {
    const value = new Sprite(materialHandle.material);
    value.count = data.count;
    value.frustumCulled = false;
    return value;
  }, [data.count, materialHandle.material]);
  const startRef = useRef<number | null>(null);
  const energyRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const assembleUniformRef = useRef(materialHandle.assemble);
  const energyUniformRef = useRef(materialHandle.energy);

  useEffect(() => {
    assembleUniformRef.current = materialHandle.assemble;
    energyUniformRef.current = materialHandle.energy;
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => {
      materialHandle.material.dispose();
      for (const storage of [homes, origins]) {
        (storage as unknown as { value?: { dispose(): void } }).value?.dispose();
      }
    };
  }, [homes, materialHandle.assemble, materialHandle.energy, materialHandle.material, origins]);

  useFrame((state, delta) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const target = activeRef.current ? 1 : 0;
    energyRef.current += (target - energyRef.current) * (1 - Math.exp(-delta * 10));
    (energyUniformRef.current as { value: number }).value = energyRef.current;
    (assembleUniformRef.current as { value: number }).value = reducedMotionRef.current
      ? 1
      : smooth01(elapsed / 1.05);
  });

  return <primitive object={sprite} />;
}

function ParticleMark({ activeRef, onReady }: ChatParticleCanvasProps) {
  const data = useChatLionData();
  const gl = useThree((state) => state.gl) as unknown as WebGPURenderer;
  const readyRef = useRef(false);
  const outer = useMemo(() => makeRingData(0.94, 250, 0.013), []);
  const inner = useMemo(() => makeRingData(0.855, 218, 0.031), []);
  const tail = useMemo(() => makeTailData(), []);

  useEffect(() => {
    gl.setClearColor(0x000000, 0);
  }, [gl]);

  useFrame(() => {
    if (data && !readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  });

  return (
    <>
      <RingParticles positions={outer} activeRef={activeRef} direction={1} opacity={1} />
      <RingParticles positions={inner} activeRef={activeRef} direction={-1} opacity={0.74} />
      <RingParticles positions={tail} activeRef={activeRef} direction={1} opacity={0.9} />
      {data ? <LionParticles data={data} activeRef={activeRef} /> : null}
    </>
  );
}

export function ChatParticleCanvas(props: ChatParticleCanvasProps) {
  return (
    <span className={styles.canvasLayer} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3], fov: 36, near: 0.1, far: 10 }}
        gl={async ({ canvas }) => {
          const renderer = new WebGPURenderer({
            canvas: canvas as HTMLCanvasElement,
            alpha: true,
            antialias: false,
            forceWebGL: !('gpu' in navigator),
          });
          await renderer.init();
          renderer.setClearColor(0x000000, 0);
          return renderer;
        }}
      >
        <ParticleMark {...props} />
      </Canvas>
    </span>
  );
}

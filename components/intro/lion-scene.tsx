"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FontLoader, type Font, type FontData } from "three/addons/loaders/FontLoader.js";
import {
  buildTextCloud,
  createTextParticleLayer,
  setTextParticleCloud,
  updateTextParticleLayer,
  type TextCloud,
} from "./particle-text";
import {
  STORY_PARAGRAPHS,
  getTimelineFrame,
  type StoryLayout,
} from "./story-timeline";
import {
  ROLLING_POOL_SIZE,
  ROLLING_STORY_LINES_BY_LAYOUT,
  ROLLING_STORY_START,
  ROLLING_WINDOW_SIZE,
  getNextRollingCue,
  getRollingFinalTime,
  getRollingOutroStart,
  getRollingStoryFrame,
} from "./rolling-story-timeline";
import styles from "./lion-scene.module.css";

const STRUCTURE_SOURCE = "/assets/lion-structure.bin";
const FONT_SOURCE = "/assets/gentilis_regular.typeface.json";
const HEADER_SIZE = 16;
const EXPECTED_RECORD_SIZE = 16;

const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform float uMotion;
  uniform float uFormation;
  uniform float uWind;
  uniform float uVisibility;
  uniform float uParallax;
  uniform float uCompact;

  attribute float aPhase;
  attribute float aEnergy;
  attribute float aSize;
  attribute vec3 aExplode;
  attribute float aDelay;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;

  void main() {
    vec3 p = position;
    float breath = sin(uTime * 0.72 + aPhase * 6.2831);
    float drift = sin(uTime * 0.38 + p.y * 1.5 + aPhase * 4.0);
    float edgeMotion = smoothstep(0.7, 2.8, abs(p.x));
    float scatter = 1.0 - smoothstep(aDelay, min(0.99, aDelay + 0.34), uFormation);
    float turbulence = sin(uTime * 1.7 + aPhase * 12.0) * scatter;
    vec3 windOffset = vec3(
      1.9 + aPhase * 1.45,
      2.15 + sin(aPhase * 9.0) * 0.48,
      (aPhase - 0.5) * 2.7
    ) * uWind;

    p += aExplode * scatter + windOffset;
    p.x += turbulence * (0.06 + abs(aExplode.y) * 0.025);
    p.y += cos(uTime * 1.25 + aPhase * 9.0) * scatter * 0.07;
    p.z += sin(uTime * 1.4 + aPhase * 8.0) * scatter * 0.16;

    p.x += drift * 0.014 * edgeMotion * uMotion * (1.0 - scatter);
    p.y += breath * 0.009 * (0.35 + edgeMotion) * uMotion * (1.0 - scatter);
    p.z += breath * 0.025 * aEnergy * uMotion * (1.0 - scatter);
    p.x += uPointer.x * (0.018 + position.z * 0.012) * uParallax;
    p.y += uPointer.y * (0.012 + position.z * 0.008) * uParallax;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * mix(1.0, 0.72, scatter) * mix(1.0, 0.62, uCompact)
      * uPixelRatio * (11.0 / max(5.0, -mvPosition.z));

    vColor = color;
    vAlpha = (0.28 + aEnergy * 0.72) * mix(1.0, 0.72, scatter)
      * mix(1.0, 0.50, uCompact) * uVisibility;
    vSpark = smoothstep(0.78, 1.0, aEnergy) + scatter * 0.12;
  }
`;

const particleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float d = length(centered) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(1.0, 0.05, d);
    float halo = pow(max(0.0, 1.0 - d), 2.5);
    float alpha = (core * 0.72 + halo * vSpark * 0.45) * vAlpha;
    gl_FragColor = vec4(vColor * (0.76 + core * 0.6), alpha);
  }
`;

const filamentVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uFormation;
  uniform float uWind;
  uniform float uVisibility;
  uniform float uCompact;

  attribute vec3 aExplode;
  attribute float aDelay;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float scatter = 1.0 - smoothstep(aDelay, min(0.99, aDelay + 0.34), uFormation);
    vec3 windOffset = vec3(2.4, 2.2, sin(position.x * 2.0) * 1.2) * uWind;
    vec3 p = position + aExplode * scatter + windOffset;
    p.x += sin(uTime * 1.5 + position.y * 3.0) * scatter * 0.06;
    p.z += cos(uTime * 1.2 + position.x * 2.0) * scatter * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vColor = color;
    vAlpha = mix(0.2, 0.08, scatter) * mix(1.0, 0.45, uCompact) * uVisibility;
  }
`;

const filamentFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

type LionStructure = {
  count: number;
  positions: Float32Array;
  sourceColors: Float32Array;
  energies: Float32Array;
  phases: Float32Array;
  sizes: Float32Array;
  regions: Uint8Array;
  seeds: Float32Array;
};

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

async function loadStructure(signal: AbortSignal): Promise<LionStructure> {
  const response = await fetch(STRUCTURE_SOURCE, { cache: "force-cache", signal });
  if (!response.ok) throw new Error(`Unable to load lion structure: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const version = view.getUint16(4, true);
  const recordSize = view.getUint16(6, true);
  const count = view.getUint32(8, true);

  if (magic !== "LION" || version !== 1 || recordSize !== EXPECTED_RECORD_SIZE) {
    throw new Error("Unsupported lion structure data");
  }
  if (buffer.byteLength !== HEADER_SIZE + count * recordSize) {
    throw new Error("Incomplete lion structure data");
  }

  const positions = new Float32Array(count * 3);
  const sourceColors = new Float32Array(count * 3);
  const energies = new Float32Array(count);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  const regions = new Uint8Array(count);
  const seeds = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_SIZE + index * recordSize;
    const vectorOffset = index * 3;
    positions[vectorOffset] = view.getInt16(offset, true) / 32767 * 3.1;
    positions[vectorOffset + 1] = view.getInt16(offset + 2, true) / 32767 * 4.65;
    positions[vectorOffset + 2] = view.getUint16(offset + 4, true) / 65535 * 1.2;
    sourceColors[vectorOffset] = view.getUint8(offset + 6) / 255;
    sourceColors[vectorOffset + 1] = view.getUint8(offset + 7) / 255;
    sourceColors[vectorOffset + 2] = view.getUint8(offset + 8) / 255;
    energies[index] = view.getUint8(offset + 9) / 255;
    phases[index] = view.getUint8(offset + 10) / 255;
    sizes[index] = view.getUint8(offset + 11) / 255 * 4;
    regions[index] = view.getUint8(offset + 12);
    seeds[vectorOffset] = view.getUint8(offset + 13) / 255;
    seeds[vectorOffset + 1] = view.getUint8(offset + 14) / 255;
    seeds[vectorOffset + 2] = view.getUint8(offset + 15) / 255;
  }

  return { count, positions, sourceColors, energies, phases, sizes, regions, seeds };
}

async function loadFont(signal: AbortSignal): Promise<Font> {
  const response = await fetch(FONT_SOURCE, { cache: "force-cache", signal });
  if (!response.ok) throw new Error(`Unable to load particle font: ${response.status}`);
  return new FontLoader().parse(await response.json() as FontData);
}

function explosionFor(structure: LionStructure, index: number) {
  const offset = index * 3;
  const x = structure.positions[offset];
  const y = structure.positions[offset + 1];
  const region = structure.regions[index];
  const seedA = structure.seeds[offset];
  const seedB = structure.seeds[offset + 1];
  const seedC = structure.seeds[offset + 2];
  const radialY = (y - 0.12) * 0.74;
  const magnitude = Math.max(0.16, Math.hypot(x, radialY));
  const directionX = x / magnitude;
  const directionY = radialY / magnitude;
  const regionScale = region === 0 ? 1 : region === 1 ? 0.7 : region === 2 ? 0.58 : 0.5;
  const distance = (3.1 + seedA * 4.4) * regionScale;
  const delayBase = region === 0 ? 0.01 : region === 1 ? 0.15 : region === 2 ? 0.24 : 0.34;
  const delayRange = region === 0 ? 0.12 : 0.09;

  return {
    vector: [
      directionX * distance + (seedB - 0.5) * 1.15,
      directionY * distance + (seedC - 0.5) * 0.82,
      (seedC - 0.5) * 5.2 + seedA * (region === 0 ? 1.4 : 0.5),
    ] as const,
    delay: delayBase + seedB * delayRange,
  };
}

function createParticleMaterial(motionEnabled: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uPointer: { value: new THREE.Vector2() },
      uMotion: { value: motionEnabled ? 1 : 0 },
      uFormation: { value: motionEnabled ? 0 : 1 },
      uWind: { value: 0 },
      uVisibility: { value: 0 },
      uParallax: { value: 1 },
      uCompact: { value: 0 },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
}

function buildLionParticles(structure: LionStructure, motionEnabled: boolean) {
  const colors = new Float32Array(structure.count * 3);
  const explosions = new Float32Array(structure.count * 3);
  const delays = new Float32Array(structure.count);
  const warm = new THREE.Color("#e2a95d");

  for (let index = 0; index < structure.count; index += 1) {
    const offset = index * 3;
    const source = new THREE.Color(
      structure.sourceColors[offset],
      structure.sourceColors[offset + 1],
      structure.sourceColors[offset + 2],
    );
    source.lerp(warm, 0.14 + structure.energies[index] * 0.1);
    source.multiplyScalar(0.7 + structure.energies[index] * 0.52);
    colors[offset] = source.r;
    colors[offset + 1] = source.g;
    colors[offset + 2] = source.b;

    const explosion = explosionFor(structure, index);
    explosions[offset] = explosion.vector[0];
    explosions[offset + 1] = explosion.vector[1];
    explosions[offset + 2] = explosion.vector[2];
    delays[index] = explosion.delay;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(structure.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(structure.phases, 1));
  geometry.setAttribute("aEnergy", new THREE.BufferAttribute(structure.energies, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(structure.sizes, 1));
  geometry.setAttribute("aExplode", new THREE.BufferAttribute(explosions, 3));
  geometry.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));

  const material = createParticleMaterial(motionEnabled);
  return { mesh: new THREE.Points(geometry, material), material };
}

function buildFilaments(structure: LionStructure) {
  const candidates: number[] = [];
  for (let index = 0; index < structure.count; index += 1) {
    const offset = index * 3;
    const x = structure.positions[offset];
    const y = structure.positions[offset + 1];
    const faceDistance = x * x / 2.9 + (y - 0.25) * (y - 0.25) / 5.4;
    if (faceDistance > 0.92 && faceDistance < 3.6 && structure.energies[index] > 0.22) {
      candidates.push(index);
    }
  }

  const vertices: number[] = [];
  const colors: number[] = [];
  const explosions: number[] = [];
  const delays: number[] = [];
  const gold = new THREE.Color("#bd8142");
  const dark = new THREE.Color("#4b2c16");

  for (let i = 0; i < 920 && candidates.length; i += 1) {
    const pointIndex = candidates[Math.floor(seeded(i, 41) * candidates.length)];
    const offset = pointIndex * 3;
    const x = structure.positions[offset];
    const y = structure.positions[offset + 1];
    const z = structure.positions[offset + 2];
    const radialX = x;
    const radialY = (y - 0.15) * 0.72;
    const length = 0.08 + seeded(i, 43) * 0.22;
    const magnitude = Math.max(0.1, Math.hypot(radialX, radialY));
    const dx = radialX / magnitude;
    const dy = radialY / magnitude;
    const bend = (seeded(i, 47) - 0.5) * 0.09;
    const explosion = explosionFor(structure, pointIndex);

    vertices.push(x, y, z - 0.035, x + dx * length - dy * bend, y + dy * length + dx * bend, z - 0.02);
    const color = dark.clone().lerp(gold, structure.energies[pointIndex]);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    explosions.push(...explosion.vector, ...explosion.vector);
    delays.push(explosion.delay, explosion.delay);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aExplode", new THREE.Float32BufferAttribute(explosions, 3));
  geometry.setAttribute("aDelay", new THREE.Float32BufferAttribute(delays, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFormation: { value: 0 },
      uWind: { value: 0 },
      uVisibility: { value: 0 },
      uCompact: { value: 0 },
    },
    vertexShader: filamentVertexShader,
    fragmentShader: filamentFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
  });

  return { mesh: new THREE.LineSegments(geometry, material), material };
}

function buildEyeClusters(motionEnabled: boolean) {
  const positions: number[] = [];
  const colors: number[] = [];
  const phases: number[] = [];
  const energies: number[] = [];
  const sizes: number[] = [];
  const explosions: number[] = [];
  const delays: number[] = [];
  const centers = [new THREE.Vector3(-0.68, 1.28, 0.79), new THREE.Vector3(0.68, 1.28, 0.79)];
  const amber = new THREE.Color("#ffc56c");

  centers.forEach((center, eyeIndex) => {
    for (let i = 0; i < 120; i += 1) {
      const seedIndex = i + eyeIndex * 200;
      const angle = seeded(seedIndex, 53) * Math.PI * 2;
      const radius = Math.pow(seeded(seedIndex, 59), 1.8) * 0.09;
      positions.push(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius * 0.6, center.z + seeded(i, eyeIndex + 61) * 0.025);
      colors.push(amber.r, amber.g, amber.b);
      phases.push(seeded(i, eyeIndex + 67));
      energies.push(0.82 + seeded(i, 71) * 0.18);
      sizes.push(1.4 + seeded(i, 73) * 1.4);
      explosions.push((eyeIndex === 0 ? -1 : 1) * (1.35 + seeded(i, 109) * 0.7), (seeded(i, 113) - 0.35) * 1.2, (seeded(i, 127) - 0.5) * 2.2);
      delays.push(0.36 + seeded(i, 131) * 0.06);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aEnergy", new THREE.Float32BufferAttribute(energies, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aExplode", new THREE.Float32BufferAttribute(explosions, 3));
  geometry.setAttribute("aDelay", new THREE.Float32BufferAttribute(delays, 1));
  const material = createParticleMaterial(motionEnabled);
  return { mesh: new THREE.Points(geometry, material), material };
}

function buildAtmosphere() {
  const count = 560;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color("#a46a35");

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (seeded(i, 79) - 0.5) * 19;
    positions[i * 3 + 1] = (seeded(i, 83) - 0.5) * 11;
    positions[i * 3 + 2] = -1.4 - seeded(i, 89) * 4;
    const energy = 0.1 + seeded(i, 97) * 0.25;
    colors[i * 3] = color.r * energy;
    colors[i * 3 + 1] = color.g * energy;
    colors[i * 3 + 2] = color.b * energy;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

type TextCloudSets = Record<StoryLayout, readonly TextCloud[]>;

function buildStoryClouds(font: Font): TextCloudSets {
  const buildForLayout = (layout: StoryLayout) => {
    const mobile = layout === "mobile";
    const lines = ROLLING_STORY_LINES_BY_LAYOUT[layout];
    return lines.map((line, index) => {
      const final = index === lines.length - 1;
      return buildTextCloud([line], font, {
        maxParticles: mobile ? 11_000 : 16_000,
        maxWidth: final ? (mobile ? 2.95 : 3.55) : mobile ? 3 : 8.65,
        fontScale: final ? (mobile ? 0.66 : 0.7) : mobile ? 0.22 : 0.415,
        centerY: 0,
        lineHeight: 0.5,
        density: final ? (mobile ? 470 : 560) : mobile ? 335 : 420,
        outlineRatio: final ? 0.25 : 0.2,
        seed: index * 20_003 + (mobile ? 101 : 0),
      });
    });
  };

  return { desktop: buildForLayout("desktop"), mobile: buildForLayout("mobile") };
}

function buildBrandClouds(font: Font): Record<StoryLayout, TextCloud> {
  return {
    desktop: buildTextCloud(["LIONSOFZION"], font, {
      maxParticles: 5_000,
      maxWidth: 4.5,
      fontScale: 0.38,
      centerY: 0,
      density: 450,
      outlineRatio: 0.28,
      seed: 91_117,
    }),
    mobile: buildTextCloud(["LIONSOFZION"], font, {
      maxParticles: 5_000,
      maxWidth: 4.5,
      fontScale: 0.38,
      centerY: 0,
      density: 480,
      outlineRatio: 0.29,
      seed: 91_131,
    }),
  };
}

function buildBrandMarkClouds(font: Font): Record<StoryLayout, TextCloud> {
  return {
    desktop: buildTextCloud(["-"], font, {
      maxParticles: 550,
      maxWidth: 0.26,
      fontScale: 0.38,
      centerY: 0,
      density: 900,
      outlineRatio: 0.6,
      seed: 91_149,
    }),
    mobile: buildTextCloud(["-"], font, {
      maxParticles: 550,
      maxWidth: 0.26,
      fontScale: 0.38,
      centerY: 0,
      density: 900,
      outlineRatio: 0.6,
      seed: 91_163,
    }),
  };
}

function TranscriptContent() {
  return (
    <div>
      {STORY_PARAGRAPHS.slice(0, -1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <strong>{STORY_PARAGRAPHS.at(-1)}</strong>
      <span className={styles.brandSignature}>-LIONSOFZION</span>
    </div>
  );
}

type LionSceneProps = {
  destination?: string;
  mode?: "standalone" | "handoff";
  onOutroStart?: () => void;
  onComplete?: () => void;
  onFailure?: () => void;
};

export default function LionScene({
  destination,
  mode = "standalone",
  onOutroStart,
  onComplete,
  onFailure,
}: LionSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRequestedRef = useRef(false);
  const skipFocusedRef = useRef(false);
  const showSkipRef = useRef(false);
  const completeRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [complete, setComplete] = useState(false);
  const [outroStarted, setOutroStarted] = useState(false);
  const callbacksRef = useRef({ onOutroStart, onComplete, onFailure });

  useEffect(() => {
    callbacksRef.current = { onOutroStart, onComplete, onFailure };
  }, [onComplete, onFailure, onOutroStart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motionEnabled) return;

    let disposed = false;
    let animationFrame = 0;
    let timelineTime = 0;
    let motionTime = 0;
    let previousTimestamp = 0;
    let paused = false;
    let skipTransition = false;
    let qualityReduced = false;
    let frameTimeEma = 16.7;
    let slowFrames = 0;
    let currentLayout: StoryLayout = "desktop";
    let largeScale = 1;
    let smallScale = 0.43;
    let largeY = -0.12;
    let smallY = 2.42;
    let viewportHeight = 9.3;
    let viewportWidth = 16.5;
    const abortController = new AbortController();
    const pointer = new THREE.Vector2();
    const smoothPointer = new THREE.Vector2();
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010304, 0.038);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 40);
    camera.position.set(0, 0.02, 11.8);
    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    };
    const webglContext =
      canvas.getContext("webgl2", contextAttributes) ??
      canvas.getContext("webgl", contextAttributes);
    if (!webglContext) {
      canvas.dataset.webglError = "WebGL 2 is unavailable";
      queueMicrotask(() => {
        setFailed(true);
        callbacksRef.current.onFailure?.();
      });
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: webglContext,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (error: unknown) {
      canvas.dataset.webglError = error instanceof Error ? error.message : "WebGL initialization failed";
      queueMicrotask(() => {
        setFailed(true);
        callbacksRef.current.onFailure?.();
      });
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;

    const lion = new THREE.Group();
    scene.add(lion);
    const atmosphere = buildAtmosphere();
    const atmosphereMaterial = atmosphere.material as THREE.PointsMaterial;
    scene.add(atmosphere);

    const textLayers = Array.from(
      { length: ROLLING_POOL_SIZE },
      (_, index) => createTextParticleLayer(16_000, { renderOrder: 3 + index }),
    );
    const brandLayer = createTextParticleLayer(5_000, {
      coreColor: "#eee9df",
      edgeColor: "#ffffff",
      renderOrder: 9,
    });
    const brandMarkLayer = createTextParticleLayer(1_000, {
      coreColor: "#eee9df",
      edgeColor: "#ffffff",
      renderOrder: 9,
    });
    const skipLayer = createTextParticleLayer(1_500, {
      coreColor: "#eadfca",
      edgeColor: "#fffaf0",
      renderOrder: 4,
    });
    scene.add(
      ...textLayers.map((layer) => layer.points),
      brandLayer.points,
      brandMarkLayer.points,
      skipLayer.points,
    );

    let storyClouds: TextCloudSets | null = null;
    let brandClouds: Record<StoryLayout, TextCloud> | null = null;
    let brandMarkClouds: Record<StoryLayout, TextCloud> | null = null;
    let skipClouds: Record<StoryLayout, TextCloud> | null = null;
    const layerKeys: Array<string | null> = Array.from(
      { length: ROLLING_POOL_SIZE },
      () => null,
    );
    let skipLayerKey: StoryLayout | null = null;
    let brandLayerKey: StoryLayout | null = null;
    let brandMarkLayerKey: StoryLayout | null = null;
    let filamentMesh: THREE.LineSegments | null = null;
    let outroAnnounced = false;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nextLayout: StoryLayout =
        width < 720 || width / height < 0.75 ? "mobile" : "desktop";
      if (nextLayout !== currentLayout && timelineTime >= ROLLING_STORY_START) {
        const oldDuration = getRollingFinalTime(currentLayout) - ROLLING_STORY_START;
        const newDuration = getRollingFinalTime(nextLayout) - ROLLING_STORY_START;
        const storyProgress = clamp01(
          (timelineTime - ROLLING_STORY_START) / oldDuration,
        );
        timelineTime = ROLLING_STORY_START + storyProgress * newDuration;
      }
      currentLayout = nextLayout;
      const preferredRatio = qualityReduced ? 1 : currentLayout === "mobile" ? 1.25 : 1.5;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, preferredRatio));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      viewportHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
      viewportWidth = viewportHeight * camera.aspect;
      largeScale = currentLayout === "mobile"
        ? Math.max(0.62, Math.min(0.72, camera.aspect * 1.42))
        : 1;
      smallScale = currentLayout === "mobile" ? 0.43 : 0.44;
      largeY = currentLayout === "mobile" ? 0.05 : -0.12;
      smallY = currentLayout === "mobile" ? 2.45 : 2.35;
      layerKeys.fill(null);
      brandLayerKey = null;
      brandMarkLayerKey = null;
      skipLayerKey = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.set(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLButtonElement) return;
      if (event.code === "Space") {
        event.preventDefault();
        paused = !paused;
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        timelineTime = getNextRollingCue(timelineTime, currentLayout);
      } else if (event.code === "Escape") {
        event.preventDefault();
        skipRequestedRef.current = true;
        paused = false;
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      callbacksRef.current.onFailure?.();
    };
    const onVisibilityChange = () => {
      previousTimestamp = performance.now();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();

    let particleMaterial: THREE.ShaderMaterial | undefined;
    let eyeMaterial: THREE.ShaderMaterial | undefined;
    let filamentMaterial: THREE.ShaderMaterial | undefined;

    Promise.all([loadStructure(abortController.signal), loadFont(abortController.signal)])
      .then(([structure, font]) => {
        if (disposed) return;
        storyClouds = buildStoryClouds(font);
        brandClouds = buildBrandClouds(font);
        brandMarkClouds = buildBrandMarkClouds(font);
        skipClouds = {
          desktop: buildTextCloud(["Skip intro"], font, {
            maxParticles: 1_500,
            maxWidth: 1.26,
            centerY: 0,
            lineHeight: 0.3,
            density: 235,
            outlineRatio: 0.34,
            seed: 81_001,
          }),
          mobile: buildTextCloud(["Skip"], font, {
            maxParticles: 1_200,
            maxWidth: 0.84,
            centerY: 0,
            lineHeight: 0.3,
            density: 275,
            outlineRatio: 0.36,
            seed: 81_013,
          }),
        };
        const particles = buildLionParticles(structure, motionEnabled);
        const filaments = buildFilaments(structure);
        const eyes = buildEyeClusters(motionEnabled);
        particleMaterial = particles.material;
        eyeMaterial = eyes.material;
        filamentMaterial = filaments.material;
        filamentMesh = filaments.mesh;
        lion.add(particles.mesh, filaments.mesh, eyes.mesh);

        const render = (timestamp: number) => {
          if (disposed) return;
          animationFrame = requestAnimationFrame(render);
          if (previousTimestamp === 0) previousTimestamp = timestamp;
          const rawFrameMs = Math.min(100, timestamp - previousTimestamp);
          const delta = Math.min(0.05, rawFrameMs / 1000);
          previousTimestamp = timestamp;

          const finalTime = getRollingFinalTime(currentLayout);
          if (!document.hidden && !paused && timelineTime < finalTime) {
            motionTime += delta;
            timelineTime = Math.min(finalTime, timelineTime + delta * (skipTransition ? 4.67 : 1));
          }
          if (skipRequestedRef.current) {
            skipRequestedRef.current = false;
            timelineTime = getRollingOutroStart(currentLayout);
            skipTransition = true;
            paused = false;
          }

          const lionTimeline = getTimelineFrame(timelineTime);
          const storyTimeline = getRollingStoryFrame(timelineTime, currentLayout);
          const layoutProgress = easeInOutCubic(lionTimeline.lionRelocation);
          const outroProgress = easeInOutCubic(storyTimeline.outroProgress);
          const outroVisibility = 1 - easeInOutCubic(
            clamp01((storyTimeline.outroProgress - 0.45) / 0.55),
          );
          const lionVisibility = timelineTime < 1 ? 0 : easeInOutCubic(clamp01((timelineTime - 1) / 0.42));
          const pixelRatio = renderer.getPixelRatio();
          smoothPointer.lerp(pointer, 0.035);

          particleMaterial!.uniforms.uTime.value = motionTime;
          particleMaterial!.uniforms.uPixelRatio.value = pixelRatio;
          particleMaterial!.uniforms.uPointer.value.copy(smoothPointer);
          particleMaterial!.uniforms.uFormation.value = lionTimeline.lionFormation;
          particleMaterial!.uniforms.uWind.value = lionTimeline.lionWind * 0.72 + outroProgress * 0.85;
          particleMaterial!.uniforms.uVisibility.value = lionVisibility * outroVisibility;
          particleMaterial!.uniforms.uParallax.value = 1 - layoutProgress * 0.65;
          particleMaterial!.uniforms.uCompact.value = layoutProgress;
          eyeMaterial!.uniforms.uTime.value = motionTime;
          eyeMaterial!.uniforms.uPixelRatio.value = pixelRatio;
          eyeMaterial!.uniforms.uPointer.value.copy(smoothPointer);
          eyeMaterial!.uniforms.uFormation.value = lionTimeline.lionFormation;
          eyeMaterial!.uniforms.uWind.value = lionTimeline.lionWind * 0.72 + outroProgress * 0.85;
          eyeMaterial!.uniforms.uVisibility.value = lionVisibility * outroVisibility;
          eyeMaterial!.uniforms.uParallax.value = 1 - layoutProgress * 0.65;
          eyeMaterial!.uniforms.uCompact.value = layoutProgress * 0.78;
          filamentMaterial!.uniforms.uTime.value = motionTime;
          filamentMaterial!.uniforms.uFormation.value = lionTimeline.lionFormation;
          filamentMaterial!.uniforms.uWind.value = lionTimeline.lionWind * 0.72 + outroProgress * 0.85;
          filamentMaterial!.uniforms.uVisibility.value = lionVisibility * outroVisibility;
          filamentMaterial!.uniforms.uCompact.value = layoutProgress;

          lion.scale.setScalar(THREE.MathUtils.lerp(largeScale, smallScale, layoutProgress));
          lion.position.set(lionTimeline.lionWind * 0.12, THREE.MathUtils.lerp(largeY, smallY, layoutProgress), 0);
          const parallaxStrength = 1 - layoutProgress * 0.65;
          lion.rotation.y = smoothPointer.x * 0.035 * parallaxStrength;
          lion.rotation.x = -smoothPointer.y * 0.018 * parallaxStrength;
          atmosphereMaterial.opacity = timelineTime < 1
            ? 0
            : easeInOutCubic(clamp01((timelineTime - 1) / 1.25)) * (timelineTime >= 8.5 ? 0.24 : 0.36) * outroVisibility;
          atmosphere.rotation.z = motionTime * 0.0025;
          atmosphere.position.x = Math.sin(motionTime * 0.08) * 0.08;

          const activeBySlot: Array<(typeof storyTimeline.activeLines)[number] | null> =
            Array.from({ length: ROLLING_POOL_SIZE }, () => null);
          for (const activeLine of storyTimeline.activeLines) {
            activeBySlot[activeLine.slot] = activeLine;
          }
          const textTopY = currentLayout === "mobile" ? 0.38 : 0.55;
          const lineGap = currentLayout === "mobile" ? 0.62 : 0.68;
          const textCenterX = currentLayout === "mobile" ? -0.45 : 0;
          const finalCenterX = 0;
          for (let slot = 0; slot < textLayers.length; slot += 1) {
            const layer = textLayers[slot];
            const activeLine = activeBySlot[slot];
            if (activeLine && storyClouds) {
              const key = `${currentLayout}:${activeLine.index}`;
              if (layerKeys[slot] !== key) {
                setTextParticleCloud(layer, storyClouds[currentLayout][activeLine.index]);
                layerKeys[slot] = key;
              }
              const enteringRowOffset =
                activeLine.phase === "enter" && activeLine.index >= ROLLING_WINDOW_SIZE
                  ? 1 - activeLine.build
                  : 0;
              layer.points.position.set(
                activeLine.isJoin ? finalCenterX : textCenterX,
                textTopY - (activeLine.row + enteringRowOffset) * lineGap,
                0,
              );
              const emphasized = activeLine.line.beatId === "battlefield-for-truth" || activeLine.isJoin;
              updateTextParticleLayer(layer, {
                time: motionTime,
                pixelRatio,
                build: activeLine.build,
                disperse: Math.max(activeLine.disperse, storyTimeline.outroProgress),
                opacity: 1,
                focus: emphasized ? (activeLine.isJoin ? 0.36 : 0.14) : 0,
              });
            } else {
              updateTextParticleLayer(layer, {
                time: motionTime,
                pixelRatio,
                build: 0,
                disperse: 0,
                opacity: 0,
              });
            }
          }

          if (brandClouds) {
            if (brandLayerKey !== currentLayout) {
              setTextParticleCloud(brandLayer, brandClouds[currentLayout]);
              brandLayerKey = currentLayout;
            }
            brandLayer.points.position.set(
              finalCenterX,
              currentLayout === "mobile" ? -1.18 : -1.24,
              0,
            );
            updateTextParticleLayer(brandLayer, {
              time: motionTime,
              pixelRatio,
              build: storyTimeline.brandProgress,
              disperse: storyTimeline.outroProgress,
              opacity: storyTimeline.brandProgress,
              focus: 0.2,
            });
          }
          if (brandMarkClouds) {
            if (brandMarkLayerKey !== currentLayout) {
              setTextParticleCloud(
                brandMarkLayer,
                brandMarkClouds[currentLayout],
              );
              brandMarkLayerKey = currentLayout;
            }
            brandMarkLayer.points.position.set(
              finalCenterX - 1.45,
              currentLayout === "mobile" ? -1.18 : -1.24,
              0,
            );
            updateTextParticleLayer(brandMarkLayer, {
              time: motionTime,
              pixelRatio,
              build: storyTimeline.brandProgress,
              disperse: storyTimeline.outroProgress,
              opacity: storyTimeline.brandProgress * 0.95,
              focus: 0,
            });
          }

          if (skipClouds) {
            if (skipLayerKey !== currentLayout) {
              setTextParticleCloud(skipLayer, skipClouds[currentLayout]);
              skipLayerKey = currentLayout;
            }
            skipLayer.points.position.set(
              viewportWidth * 0.5 - (currentLayout === "mobile" ? 0.69 : 0.94),
              -viewportHeight * 0.5 + 0.5,
              0,
            );
            const skipLayerVisible = timelineTime >= 1 && !storyTimeline.isComplete;
            const skipInteractive = skipLayerVisible && storyTimeline.outroProgress <= 0;
            updateTextParticleLayer(skipLayer, {
              time: motionTime,
              pixelRatio,
              build: skipLayerVisible ? 1 : 0,
              disperse: storyTimeline.outroProgress,
              opacity: skipLayerVisible ? (skipFocusedRef.current ? 1 : 0.95) : 0,
              focus: skipFocusedRef.current ? 1 : 0.28,
            });
            if (skipInteractive !== showSkipRef.current) {
              showSkipRef.current = skipInteractive;
              setShowSkip(skipInteractive);
            }
          }
          if (storyTimeline.isComplete !== completeRef.current) {
            completeRef.current = storyTimeline.isComplete;
            setComplete(storyTimeline.isComplete);
            if (storyTimeline.isComplete) callbacksRef.current.onComplete?.();
          }
          if (storyTimeline.outroProgress > 0 && !outroAnnounced) {
            outroAnnounced = true;
            setOutroStarted(true);
            callbacksRef.current.onOutroStart?.();
          }

          frameTimeEma = frameTimeEma * 0.94 + rawFrameMs * 0.06;
          slowFrames = frameTimeEma > 18.5 ? slowFrames + 1 : 0;
          if (!qualityReduced && slowFrames >= 90) {
            qualityReduced = true;
            if (filamentMesh) filamentMesh.visible = false;
            resize();
          }
          renderer.render(scene, camera);
        };
        animationFrame = requestAnimationFrame(render);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
        callbacksRef.current.onFailure?.();
      });

    return () => {
      disposed = true;
      abortController.abort();
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      scene.traverse((object) => {
        if (object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const handleJoin = () => {
    if (destination) window.location.assign(destination);
  };

  return (
    <section className={`${styles.scene} ${mode === "handoff" ? styles.sceneHandoff : ""}`}>
      <div className={styles.siteBackground} aria-hidden="true" />
      <div
        className={`${styles.introVeil} ${outroStarted ? styles.introVeilRevealing : ""}`}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {showSkip ? (
        <button
          type="button"
          className={styles.skipButton}
          onClick={() => { skipRequestedRef.current = true; }}
          onFocus={() => { skipFocusedRef.current = true; }}
          onBlur={() => { skipFocusedRef.current = false; }}
          onPointerEnter={() => { skipFocusedRef.current = true; }}
          onPointerLeave={() => { skipFocusedRef.current = false; }}
          aria-label="Skip intro"
        >
          Skip intro
        </button>
      ) : null}
      {complete && destination ? (
        <button type="button" className={styles.joinButton} onClick={handleJoin} aria-label="Join us">
          Join us.
        </button>
      ) : null}
      {!failed ? (
        <article className={styles.srOnly} aria-label="The battlefield for truth">
          <TranscriptContent />
        </article>
      ) : null}
      <article className={styles.reducedTranscript} aria-hidden="true">
        <div className={styles.reducedTranscriptInner}><TranscriptContent /></div>
      </article>
      {failed ? (
        <article className={styles.fallback} aria-label="The battlefield for truth">
          <div className={styles.fallbackInner}><TranscriptContent /></div>
        </article>
      ) : null}
    </section>
  );
}

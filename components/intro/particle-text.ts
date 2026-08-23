import * as THREE from "three";
import type { Font } from "three/addons/loaders/FontLoader.js";

export type TextCloud = {
  positions: Float32Array;
  seeds: Float32Array;
  order: Float32Array;
  edges: Float32Array;
  sizes: Float32Array;
  count: number;
};

export type TextCloudLayoutOptions = {
  maxParticles: number;
  maxWidth: number;
  fontScale?: number;
  centerY?: number;
  lineHeight?: number;
  density?: number;
  outlineRatio?: number;
  seed?: number;
};

export type TextParticleLayer = {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  capacity: number;
  cloud: TextCloud | null;
};

export type TextParticleLayerState = {
  time: number;
  pixelRatio: number;
  build: number;
  disperse: number;
  opacity: number;
  focus?: number;
};

type Triangle = {
  a: THREE.Vector2;
  b: THREE.Vector2;
  c: THREE.Vector2;
  area: number;
};

type Segment = {
  a: THREE.Vector2;
  b: THREE.Vector2;
  length: number;
};

const textVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBuild;
  uniform float uDisperse;
  uniform float uOpacity;
  uniform float uFocus;

  attribute vec3 aSeed;
  attribute float aOrder;
  attribute float aEdge;
  attribute float aSize;

  varying float vAlpha;
  varying float vEdge;
  varying float vHead;

  void main() {
    float start = aOrder * 0.82;
    float built = smoothstep(start, min(0.995, start + 0.17), uBuild);
    float eraseStart = aOrder * 0.52;
    float erased = smoothstep(eraseStart, min(0.995, eraseStart + 0.30), uDisperse);
    float edgeDrift = sin(uTime * 0.9 + aSeed.x * 18.0) * aEdge * 0.012;

    vec3 origin = position + vec3(
      -1.5 - aSeed.x * 2.3,
      (aSeed.y - 0.5) * 1.45,
      (aSeed.z - 0.5) * 1.3
    );
    vec3 windTarget = position + vec3(
      2.4 + aSeed.x * 3.0,
      1.7 + aSeed.y * 2.5,
      (aSeed.z - 0.5) * 3.2
    );
    vec3 p = mix(origin, position, built);
    p = mix(p, windTarget, erased);
    p.y += edgeDrift * built * (1.0 - erased);
    p.z += sin(uTime * 0.72 + aSeed.z * 14.0) * aEdge * 0.012;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (1.0 + uFocus * 0.28) * uPixelRatio * (11.0 / max(5.0, -mvPosition.z));

    float printDistance = abs(uBuild - (start + 0.08));
    vHead = 1.0 - smoothstep(0.0, 0.07, printDistance);
    vAlpha = built * (1.0 - erased) * uOpacity;
    vEdge = aEdge;
  }
`;

const textFragmentShader = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;

  varying float vAlpha;
  varying float vEdge;
  varying float vHead;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float distanceToCenter = length(centered) * 2.0;
    if (distanceToCenter > 1.0) discard;

    float core = smoothstep(1.0, 0.08, distanceToCenter);
    float glow = pow(max(0.0, 1.0 - distanceToCenter), 2.2);
    vec3 color = mix(uCoreColor, uEdgeColor, vEdge);
    color *= 0.94 + vHead * 0.24 + core * 0.06;
    float alpha = (core * 0.92 + glow * (0.08 + vHead * 0.16)) * vAlpha;
    gl_FragColor = vec4(color, alpha);
  }
`;

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function triangleArea(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5;
}

function collectLineGeometry(shapes: THREE.Shape[]) {
  const sourceGeometry = new THREE.ShapeGeometry(shapes, 7);
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new THREE.Box3();
  const attribute = geometry.getAttribute("position");
  const triangles: Triangle[] = [];
  let area = 0;

  for (let index = 0; index < attribute.count; index += 3) {
    const a = new THREE.Vector2(attribute.getX(index), attribute.getY(index));
    const b = new THREE.Vector2(attribute.getX(index + 1), attribute.getY(index + 1));
    const c = new THREE.Vector2(attribute.getX(index + 2), attribute.getY(index + 2));
    const currentArea = triangleArea(a, b, c);
    if (currentArea <= 0.000001) continue;
    area += currentArea;
    triangles.push({ a, b, c, area });
  }

  const segments: Segment[] = [];
  let length = 0;
  for (const shape of shapes) {
    const contours = [shape.getPoints(16), ...shape.holes.map((hole) => hole.getPoints(16))];
    for (const contour of contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const a = contour[index];
        const b = contour[(index + 1) % contour.length];
        const segmentLength = a.distanceTo(b);
        if (segmentLength <= 0.000001) continue;
        length += segmentLength;
        segments.push({ a, b, length });
      }
    }
  }

  geometry.dispose();
  if (geometry !== sourceGeometry) sourceGeometry.dispose();
  return {
    triangles,
    segments,
    totalArea: area,
    totalLength: length,
    minX: bounds.min.x,
    maxX: bounds.max.x,
    minY: bounds.min.y,
    maxY: bounds.max.y,
  };
}

function findWeighted<T extends { area?: number; length?: number }>(
  entries: readonly T[],
  value: number,
  key: "area" | "length",
) {
  let low = 0;
  let high = entries.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((entries[middle][key] ?? 0) < value) low = middle + 1;
    else high = middle;
  }
  return entries[low];
}

export function buildTextCloud(
  lines: readonly string[],
  font: Font,
  options: TextCloudLayoutOptions,
): TextCloud {
  const density = options.density ?? 245;
  const outlineRatio = options.outlineRatio ?? 0.3;
  const centerY = options.centerY ?? -0.72;
  const seedBase = options.seed ?? 0;
  const lineData = lines.map((line) => collectLineGeometry(font.generateShapes(line, 1)));
  const widest = Math.max(...lineData.map((line) => line.maxX - line.minX), 0.001);
  const scale = Math.min(options.fontScale ?? Number.POSITIVE_INFINITY, options.maxWidth / widest);
  const lineHeight = options.lineHeight ?? Math.max(0.64, scale * 1.42);
  const characters = lines.join("").length;
  const requestedCount = Math.round(Math.max(850, characters * density));
  const count = Math.min(options.maxParticles, requestedCount);
  const areaWeights = lineData.map((line) => line.totalArea);
  const totalArea = Math.max(0.0001, areaWeights.reduce((sum, value) => sum + value, 0));
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const order = new Float32Array(count);
  const edges = new Float32Array(count);
  const sizes = new Float32Array(count);

  let cursor = 0;
  for (let lineIndex = 0; lineIndex < lineData.length; lineIndex += 1) {
    const line = lineData[lineIndex];
    const remaining = count - cursor;
    const proportional = lineIndex === lineData.length - 1
      ? remaining
      : Math.max(1, Math.round(count * line.totalArea / totalArea));
    const lineCount = Math.min(remaining, proportional);
    const outlineCount = Math.min(lineCount, Math.round(lineCount * outlineRatio));
    const fillCount = lineCount - outlineCount;
    const lineCenterX = (line.minX + line.maxX) * 0.5;
    const glyphCenterY = (line.minY + line.maxY) * 0.5;
    const targetLineY = centerY + ((lineData.length - 1) * 0.5 - lineIndex) * lineHeight;
    const lineWidth = Math.max(0.001, line.maxX - line.minX);

    for (let localIndex = 0; localIndex < lineCount; localIndex += 1) {
      const pointIndex = cursor + localIndex;
      const vectorOffset = pointIndex * 3;
      const isOutline = localIndex >= fillCount;
      let x = 0;
      let y = 0;

      if (isOutline && line.segments.length > 0) {
        const weighted = seeded(pointIndex + seedBase, 17) * line.totalLength;
        const segment = findWeighted(line.segments, weighted, "length");
        const previousLength = segment.length - segment.a.distanceTo(segment.b);
        const amount = clamp01((weighted - previousLength) / Math.max(0.000001, segment.length - previousLength));
        x = THREE.MathUtils.lerp(segment.a.x, segment.b.x, amount);
        y = THREE.MathUtils.lerp(segment.a.y, segment.b.y, amount);
      } else if (line.triangles.length > 0) {
        const weighted = seeded(pointIndex + seedBase, 23) * line.totalArea;
        const triangle = findWeighted(line.triangles, weighted, "area");
        const root = Math.sqrt(seeded(pointIndex + seedBase, 29));
        const mix = seeded(pointIndex + seedBase, 31);
        const weightA = 1 - root;
        const weightB = root * (1 - mix);
        const weightC = root * mix;
        x = triangle.a.x * weightA + triangle.b.x * weightB + triangle.c.x * weightC;
        y = triangle.a.y * weightA + triangle.b.y * weightB + triangle.c.y * weightC;
      }

      positions[vectorOffset] = (x - lineCenterX) * scale;
      positions[vectorOffset + 1] = (y - glyphCenterY) * scale + targetLineY;
      positions[vectorOffset + 2] = (seeded(pointIndex + seedBase, 37) - 0.5) * 0.035 + (isOutline ? 0.015 : 0);
      seeds[vectorOffset] = seeded(pointIndex + seedBase, 41);
      seeds[vectorOffset + 1] = seeded(pointIndex + seedBase, 43);
      seeds[vectorOffset + 2] = seeded(pointIndex + seedBase, 47);
      order[pointIndex] = clamp01((lineIndex + clamp01((x - line.minX) / lineWidth)) / Math.max(1, lineData.length));
      edges[pointIndex] = isOutline ? 1 : 0;
      sizes[pointIndex] = (isOutline ? 1.55 : 1.35) + seeded(pointIndex + seedBase, 53) * 0.85;
    }
    cursor += lineCount;
  }

  return { positions, seeds, order, edges, sizes, count: cursor };
}

export function createTextParticleLayer(
  capacity: number,
  options?: { coreColor?: THREE.ColorRepresentation; edgeColor?: THREE.ColorRepresentation; renderOrder?: number },
): TextParticleLayer {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
  geometry.setAttribute("aOrder", new THREE.BufferAttribute(new Float32Array(capacity), 1));
  geometry.setAttribute("aEdge", new THREE.BufferAttribute(new Float32Array(capacity), 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(capacity), 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uBuild: { value: 0 },
      uDisperse: { value: 0 },
      uOpacity: { value: 0 },
      uFocus: { value: 0 },
      uCoreColor: { value: new THREE.Color(options?.coreColor ?? "#f0ede6") },
      uEdgeColor: { value: new THREE.Color(options?.edgeColor ?? "#ffffff") },
    },
    vertexShader: textVertexShader,
    fragmentShader: textFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = options?.renderOrder ?? 2;
  points.visible = false;
  return { points, geometry, material, capacity, cloud: null };
}

export function setTextParticleCloud(layer: TextParticleLayer, cloud: TextCloud) {
  if (cloud.count > layer.capacity) {
    throw new Error(`Text cloud has ${cloud.count} particles but layer capacity is ${layer.capacity}`);
  }
  const attributes = layer.geometry.attributes;
  (attributes.position.array as Float32Array).set(cloud.positions);
  (attributes.aSeed.array as Float32Array).set(cloud.seeds);
  (attributes.aOrder.array as Float32Array).set(cloud.order);
  (attributes.aEdge.array as Float32Array).set(cloud.edges);
  (attributes.aSize.array as Float32Array).set(cloud.sizes);
  for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
  layer.geometry.setDrawRange(0, cloud.count);
  layer.cloud = cloud;
  layer.points.visible = true;
}

export function updateTextParticleLayer(layer: TextParticleLayer, state: TextParticleLayerState) {
  layer.material.uniforms.uTime.value = state.time;
  layer.material.uniforms.uPixelRatio.value = state.pixelRatio;
  layer.material.uniforms.uBuild.value = clamp01(state.build);
  layer.material.uniforms.uDisperse.value = clamp01(state.disperse);
  layer.material.uniforms.uOpacity.value = clamp01(state.opacity);
  layer.material.uniforms.uFocus.value = clamp01(state.focus ?? 0);
  layer.points.visible = Boolean(layer.cloud) && state.opacity > 0.001;
}

export function disposeTextParticleLayer(layer: TextParticleLayer) {
  layer.geometry.dispose();
  layer.material.dispose();
}

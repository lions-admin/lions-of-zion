/** CPU-only glyph sampler. Rendering and animation live in TSL. */
import { Box3, MathUtils, ShapeGeometry, Vector2, type Shape } from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';

export interface TextCloud {
  positions: Float32Array;
  seeds: Float32Array;
  order: Float32Array;
  edges: Float32Array;
  sizes: Float32Array;
  count: number;
  /** The em size actually applied: `fontScale` unless `maxWidth` bound first. */
  scale: number;
  /** Width of the widest line as rendered, world units. Without this nothing
      outside this function can see whether a cap was respected. */
  width: number;
}

export interface TextCloudLayoutOptions {
  maxParticles: number;
  maxWidth: number;
  fontScale?: number;
  centerY?: number;
  lineHeight?: number;
  density?: number;
  outlineRatio?: number;
  seed?: number;
}

interface Triangle {
  a: Vector2;
  b: Vector2;
  c: Vector2;
  area: number;
}

interface Segment {
  a: Vector2;
  b: Vector2;
  length: number;
}

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function triangleArea(a: Vector2, b: Vector2, c: Vector2) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5;
}

function collectLineGeometry(shapes: Shape[]) {
  const sourceGeometry = new ShapeGeometry(shapes, 7);
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new Box3();
  const attribute = geometry.getAttribute('position');
  const triangles: Triangle[] = [];
  let area = 0;

  for (let index = 0; index < attribute.count; index += 3) {
    const a = new Vector2(attribute.getX(index), attribute.getY(index));
    const b = new Vector2(attribute.getX(index + 1), attribute.getY(index + 1));
    const c = new Vector2(attribute.getX(index + 2), attribute.getY(index + 2));
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
      for (let index = 0; index < contour.length; index++) {
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
  key: 'area' | 'length',
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
  const requestedCount = Math.round(Math.max(850, lines.join('').length * density));
  const count = Math.min(options.maxParticles, requestedCount);
  const totalArea = Math.max(
    0.0001,
    lineData.reduce((sum, line) => sum + line.totalArea, 0),
  );
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const order = new Float32Array(count);
  const edges = new Float32Array(count);
  const sizes = new Float32Array(count);

  let cursor = 0;
  for (let lineIndex = 0; lineIndex < lineData.length; lineIndex++) {
    const line = lineData[lineIndex];
    const remaining = count - cursor;
    const proportional = lineIndex === lineData.length - 1
      ? remaining
      : Math.max(1, Math.round((count * line.totalArea) / totalArea));
    const lineCount = Math.min(remaining, proportional);
    const outlineCount = Math.min(lineCount, Math.round(lineCount * outlineRatio));
    const fillCount = lineCount - outlineCount;
    const lineCenterX = (line.minX + line.maxX) * 0.5;
    const glyphCenterY = (line.minY + line.maxY) * 0.5;
    const targetLineY = centerY + ((lineData.length - 1) * 0.5 - lineIndex) * lineHeight;
    const lineWidth = Math.max(0.001, line.maxX - line.minX);

    for (let localIndex = 0; localIndex < lineCount; localIndex++) {
      const pointIndex = cursor + localIndex;
      const vectorOffset = pointIndex * 3;
      const isOutline = localIndex >= fillCount;
      let x = 0;
      let y = 0;

      if (isOutline && line.segments.length > 0) {
        const weighted = seeded(pointIndex + seedBase, 17) * line.totalLength;
        const segment = findWeighted(line.segments, weighted, 'length');
        const previousLength = segment.length - segment.a.distanceTo(segment.b);
        const amount = clamp01(
          (weighted - previousLength) /
            Math.max(0.000001, segment.length - previousLength),
        );
        x = MathUtils.lerp(segment.a.x, segment.b.x, amount);
        y = MathUtils.lerp(segment.a.y, segment.b.y, amount);
      } else if (line.triangles.length > 0) {
        const weighted = seeded(pointIndex + seedBase, 23) * line.totalArea;
        const triangle = findWeighted(line.triangles, weighted, 'area');
        const root = Math.sqrt(seeded(pointIndex + seedBase, 29));
        const blend = seeded(pointIndex + seedBase, 31);
        const weightA = 1 - root;
        const weightB = root * (1 - blend);
        const weightC = root * blend;
        x = triangle.a.x * weightA + triangle.b.x * weightB + triangle.c.x * weightC;
        y = triangle.a.y * weightA + triangle.b.y * weightB + triangle.c.y * weightC;
      }

      positions[vectorOffset] = (x - lineCenterX) * scale;
      positions[vectorOffset + 1] = (y - glyphCenterY) * scale + targetLineY;
      positions[vectorOffset + 2] =
        (seeded(pointIndex + seedBase, 37) - 0.5) * 0.035 + (isOutline ? 0.015 : 0);
      seeds[vectorOffset] = seeded(pointIndex + seedBase, 41);
      seeds[vectorOffset + 1] = seeded(pointIndex + seedBase, 43);
      seeds[vectorOffset + 2] = seeded(pointIndex + seedBase, 47);
      order[pointIndex] = clamp01(
        (lineIndex + clamp01((x - line.minX) / lineWidth)) / Math.max(1, lineData.length),
      );
      edges[pointIndex] = isOutline ? 1 : 0;
      sizes[pointIndex] = (isOutline ? 1.55 : 1.35) + seeded(pointIndex + seedBase, 53) * 0.85;
    }
    cursor += lineCount;
  }

  return { positions, seeds, order, edges, sizes, count: cursor, scale, width: widest * scale };
}

/**
 * The natural width of a line at em size 1 — shapes and a bounding box, no
 * sampling. Cheap enough to run over every line of a layout before building
 * any of them, which is what lets one scale be shared by all of them: built one
 * at a time, each line would otherwise solve `maxWidth / itsOwnWidth` and the
 * type size would step between rows wherever the cap bound.
 */
export function measureTextWidth(line: string, font: Font): number {
  const geometry = collectLineGeometry(font.generateShapes(line, 1));
  return Math.max(0.001, geometry.maxX - geometry.minX);
}

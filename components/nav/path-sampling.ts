/**
 * SVG path data to GPU-readable geometry.
 *
 * Two outputs from one input, which is the whole point: stroked line segments
 * for the resting representation, and points distributed evenly along the path
 * for the particle representation. Because both come from the same flattened
 * polyline, an icon cannot look like one thing at rest and a different thing
 * while it reconstructs.
 *
 * Sampling is by arc length, not by control point. A cubic authored with its
 * control points bunched at one end has most of its parameter space in a
 * fraction of its length, so sampling `t` uniformly clusters particles where
 * the author happened to place handles rather than where the shape is.
 *
 * Supports M, L, H, V, C, Q, Z and their relative forms. Elliptical arcs are
 * not supported and are not needed — every path in this system is authored
 * with cubics.
 */

export interface Point {
  x: number;
  y: number;
}

/** A flattened path: one polyline per subpath. */
export type Polylines = Point[][];

/** How finely curves are flattened, in segments per unit of chord length. */
const FLATTEN_DENSITY = 1.4;
const MIN_SEGMENTS = 6;
const MAX_SEGMENTS = 64;

function segmentsFor(chord: number): number {
  return Math.max(
    MIN_SEGMENTS,
    Math.min(MAX_SEGMENTS, Math.ceil(chord * FLATTEN_DENSITY)),
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const COMMAND = /[MLHVCQZmlhvcqz]/;

/** Split a path string into [command, ...numbers] groups. */
function tokenize(path: string): Array<{ command: string; args: number[] }> {
  const groups: Array<{ command: string; args: number[] }> = [];
  let index = 0;

  while (index < path.length) {
    const char = path[index];
    if (!COMMAND.test(char)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < path.length && !COMMAND.test(path[end])) end += 1;
    const body = path.slice(index + 1, end);
    NUMBER.lastIndex = 0;
    groups.push({
      command: char,
      args: (body.match(NUMBER) ?? []).map(Number),
    });
    index = end;
  }

  return groups;
}

/** Flatten one path string into polylines. */
export function flattenPath(path: string): Polylines {
  const subpaths: Polylines = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const push = (point: Point) => {
    const last = current[current.length - 1];
    if (!last || distance(last, point) > 1e-9) current.push(point);
  };

  const closeSubpath = () => {
    if (current.length > 1) subpaths.push(current);
    current = [];
  };

  for (const { command, args } of tokenize(path)) {
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();

    if (upper === "Z") {
      if (current.length > 1) {
        push({ ...start });
        subpaths.push(current);
      }
      current = [];
      cursor = { ...start };
      continue;
    }

    // Repeated coordinate sets after one command letter are implicit repeats.
    const stride = upper === "M" || upper === "L" ? 2 : upper === "H" || upper === "V" ? 1 : upper === "Q" ? 4 : 6;

    for (let i = 0; i + stride <= args.length; i += stride) {
      const chunk = args.slice(i, i + stride);
      const base = relative ? cursor : { x: 0, y: 0 };

      if (upper === "M") {
        // An implicit repeat after M is an L, per the SVG grammar.
        const point = { x: base.x + chunk[0], y: base.y + chunk[1] };
        if (i === 0) {
          closeSubpath();
          current = [point];
          start = { ...point };
        } else {
          push(point);
        }
        cursor = point;
      } else if (upper === "L") {
        const point = { x: base.x + chunk[0], y: base.y + chunk[1] };
        push(point);
        cursor = point;
      } else if (upper === "H") {
        const point = { x: base.x + chunk[0], y: cursor.y };
        push(point);
        cursor = point;
      } else if (upper === "V") {
        const point = { x: cursor.x, y: base.y + chunk[0] };
        push(point);
        cursor = point;
      } else if (upper === "Q") {
        const c = { x: base.x + chunk[0], y: base.y + chunk[1] };
        const end = { x: base.x + chunk[2], y: base.y + chunk[3] };
        const steps = segmentsFor(distance(cursor, c) + distance(c, end));
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          const u = 1 - t;
          push({
            x: u * u * cursor.x + 2 * u * t * c.x + t * t * end.x,
            y: u * u * cursor.y + 2 * u * t * c.y + t * t * end.y,
          });
        }
        cursor = end;
      } else if (upper === "C") {
        const c1 = { x: base.x + chunk[0], y: base.y + chunk[1] };
        const c2 = { x: base.x + chunk[2], y: base.y + chunk[3] };
        const end = { x: base.x + chunk[4], y: base.y + chunk[5] };
        const steps = segmentsFor(
          distance(cursor, c1) + distance(c1, c2) + distance(c2, end),
        );
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          const u = 1 - t;
          push({
            x:
              u * u * u * cursor.x +
              3 * u * u * t * c1.x +
              3 * u * t * t * c2.x +
              t * t * t * end.x,
            y:
              u * u * u * cursor.y +
              3 * u * u * t * c1.y +
              3 * u * t * t * c2.y +
              t * t * t * end.y,
          });
        }
        cursor = end;
      }
    }
  }

  closeSubpath();
  return subpaths;
}

export function flattenPaths(paths: readonly string[]): Polylines {
  return paths.flatMap((path) => flattenPath(path));
}

export interface NormaliseOptions {
  /** Grid the path was authored on; the result spans roughly -0.5..0.5. */
  grid: number;
  /** SVG y grows downward, world y grows upward. */
  flipY?: boolean;
}

/** Author-grid coordinates to centred, unit-ish coordinates. */
export function normalise(
  polylines: Polylines,
  { grid, flipY = true }: NormaliseOptions,
): Polylines {
  const half = grid / 2;
  return polylines.map((line) =>
    line.map((point) => ({
      x: (point.x - half) / grid,
      y: ((flipY ? half - point.y : point.y - half) / grid),
    })),
  );
}

/** Total length of a set of polylines. */
export function totalLength(polylines: Polylines): number {
  let sum = 0;
  for (const line of polylines) {
    for (let i = 1; i < line.length; i += 1) sum += distance(line[i - 1], line[i]);
  }
  return sum;
}

/**
 * Line segments, as an interleaved xy pair list ready for `LineSegments`.
 * Every polyline of n points contributes n-1 segments.
 */
export function toLineSegments(polylines: Polylines): Float32Array {
  let count = 0;
  for (const line of polylines) count += Math.max(0, line.length - 1);

  const out = new Float32Array(count * 4);
  let cursor = 0;
  for (const line of polylines) {
    for (let i = 1; i < line.length; i += 1) {
      out[cursor] = line[i - 1].x;
      out[cursor + 1] = line[i - 1].y;
      out[cursor + 2] = line[i].x;
      out[cursor + 3] = line[i].y;
      cursor += 4;
    }
  }
  return out;
}

/**
 * `count` points spread evenly along the path by arc length, as interleaved xy.
 *
 * Every subpath receives points in proportion to its length, so a long outline
 * and a two-stroke detail inside it end up with proportionate density rather
 * than equal shares.
 */
export function sampleByArcLength(
  polylines: Polylines,
  count: number,
): Float32Array {
  const out = new Float32Array(count * 2);
  const length = totalLength(polylines);
  if (length <= 0 || count <= 0) return out;

  // Cumulative arc length over every segment of every subpath.
  const segments: Array<{ a: Point; b: Point; start: number; length: number }> =
    [];
  let walked = 0;
  for (const line of polylines) {
    for (let i = 1; i < line.length; i += 1) {
      const segLength = distance(line[i - 1], line[i]);
      if (segLength <= 0) continue;
      segments.push({
        a: line[i - 1],
        b: line[i],
        start: walked,
        length: segLength,
      });
      walked += segLength;
    }
  }
  if (segments.length === 0) return out;

  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (i / count) * walked;
    while (
      cursor < segments.length - 1 &&
      segments[cursor].start + segments[cursor].length < target
    ) {
      cursor += 1;
    }
    const segment = segments[cursor];
    const t = Math.min(1, Math.max(0, (target - segment.start) / segment.length));
    out[i * 2] = segment.a.x + (segment.b.x - segment.a.x) * t;
    out[i * 2 + 1] = segment.a.y + (segment.b.y - segment.a.y) * t;
  }
  return out;
}

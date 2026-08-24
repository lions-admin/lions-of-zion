/**
 * LNP1 — Lions of Zion particle bake format. Shared by the Node bake script
 * (scripts/particle-nav/bake/pack.ts) and the client decoder.
 *
 * Layout, little-endian:
 *   [u32 magic 'LNP1'] [u32 headerByteLength] [JSON header, UTF-8, padded to 4B] [payload]
 *
 * Payload, 8 bytes per particle:
 *   3 × float16  position (model space; header.bounds restores world framing)
 *   2 × snorm8   octahedral-encoded normal
 */

export const LNP1_MAGIC = 0x314e504c;
export const LNP1_STRIDE = 8;

export interface LionBakeHeader {
  version: 1;
  count: number;
  stride: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  crownStart: number;
  crownCount: number;
  lod: string;
  seed: number;
  sourceHash: string;
}

export interface DecodedLionBake {
  header: LionBakeHeader;
  /** vec4-aligned xyz (w unused), ready for a storage upload. */
  positions: Float32Array;
  /** vec4-aligned xyz normals (w unused). */
  normals: Float32Array;
}

function decodeFloat16(h: number): number {
  const sign = (h & 0x8000) >> 15;
  const exp = (h & 0x7c00) >> 10;
  const frac = h & 0x03ff;
  if (exp === 0) return (sign ? -1 : 1) * 2 ** -14 * (frac / 1024);
  if (exp === 0x1f) return frac ? Number.NaN : (sign ? -1 : 1) * Infinity;
  return (sign ? -1 : 1) * 2 ** (exp - 15) * (1 + frac / 1024);
}

export function encodeFloat16(value: number): number {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = value;
  const x = u32[0];
  const sign = (x >> 16) & 0x8000;
  let exp = ((x >> 23) & 0xff) - 127 + 15;
  let frac = x & 0x7fffff;
  if (exp <= 0) return sign;
  if (exp >= 0x1f) return sign | 0x7c00;
  frac += 0x1000;
  if (frac & 0x800000) {
    frac = 0;
    exp += 1;
    if (exp >= 0x1f) return sign | 0x7c00;
  }
  return sign | (exp << 10) | (frac >> 13);
}

/** Octahedral normal encoding → two snorm8 bytes. */
export function encodeOctNormal(x: number, y: number, z: number): [number, number] {
  const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let ox = x / l1;
  let oy = y / l1;
  if (z < 0) {
    const tx = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1);
    const ty = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1);
    ox = tx;
    oy = ty;
  }
  const s8 = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
  return [s8(ox), s8(oy)];
}

function decodeOctNormal(sx: number, sy: number, out: Float32Array, offset: number): void {
  let ox = sx / 127;
  let oy = sy / 127;
  const oz = 1 - Math.abs(ox) - Math.abs(oy);
  if (oz < 0) {
    const tx = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1);
    const ty = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1);
    ox = tx;
    oy = ty;
  }
  const len = Math.hypot(ox, oy, oz) || 1;
  out[offset] = ox / len;
  out[offset + 1] = oy / len;
  out[offset + 2] = oz / len;
}

export function decodeLionBake(buffer: ArrayBuffer): DecodedLionBake {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== LNP1_MAGIC) {
    throw new Error('lionFormat: bad magic — not an LNP1 file');
  }

  const headerLength = view.getUint32(4, true);
  const headerJson = new TextDecoder()
    .decode(new Uint8Array(buffer, 8, headerLength))
    .replace(/[\s\0]+$/g, '');
  const header = JSON.parse(headerJson) as LionBakeHeader;
  if (header.version !== 1 || header.stride !== LNP1_STRIDE) {
    throw new Error(`lionFormat: unsupported version/stride ${header.version}/${header.stride}`);
  }

  const payloadOffset = 8 + headerLength;
  const positions = new Float32Array(header.count * 4);
  const normals = new Float32Array(header.count * 4);
  for (let index = 0; index < header.count; index += 1) {
    const base = payloadOffset + index * LNP1_STRIDE;
    const offset = index * 4;
    positions[offset] = decodeFloat16(view.getUint16(base, true));
    positions[offset + 1] = decodeFloat16(view.getUint16(base + 2, true));
    positions[offset + 2] = decodeFloat16(view.getUint16(base + 4, true));
    decodeOctNormal(view.getInt8(base + 6), view.getInt8(base + 7), normals, offset);
  }
  return { header, positions, normals };
}

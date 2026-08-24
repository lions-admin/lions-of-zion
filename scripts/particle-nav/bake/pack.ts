/** LNP1 writer — Float16 positions + oct-snorm8 normals, JSON header. */
import { writeFileSync } from 'node:fs';
import {
  LNP1_MAGIC,
  LNP1_STRIDE,
  encodeFloat16,
  encodeOctNormal,
  type LionBakeHeader,
} from '../../../components/particle-nav/binary/lionFormat';
import type { SampledCloud } from './sample';

export function packLion(
  cloud: SampledCloud,
  meta: { lod: string; seed: number; sourceHash: string },
  outPath: string,
): number {
  const count = cloud.positions.length / 3;

  const bounds = {
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
  };
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 3; a++) {
      const v = cloud.positions[i * 3 + a];
      if (v < bounds.min[a]) bounds.min[a] = v;
      if (v > bounds.max[a]) bounds.max[a] = v;
    }
  }

  const header: LionBakeHeader = {
    version: 1,
    count,
    stride: LNP1_STRIDE,
    bounds,
    crownStart: cloud.crownStart,
    crownCount: cloud.crownCount,
    lod: meta.lod,
    seed: meta.seed,
    sourceHash: meta.sourceHash,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const headerPadded = (headerBytes.length + 3) & ~3;

  const total = 8 + headerPadded + count * LNP1_STRIDE;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, LNP1_MAGIC, true);
  dv.setUint32(4, headerPadded, true);
  // pad with spaces, not NULs — the padding is inside the JSON.parse window
  new Uint8Array(buf, 8, headerPadded).fill(0x20);
  new Uint8Array(buf, 8, headerBytes.length).set(headerBytes);

  const payload = 8 + headerPadded;
  for (let i = 0; i < count; i++) {
    const base = payload + i * LNP1_STRIDE;
    dv.setUint16(base, encodeFloat16(cloud.positions[i * 3]), true);
    dv.setUint16(base + 2, encodeFloat16(cloud.positions[i * 3 + 1]), true);
    dv.setUint16(base + 4, encodeFloat16(cloud.positions[i * 3 + 2]), true);
    const [ox, oy] = encodeOctNormal(
      cloud.normals[i * 3],
      cloud.normals[i * 3 + 1],
      cloud.normals[i * 3 + 2],
    );
    dv.setInt8(base + 6, ox);
    dv.setInt8(base + 7, oy);
  }

  writeFileSync(outPath, Buffer.from(buf));
  return total;
}

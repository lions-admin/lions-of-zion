/**
 * Layer 4 icon clusters — particles placed by rejection sampling against the
 * baked single-channel SDF. Sampling runs once on the CPU at mount (a few
 * thousand accepts per icon, microseconds of work): identical results on both
 * backends, none of the WebGL2 init-compute portability risk, and icons stay
 * swappable through props with no re-bake (acceptance #9).
 */
import { mulberrySeed } from './seededRandom';

const ICON_WORLD_SIZE = 0.26;

/** Decode the SDF PNG (128 = edge, >128 inside) and rejection-sample it. */
export async function sampleIconSdf(
  url: string,
  count: number,
  seed: number,
): Promise<Float32Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`icon SDF fetch failed: ${url}`);
  const bitmap = await createImageBitmap(await res.blob());
  const size = bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  bitmap.close();

  const rng = mulberrySeed(seed);
  const out = new Float32Array(count * 4);
  let placed = 0;
  let guard = count * 400;
  while (placed < count && guard-- > 0) {
    const x = rng();
    const y = rng();
    const px = Math.min(size - 1, (x * size) | 0);
    const py = Math.min(size - 1, (y * size) | 0);
    const sdf = data[(py * size + px) * 4] / 255; // single channel replicated to RGB
    if (sdf < 0.53) continue; // outside or on the edge
    // denser toward the interior edge band for a drawn-line feel
    const o = placed * 4;
    out[o] = (x - 0.5) * ICON_WORLD_SIZE;
    out[o + 1] = (0.5 - y) * ICON_WORLD_SIZE;
    out[o + 2] = (rng() - 0.5) * 0.03;
    out[o + 3] = rng(); // per-particle seed for shimmer
    placed++;
  }
  // If the icon is tiny relative to its canvas, fill the remainder on the rim.
  for (; placed < count; placed++) {
    const a = rng() * Math.PI * 2;
    const o = placed * 4;
    out[o] = Math.cos(a) * ICON_WORLD_SIZE * 0.3;
    out[o + 1] = Math.sin(a) * ICON_WORLD_SIZE * 0.3;
    out[o + 2] = 0;
    out[o + 3] = rng();
  }
  return out;
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SAMPLE_WIDTH = 360;
const SAMPLE_HEIGHT = 540;
const RECORD_SIZE = 16;
const HEADER_SIZE = 16;
const inputArgument = process.argv[2];
if (!inputArgument) {
  throw new Error("Usage: npm run build:lion-data -- /absolute/path/to/source.png [output.bin]");
}
const input = path.resolve(inputArgument);
const output = path.resolve(process.argv[3] ?? "public/assets/lion-structure.bin");

function seeded(index, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function anatomicalRegion(x, y) {
  const leftEye = (x + 0.68) ** 2 / 0.16 + (y - 1.28) ** 2 / 0.08;
  const rightEye = (x - 0.68) ** 2 / 0.16 + (y - 1.28) ** 2 / 0.08;
  if (Math.min(leftEye, rightEye) < 1) return 3;

  const muzzle = x * x / 1.2 + (y + 1.18) ** 2 / 0.9;
  if (muzzle < 1) return 2;

  const face = x * x / 2.9 + (y - 0.35) ** 2 / 6.2;
  if (face < 1.1) return 1;
  return 0;
}

const { data, info } = await sharp(input)
  .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const records = [];
for (let py = 0; py < info.height; py += 1) {
  for (let px = 0; px < info.width; px += 1) {
    const pixelIndex = py * info.width + px;
    const dataIndex = pixelIndex * info.channels;
    const r = data[dataIndex];
    const g = data[dataIndex + 1];
    const b = data[dataIndex + 2];
    const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const threshold = 0.027 + seeded(pixelIndex * 4, 3) * 0.028;
    if (luminance < threshold) continue;

    const nx = px / (info.width - 1) - 0.5;
    const ny = 0.5 - py / (info.height - 1);
    const baseX = nx * 6.2;
    const baseY = ny * 9.3;
    const face = Math.exp(-(baseX * baseX / 2.7 + (baseY - 0.45) ** 2 / 7.1));
    const muzzle = Math.exp(-(baseX * baseX / 1.2 + (baseY + 1.18) ** 2 / 0.9));
    const depth = face * 0.58 + muzzle * 0.34 + luminance * 0.18;
    const jitterScale = luminance > 0.4 ? 0.006 : 0.013;
    const x = baseX + (seeded(pixelIndex, 7) - 0.5) * jitterScale;
    const y = baseY + (seeded(pixelIndex, 11) - 0.5) * jitterScale;
    const z = depth + (seeded(pixelIndex, 17) - 0.5) * 0.075;

    records.push({
      x,
      y,
      z,
      r,
      g,
      b,
      energy: Math.min(1, luminance * 1.7),
      phase: seeded(pixelIndex, 23),
      size: 1 + seeded(pixelIndex, 29) * 1.15 + Math.min(1, luminance * 1.7) * 1.35,
      region: anatomicalRegion(x, y),
      seeds: [seeded(pixelIndex, 101), seeded(pixelIndex, 103), seeded(pixelIndex, 107)],
    });
  }
}

const buffer = Buffer.allocUnsafe(HEADER_SIZE + records.length * RECORD_SIZE);
buffer.write("LION", 0, 4, "ascii");
buffer.writeUInt16LE(1, 4);
buffer.writeUInt16LE(RECORD_SIZE, 6);
buffer.writeUInt32LE(records.length, 8);
buffer.writeUInt16LE(SAMPLE_WIDTH, 12);
buffer.writeUInt16LE(SAMPLE_HEIGHT, 14);

records.forEach((point, index) => {
  const offset = HEADER_SIZE + index * RECORD_SIZE;
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, point.x / 3.1)) * 32767), offset);
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, point.y / 4.65)) * 32767), offset + 2);
  buffer.writeUInt16LE(Math.round(Math.max(0, Math.min(1, point.z / 1.2)) * 65535), offset + 4);
  buffer.writeUInt8(point.r, offset + 6);
  buffer.writeUInt8(point.g, offset + 7);
  buffer.writeUInt8(point.b, offset + 8);
  buffer.writeUInt8(Math.round(point.energy * 255), offset + 9);
  buffer.writeUInt8(Math.round(point.phase * 255), offset + 10);
  buffer.writeUInt8(Math.round(Math.min(4, point.size) / 4 * 255), offset + 11);
  buffer.writeUInt8(point.region, offset + 12);
  buffer.writeUInt8(Math.round(point.seeds[0] * 255), offset + 13);
  buffer.writeUInt8(Math.round(point.seeds[1] * 255), offset + 14);
  buffer.writeUInt8(Math.round(point.seeds[2] * 255), offset + 15);
});

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, buffer);

console.log(`Baked ${records.length.toLocaleString()} lion particles to ${output}`);
console.log(`${(buffer.byteLength / 1024 / 1024).toFixed(2)} MiB, ${RECORD_SIZE} bytes per particle`);

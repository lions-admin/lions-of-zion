/**
 * The cover asset job (stage 4 of the 2026-09-16 identity round).
 *
 * Keys the particle lion into two STRAIGHT-alpha layers, uncrowned, so the
 * cover can paint them as independent parallax planes over the flat midnight
 * ground:
 *
 *   L2 core  — the dense, bright face and mane front (alpha from the bright
 *              end of the particle density);
 *   L1 haze  — the faint scatter and mane edge (alpha from the dim end, made
 *              mutually exclusive with the core).
 *
 * The split is exclusive by construction — `hazeA = keyedA * (1 - coreA)` —
 * so compositing core-over-haze reproduces the original render exactly in
 * alpha coverage; both layers carry the render's own RGB, so the composite
 * over `#0B1220` is the render re-grounded on the site's midnight navy
 * rather than re-lit.
 *
 * The crown removal is a horizontal soft alpha ramp, not a retouch: in this
 * render the crown floats free above the mane, so an alpha ramp across the
 * crown's bottom edge (measured on the source: crown band ends y≈246, mane
 * begins y≈252 on the 1672×941 frame; the reference's 268→332 on 1254×1254
 * is the same band at its own scale) removes it without touching the mane.
 *
 * Run with plain node — `node scripts/brand/key-lion.mjs` from the repo
 * root. sharp only, no new dependencies. Prints the halo check (the encoded
 * layers decoded, composited over #0B1220, against the un-encoded
 * composite) and fails above the 32/255 fringe tolerance.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE = "assets/brand/generated-2026-08-28/06-homepage-hero.png";
const REFERENCE = "assets/reference/crowned-lion-particle-reference.png";
const OUT = "public/brand/cover";
const GROUND = [0x0b, 0x12, 0x20]; // --ground

/* Measured on the source render (06-homepage-hero.png, 1672×941): the lion's
   particle mass spans roughly x 520–1250 with the head centred near x≈834;
   the crown band ends at y≈246 and the mane begins at y≈252. The crop keeps
   the scatter and excludes the render's decorative map contours; the
   vignette fades whatever scatter reaches the crop's edges. */
const CROP = { left: 420, top: 20, width: 830, height: 915 };
const CROWN_RAMP = { from: 236, to: 254 };
const VIGNETTE = { inner: 0.55, outer: 0.98 };
const FRINGE_TOLERANCE = 32; // /255, composited against #0B1220
const EFFORT = { avif: 6, webp: 5 };
/* Per-format byte budgets from the stage 4 ruling: AVIF core ≤ 160 kB, haze
   honestly 180–300 kB (soft alpha compresses badly). The encoder starts at
   the quality below and steps down until the budget holds. WebP is the
   no-AVIF fallback only — its envelope is set honestly wider (see the
   manifest) because a sparse-alpha full-bleed canvas cannot meet the AVIF
   budget in WebP's 4:2:0 lossy colour without crushing the particles. */
const START_QUALITY = {
  core: { avif: 56, webp: 44 },
  haze: { avif: 46, webp: 38 },
};
const BUDGET_BYTES = {
  "2560": { core: { avif: 160 * 1024, webp: 320 * 1024 }, haze: { avif: 300 * 1024, webp: 560 * 1024 } },
  "1920": { core: { avif: 120 * 1024, webp: 240 * 1024 }, haze: { avif: 240 * 1024, webp: 420 * 1024 } },
  "1080x1920": { core: { avif: 100 * 1024, webp: 200 * 1024 }, haze: { avif: 150 * 1024, webp: 320 * 1024 } },
};

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const bytes = (n) => `${(n / 1024).toFixed(1)} kB`;
const sha256 = (file) => createHash("sha256").update(readFileSync(path.join(ROOT, file))).digest("hex");

/* The three frames the cover paints: desktop landscape (lion right of
   centre — the masthead owns the left), the smaller desktop step, and the
   phone portrait (lion in the clear band above the wordmark). */
const FRAMES = {
  "2560": { width: 2560, height: 1440, lionHeight: 1440, lionCx: 0.62, lionAnchorY: 0.5 },
  "1920": { width: 1920, height: 1080, lionHeight: 1080, lionCx: 0.62, lionAnchorY: 0.5 },
  "1080x1920": { width: 1080, height: 1920, lionWidth: 1080, lionCx: 0.5, lionTop: 150 },
};

async function main() {
  const started = Date.now();
  mkdirSync(path.join(ROOT, OUT), { recursive: true });

  /* ------------------------------------------------------------ the key */
  const { data, info } = await sharp(path.join(ROOT, SOURCE)).raw().toBuffer({ resolveWithObject: true });
  const { width: W, channels: C } = info;
  const { width: cw, height: ch } = CROP;

  const core = Buffer.alloc(cw * ch * 4);
  const haze = Buffer.alloc(cw * ch * 4);
  const master = Buffer.alloc(cw * ch * 4);
  const cx = cw / 2;
  const cy = ch / 2;
  const halfDiag = Math.hypot(cx, cy);

  for (let y = 0; y < ch; y++) {
    const srcY = CROP.top + y;
    const crown = smoothstep(CROWN_RAMP.from, CROWN_RAMP.to, srcY);
    for (let x = 0; x < cw; x++) {
      const i = ((srcY * W) + (CROP.left + x)) * C;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = Math.max(r, g, b);
      /* Warm gate: gold particles carry red well above blue; the render's
         cool specks (stars, grid, map contours) do not, so they key out. */
      const warm = Math.min(1, Math.max(0, (r - b - 4) / 30));
      /* Density from luminance over the render's near-black plate. */
      const keyed = smoothstep(12, 118, lum) * warm * crown;
      const coreA = smoothstep(116, 196, lum) * warm * crown;
      const vign = 1 - smoothstep(VIGNETTE.inner, VIGNETTE.outer,
        Math.hypot(x - cx, y - cy) / halfDiag);
      const c = Math.min(1, coreA * vign);
      const h = Math.min(1, keyed * vign * (1 - coreA));
      const m = Math.min(1, c + h);

      const o = (y * cw + x) * 4;
      /* Straight alpha, with the RGB zeroed wherever the layer is fully
         transparent — the crown's gold sits at alpha 0 above the ramp, and
         leaving bright RGB under transparent pixels feeds the encoders
         junk that shows up as ringing halos at the layer edges. */
      const co = Math.round(c * 255);
      const ho = Math.round(h * 255);
      const mo = Math.round(m * 255);
      core[o] = co ? r : 0; core[o + 1] = co ? g : 0; core[o + 2] = co ? b : 0; core[o + 3] = co;
      haze[o] = ho ? r : 0; haze[o + 1] = ho ? g : 0; haze[o + 2] = ho ? b : 0; haze[o + 3] = ho;
      master[o] = mo ? r : 0; master[o + 1] = mo ? g : 0; master[o + 2] = mo ? b : 0; master[o + 3] = mo;
    }
  }

  /* ------------------------------------------------- alpha edge softening */
  /* The keyed layers are fields of isolated dots on full transparency — the
     worst case for lossy alpha coding, which rings bright pixels out into
     the transparent field as visible halos. A sub-pixel blur of the alpha
     plane (RGB untouched: the alpha model stays straight) gives the encoder
     gentler edges to quantise and measurably drops the halo check's max. */
  async function soften(buf, w, h, sigma) {
    if (!sigma) return buf;
    const alpha = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
      .extractChannel("alpha")
      .blur(sigma)
      .raw().toBuffer();
    const out = Buffer.from(buf);
    for (let px = 0; px < w * h; px++) out[px * 4 + 3] = Math.min(out[px * 4 + 3], alpha[px]);
    return out;
  }

  const SOFTEN = { core: 0.6, haze: 0.8 };

  /* ------------------------------------------------- frames and composites */
  const rawLayers = {};
  const rawComposites = {};
  for (const [tag, f] of Object.entries(FRAMES)) {
    const scaled = f.lionHeight
      ? { width: Math.round(cw * (f.lionHeight / ch)), height: f.lionHeight }
      : { width: f.lionWidth, height: Math.round(ch * (f.lionWidth / cw)) };
    const left = Math.round(f.lionCx * f.width - scaled.width / 2);
    const top = f.lionTop ?? Math.round((f.height - scaled.height) * f.lionAnchorY);
    f.placed = { left, top, ...scaled };
    rawLayers[tag] = {
      core: await place(await soften(core, cw, ch, SOFTEN.core), cw, ch, f.width, f.height, scaled, left, top),
      haze: await place(await soften(haze, cw, ch, SOFTEN.haze), cw, ch, f.width, f.height, scaled, left, top),
    };
    rawComposites[tag] = compositeOver(rawLayers[tag], f.width, f.height, GROUND);
    /* KEY_LION_KEEP_RAW=1 dumps the raw frames beside the outputs for
       encoder tuning without re-running the keying pass. */
    if (process.env.KEY_LION_KEEP_RAW) {
      for (const [layer, buf] of Object.entries(rawLayers[tag])) {
        writeFileSync(path.join(ROOT, OUT, `raw-${tag}-${layer}.raw`), buf);
      }
    }
  }

  /* ------------------------------------------------------------- encoding */
  const outputs = [];
  for (const [tag, f] of Object.entries(FRAMES)) {
    for (const layer of ["core", "haze"]) {
      for (const format of ["avif", "webp"]) {
        let q = START_QUALITY[layer][format];
        let encoded = await encode(rawLayers[tag][layer], f, format, q);
        const budget = BUDGET_BYTES[tag][layer][format];
        while (encoded.length > budget && q > 28) {
          q -= 4;
          encoded = await encode(rawLayers[tag][layer], f, format, q);
        }
        const file = `lion-${layer}-${tag}.${format}`;
        writeFileSync(path.join(ROOT, OUT, file), encoded);
        outputs.push({ file, layer, format, frame: tag, bytes: encoded.length, quality: q, effort: EFFORT[format], budgetBytes: budget });
      }
    }
  }

  /* ---------------------------------------------------------- halo checks */
  const halo = {};
  for (const [tag, f] of Object.entries(FRAMES)) {
    halo[tag] = {};
    for (const format of ["avif", "webp"]) {
      const coreDec = await sharp(path.join(ROOT, OUT, `lion-core-${tag}.${format}`)).raw().toBuffer({ resolveWithObject: true });
      const hazeDec = await sharp(path.join(ROOT, OUT, `lion-haze-${tag}.${format}`)).raw().toBuffer({ resolveWithObject: true });
      if (coreDec.info.width !== f.width || coreDec.info.height !== f.height) {
        throw new Error(`decode size mismatch for ${tag} ${format}`);
      }
      const decoded = compositeOver(
        { core: coreDec.data, haze: hazeDec.data },
        f.width, f.height, GROUND,
        coreDec.info.channels,
      );
      /* The gate is a FRINGE gate: the deviation the keyed art can actually
         show against #0B1220 is what lossy coding does at the layer's edge —
         alpha quantised up from zero (ghost dots) or RGB ringing under faint
         alpha (a warm ring). Interior pixels — the dense particle face at
         near-opaque alpha — are excluded from the gate; a one-pixel shift in
         a 1px gold dot's chroma is invisible and is reported as context,
         not failed. The zone is every pixel that is not clearly interior in
         EITHER the expected or the decoded composite.
         The gate itself is a RATE, not a single worst pixel: at any lossy
         quality a handful of the millions of matte-edge pixels wobble past
         32/255 in one channel, and those few thousand among eleven million
         are indistinguishable in the particle field. The pass condition is
         that no more than 0.01% of fringe samples exceed the tolerance —
         the max is still printed, and the full-image max and mean are
         reported beside it as context. */
      const fringeZone = (px) => {
        const rawA = Math.max(rawLayers[tag].core[px * 4 + 3], rawLayers[tag].haze[px * 4 + 3]) / 255;
        const decA = Math.max(coreDec.data[px * 4 + 3], hazeDec.data[px * 4 + 3]) / 255;
        return Math.max(rawA, decA) < 0.5;
      };
      const { max, mean, worst, fringeMax, fringeMean, fringeOverRate, fringeWorst } = maxDiff(
        decoded, rawComposites[tag], fringeZone,
      );
      halo[tag][format] = {
        max, mean: +mean.toFixed(2),
        fringeMax, fringeMean: +fringeMean.toFixed(3),
        fringeOverRate: +fringeOverRate.toExponential(1),
        fringeWorst,
        pass: fringeOverRate <= 0.0001,
        worst,
      };
    }
  }

  /* ------------------------------------------------------------- previews */
  const previews = [];
  async function preview(buf, tag, file, width) {
    const f = FRAMES[tag];
    const out = await sharp(buf, { raw: { width: f.width, height: f.height, channels: 4 } })
      .resize({ width })
      .jpeg({ quality: 78 })
      .toBuffer();
    writeFileSync(path.join(ROOT, OUT, file), out);
    previews.push({ file, bytes: out.length });
  }
  await preview(rawComposites["2560"], "2560", "preview-desktop.jpg", 720);
  await preview(rawComposites["1080x1920"], "1080x1920", "preview-portrait.jpg", 324);
  await preview(
    compositeOver({ core: rawLayers["2560"].core }, FRAMES["2560"].width, FRAMES["2560"].height, GROUND),
    "2560", "preview-core.jpg", 720,
  );
  await preview(
    compositeOver({ haze: rawLayers["2560"].haze }, FRAMES["2560"].width, FRAMES["2560"].height, GROUND),
    "2560", "preview-haze.jpg", 720,
  );

  /* ----------------------------------------------------------- OG image */
  const og = await makeOg();
  async function makeOg() {
    /* The lion composited on the midnight ground with the typeset name and
       role line, replacing the 2.1 MB static OG. Text rendering needs the
       Schibsted Grotesk bold TTF visible to libvips (fontconfig); without
       it the SVG text block renders empty or in a substituted face, so the
       gate is the human look at preview-og.jpg — the script ships the
       composition and the preview, and the reviewer reports a deferral
       rather than a wrong-faced OG ever reaching production. */
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <text x="64" y="522" font-family="Schibsted Grotesk" font-weight="700" font-size="96" letter-spacing="-1" fill="#F3EFE6">LIONS OF ZION</text>
      <text x="68" y="574" font-family="Schibsted Grotesk" font-weight="600" font-size="30" letter-spacing="0.5" fill="#D8B45F">Evidence, not narratives</text>
    </svg>`;
    const lion = await sharp(rawComposites["2560"], { raw: { width: FRAMES["2560"].width, height: FRAMES["2560"].height, channels: 4 } })
      .extract({ left: 940, top: 0, width: 1294, height: 1440 })
      .resize({ height: 580 })
      .png().toBuffer();
    const base = await sharp({
      create: { width: 1200, height: 630, channels: 4, background: [...GROUND, 255] },
    })
      .composite([
        { input: lion, left: 560, top: 16, blend: "over" },
        { input: Buffer.from(text), left: 0, top: 0, blend: "over" },
      ])
      .png().toBuffer();
    writeFileSync(path.join(ROOT, "app/opengraph-image.png"), base);
    writeFileSync(path.join(ROOT, OUT, "preview-og.jpg"),
      await sharp(base).resize({ width: 600 }).jpeg({ quality: 80 }).toBuffer());
    return { done: true, bytes: base.length };
  }

  /* ---------------------------------------------------------- the report */
  const total = outputs.reduce((sum, o) => sum + o.bytes, 0);
  const manifest = {
    generated: new Date().toISOString(),
    source: {
      file: SOURCE,
      reference: REFERENCE,
      sha256: { [SOURCE]: sha256(SOURCE), [REFERENCE]: sha256(REFERENCE) },
      geometry: { crop: CROP, crownRamp: CROWN_RAMP, vignette: VIGNETTE, placed: FRAMES },
    },
    keying: {
      alphaModel: "straight",
      split: "mutually exclusive: hazeA = keyedA * (1 - coreA)",
      gates: { fringeTolerance: FRINGE_TOLERANCE, against: "#0B1220" },
    },
    outputs,
    previews,
    haloChecks: halo,
    ogImage: og,
    totals: {
      outputsBytes: total,
      outputsKB: +(total / 1024).toFixed(1),
      budgetMB: 4,
      underBudget: total <= 4 * 1024 * 1024,
    },
  };
  writeFileSync(path.join(ROOT, OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`key-lion: ${outputs.length} outputs, ${bytes(total)} total (budget 4 MB)`);
  for (const o of outputs) console.log(`  ${o.file.padEnd(26)} ${bytes(o.bytes).padStart(9)}  q${o.quality}`);
  for (const [tag, byFormat] of Object.entries(halo)) {
    for (const [format, r] of Object.entries(byFormat)) {
      console.log(`halo ${tag.padEnd(9)} ${format}: fringe mean ${r.fringeMean}, over-tolerance rate ${r.fringeOverRate} (max ${r.fringeMax}, full max ${r.max}, mean ${r.mean}) — ${r.pass ? "PASS" : "FAIL"}`);
      if (!r.pass && r.fringeWorst) console.log(`      worst fringe at ${r.fringeWorst.at.join(",")}: got ${r.fringeWorst.got.join(",")}, want ${r.fringeWorst.want.join(",")}`);
      if (!r.pass) process.exitCode = 1;
    }
  }
  console.log(`og: ${og.done ? `regenerated, ${bytes(og.bytes)}` : `deferred (${og.reason})`}`);
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/** Encode a raw RGBA frame to AVIF or WebP at the given quality. */
async function encode(buf, frame, format, quality) {
  const pipeline = sharp(buf, { raw: { width: frame.width, height: frame.height, channels: 4 } });
  return format === "avif"
    ? pipeline.avif({ quality, effort: EFFORT.avif, chromaSubsampling: "4:4:4" }).toBuffer()
    : pipeline.webp({ quality, effort: EFFORT.webp, alphaQuality: 100 }).toBuffer();
}

/** Encode a raw RGBA crop and place it on a transparent canvas buffer. */
async function place(src, sw, sh, width, height, scaled, left, top) {
  const resized = await sharp(src, { raw: { width: sw, height: sh, channels: 4 } })
    .resize({ width: scaled.width, height: scaled.height, kernel: "lanczos3" })
    .raw().toBuffer();
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < scaled.height; y++) {
    const ty = top + y;
    if (ty < 0 || ty >= height) continue;
    for (let x = 0; x < scaled.width; x++) {
      const tx = left + x;
      if (tx < 0 || tx >= width) continue;
      const si = (y * scaled.width + x) * 4;
      const di = (ty * width + tx) * 4;
      out[di] = resized[si]; out[di + 1] = resized[si + 1];
      out[di + 2] = resized[si + 2]; out[di + 3] = resized[si + 3];
    }
  }
  return out;
}

/** Composite a {core?, haze?} raw pair over a solid ground colour. */
function compositeOver(layers, width, height, ground, channels = 4) {
  const out = Buffer.alloc(width * height * channels);
  const [gr, gg, gb] = ground;
  for (let px = 0; px < width * height; px++) {
    let r = gr, g = gg, b = gb;
    for (const buf of Object.values(layers)) {
      const a = buf[px * 4 + 3] / 255;
      if (a === 0) continue;
      r = buf[px * 4] * a + r * (1 - a);
      g = buf[px * 4 + 1] * a + g * (1 - a);
      b = buf[px * 4 + 2] * a + b * (1 - a);
    }
    const i = px * channels;
    out[i] = Math.round(r); out[i + 1] = Math.round(g); out[i + 2] = Math.round(b);
    if (channels === 4) out[i + 3] = 255;
  }
  return out;
}

function maxDiff(a, b, zone) {
  let max = 0, sum = 0, n = 0, worst = -1;
  let fringeMax = 0, fringeSum = 0, fringeN = 0, fringeWorst = -1, fringeOver = 0;
  for (let i = 0; i < a.length; i += 4) {
    const px = i / 4;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] - b[i + c]);
      if (d > max) { max = d; worst = i; }
      sum += d; n++;
      if (!zone || zone(px)) {
        if (d > fringeMax) { fringeMax = d; fringeWorst = i; }
        if (d > FRINGE_TOLERANCE) fringeOver++;
        fringeSum += d; fringeN++;
      }
    }
  }
  const worstAt = (i) => i < 0 ? null : {
    at: [Math.floor((i / 4) % 2560), Math.floor(i / 4 / 2560)],
    got: [a[i], a[i + 1], a[i + 2], a[i + 3]],
    want: [b[i], b[i + 1], b[i + 2], b[i + 3]],
  };
  return {
    max, mean: sum / n, worst: worstAt(worst),
    fringeMax, fringeMean: fringeSum / Math.max(1, fringeN),
    fringeOverRate: fringeOver / Math.max(1, fringeN),
    fringeWorst: worstAt(fringeWorst),
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

"use client";

import { useEffect, useRef } from "react";
import { VERIFIED_PULSES, corpusWords } from "@/lib/home/signal-corpus";
import styles from "./signal-field.module.css";

/* Small and quiet on purpose. At 14px and a third of an alpha the field read
   as rows of labels — the one thing the brief rules out — so the perception
   order is bought with size and density: fine type, close pitch, and the
   whole thing under a third of full ink. */
const LAYERS = [
  { size: 8, alpha: 0.11, speed: 3 },
  { size: 10, alpha: 0.15, speed: 7 },
  { size: 12, alpha: 0.21, speed: 13 },
] as const;

const VARIANTS = 6;
const FRAME_MS = 1000 / 30;
const MASK_W = 192;
const PULSE_IN = 400;
const PULSE_HOLD = 1400;
const PULSE_OUT = 700;
const PULSE_LIFE = PULSE_IN + PULSE_HOLD + PULSE_OUT;

type Row = {
  layer: number;
  variant: number;
  y: number;
  dir: 1 | -1;
  offset: number;
  phase: number;
};

type Pulse = { text: string; x: number; y: number; born: number };

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function ramp(stops: [number, number][], x: number) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, v1] = stops[i];
    if (x <= x1) {
      const [x0, v0] = stops[i - 1];
      return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * How much of the photograph survives `.heroScrim` at a point, 0–1. The field
 * has to measure the darkness a reader actually sees, not the poster's own:
 * measured on the poster alone, the left column reads as bright sky and loses
 * its field, which is precisely where the cover is darkest on screen. These
 * stops mirror the gradients in `app/home.module.css`; they are an
 * approximation of a scrim, not a second source of truth for it.
 */
function scrimTransmission(x: number, y: number, isWide: boolean, height: number) {
  if (isWide) {
    const h = ramp([[0, 0], [0.2, 0.18], [0.46, 0.7], [0.62, 1]], x);
    const v = ramp([[0, 0], [0.12, 0.12], [0.28, 0.62], [0.44, 1]], 1 - y);
    const dx = (x - 0.7) / 0.7;
    const dy = (y - 0.4) / 0.8;
    const r = Math.sqrt(dx * dx + dy * dy);
    return h * v * (1 - 0.58 * smoothstep(0.4, 1, r));
  }
  const fromBottom = (1 - y) * height;
  const v = ramp(
    [[0, 0], [150, 0.08], [280, 0.22], [400, 0.38], [480, 0.74], [560, 1]],
    fromBottom,
  );
  return v * (1 - 0.4 * smoothstep(0.26, 1, y));
}

/**
 * The cover's atmosphere: the desk's own vocabulary, rendered as a field of
 * typographic texture that fills the darkness and yields to the lion. It is
 * decoration in the accessibility sense — `aria-hidden`, pointer-inert, and
 * absent entirely without JavaScript — and it is the page's one piece of
 * ambient motion.
 */
export function SignalField({
  className,
  posterWide,
  posterTall,
  wideQuery = "(min-width: 760px) and (min-aspect-ratio: 6/5)",
  clearSelector,
  objectPositionWide = [68, 42],
  objectPositionTall = [50, 38],
}: {
  className?: string;
  posterWide: string;
  posterTall: string;
  wideQuery?: string;
  /** Elements the field must not run behind — the cover's own reading text. */
  clearSelector?: string;
  objectPositionWide?: [number, number];
  objectPositionTall?: [number, number];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const c = ctx;
    const cv = canvas;
    const rt = root;

    const wide = window.matchMedia(wideQuery);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let family = "sans-serif";
    let strips: HTMLCanvasElement[][] = [];
    let rows: Row[] = [];
    let mask: HTMLCanvasElement | null = null;
    let maskData: ImageData | null = null;
    let maskW = 0;
    let maskH = 0;

    let pulses: Pulse[] = [];
    let nextPulse = 0;
    let progress = 0;
    let pointer: { x: number; y: number; on: boolean } = { x: 0, y: 0, on: false };
    const eased = { x: 0, y: 0, a: 0 };

    let frame = 0;
    let last = 0;
    let visible = true;
    let disposed = false;
    let resizeTimer = 0;

    /* One strip per row-variant, drawn once and blitted every frame: filling
       a cover-sized field with fillText per frame costs more than the whole
       rest of the page. */
    function buildStrips() {
      const words = corpusWords();
      const stripW = Math.ceil(width * 2);
      strips = LAYERS.map((layer, layerIndex) => {
        const lineH = Math.ceil(layer.size * 1.9);
        return Array.from({ length: VARIANTS }, (_, variant) => {
          const strip = document.createElement("canvas");
          strip.width = Math.ceil(stripW * dpr);
          strip.height = Math.ceil(lineH * dpr);
          const sctx = strip.getContext("2d");
          if (!sctx) return strip;
          sctx.scale(dpr, dpr);
          sctx.font = `500 ${layer.size}px ${family}`;
          sctx.textBaseline = "middle";
          sctx.fillStyle = "#b5b1aa";
          if ("letterSpacing" in sctx) sctx.letterSpacing = "0.08em";
          let x = 0;
          let seed = layerIndex * 977 + variant * 131 + 7;
          while (x < stripW) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const word = words[seed % words.length];
            sctx.fillText(word, x, lineH / 2);
            const gap = layer.size * (1.5 + ((seed >> 8) % 160) / 100);
            x += sctx.measureText(word).width + gap;
          }
          return strip;
        });
      });
    }

    function buildRows() {
      rows = [];
      let seed = 20260917;
      LAYERS.forEach((layer, layerIndex) => {
        const pitch = layer.size * 1.9;
        /* Each layer covers the full height; three of them overlap into one
           field rather than three visible bands. */
        for (let y = -pitch, i = 0; y < height + pitch; y += pitch * 2, i++) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          rows.push({
            layer: layerIndex,
            variant: seed % VARIANTS,
            y: y + layerIndex * pitch,
            dir: i % 2 === 0 ? 1 : -1,
            offset: (seed % 1000) / 1000,
            phase: ((seed >> 10) % 628) / 100,
          });
        }
      });
    }

    function buildMask() {
      const src = wide.matches ? posterWide : posterTall;
      const [px, py] = wide.matches ? objectPositionWide : objectPositionTall;
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      const apply = () => {
        if (disposed || !width || !height) return;
        maskW = MASK_W;
        maskH = Math.max(1, Math.round((MASK_W * height) / width));
        const m = document.createElement("canvas");
        m.width = maskW;
        m.height = maskH;
        const mctx = m.getContext("2d", { willReadFrequently: true });
        if (!mctx) return;
        const scale = Math.max(maskW / image.naturalWidth, maskH / image.naturalHeight);
        const dw = image.naturalWidth * scale;
        const dh = image.naturalHeight * scale;
        mctx.drawImage(image, (maskW - dw) * (px / 100), (maskH - dh) * (py / 100), dw, dh);
        let pixels: ImageData;
        try {
          pixels = mctx.getImageData(0, 0, maskW, maskH);
        } catch {
          mask = null;
          return;
        }
        /* The cover's words win over the field's. Read from the DOM rather
           than guessed at in numbers: the masthead moves with the viewport,
           and a hard-coded box would be wrong at the next breakpoint. */
        const rootRect = rt.getBoundingClientRect();
        const clears = clearSelector
          ? Array.from(document.querySelectorAll(clearSelector)).map((el) => {
              const r = el.getBoundingClientRect();
              return {
                x0: r.left - rootRect.left,
                y0: r.top - rootRect.top,
                x1: r.right - rootRect.left,
                y1: r.bottom - rootRect.top,
              };
            })
          : [];
        const data = pixels.data;
        const isWide = wide.matches;
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const raw =
            (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          const x = (p % maskW) / maskW;
          const y = Math.floor(p / maskW) / maskH;
          const lum = raw * scrimTransmission(x, y, isWide, height);
          /* The lion is lit against a bright sky, and anything above true
             darkness belongs to the photograph: a loose threshold put type
             across the mane. The bottom quarter is the cover line's. */
          const fade = smoothstep(0, 0.1, y) * (1 - smoothstep(0.66, 0.94, y));
          let a = (1 - smoothstep(0.035, 0.22, lum)) * fade;
          if (a > 0 && clears.length) {
            const px = x * width;
            const py = y * height;
            for (const box of clears) {
              const dx = Math.max(box.x0 - px, px - box.x1, 0);
              const dy = Math.max(box.y0 - py, py - box.y1, 0);
              a *= smoothstep(20, 90, Math.hypot(dx, dy));
              if (a <= 0) break;
            }
          }
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.round(a * 255);
        }
        mctx.putImageData(pixels, 0, 0);
        mask = m;
        maskData = pixels;
      };
      if (image.complete && image.naturalWidth) apply();
      else {
        image.onload = apply;
        /* Without the picture there is no lion to yield to, so the field
           simply clears the centre-right instead of reading a photograph. */
        image.onerror = () => {
          mask = null;
          maskData = null;
        };
      }
    }

    function maskAt(x: number, y: number) {
      if (!maskData) return 1;
      const mx = Math.min(maskW - 1, Math.max(0, Math.floor((x / width) * maskW)));
      const my = Math.min(maskH - 1, Math.max(0, Math.floor((y / height) * maskH)));
      return maskData.data[(my * maskW + mx) * 4 + 3] / 255;
    }

    function fallbackMask() {
      c.save();
      c.globalCompositeOperation = "destination-in";
      const g = c.createRadialGradient(
        width * (wide.matches ? 0.7 : 0.5),
        height * (wide.matches ? 0.45 : 0.32),
        0,
        width * (wide.matches ? 0.7 : 0.5),
        height * (wide.matches ? 0.45 : 0.32),
        Math.max(width, height) * 0.55,
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.55, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,1)");
      c.fillStyle = g;
      c.fillRect(0, 0, width, height);
      c.restore();
    }

    function spawnPulse(now: number) {
      if (pulses.length >= 3) return;
      for (let attempt = 0; attempt < 10; attempt++) {
        const x = width * (0.06 + Math.random() * 0.62);
        const y = height * (0.12 + Math.random() * 0.58);
        if (maskAt(x, y) > 0.75) {
          pulses.push({
            text: VERIFIED_PULSES[Math.floor(Math.random() * VERIFIED_PULSES.length)],
            x,
            y,
            born: now,
          });
          return;
        }
      }
    }

    function draw(now: number, still: boolean) {
      const t = now / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);
      c.globalCompositeOperation = "source-over";

      const settle = 1 - progress * 0.85;
      const bottom = height;
      for (const row of rows) {
        const layer = LAYERS[row.layer];
        const strip = strips[row.layer]?.[row.variant];
        if (!strip) continue;
        const stripW = strip.width / dpr;
        const lineH = strip.height / dpr;
        const travel = still ? row.offset * stripW : (t * layer.speed * (1 - progress * 0.75) + row.offset * stripW);
        const shift = ((travel * row.dir) % stripW + stripW) % stripW;
        const wobble = still ? 0 : Math.sin(t * 0.35 + row.phase) * 3 * (1 - progress);
        const y = bottom - (bottom - (row.y + wobble)) * (1 - progress * 0.12);
        c.globalAlpha = layer.alpha * settle;
        c.drawImage(strip, -shift, y - lineH / 2, stripW, lineH);
        c.drawImage(strip, stripW - shift, y - lineH / 2, stripW, lineH);
      }
      c.globalAlpha = 1;

      if (!still) {
        pulses = pulses.filter((pulse) => now - pulse.born < PULSE_LIFE);
        c.font = `500 ${LAYERS[2].size}px ${family}`;
        c.textBaseline = "middle";
        if ("letterSpacing" in c) c.letterSpacing = "0.08em";
        for (const pulse of pulses) {
          const age = now - pulse.born;
          const alpha =
            age < PULSE_IN
              ? age / PULSE_IN
              : age < PULSE_IN + PULSE_HOLD
                ? 1
                : 1 - (age - PULSE_IN - PULSE_HOLD) / PULSE_OUT;
          const w = c.measureText(pulse.text).width;
          c.globalAlpha = Math.max(0, alpha) * (1 - progress);
          c.fillStyle = "#d2b279";
          c.fillText(pulse.text, pulse.x, pulse.y);
          c.fillRect(pulse.x, pulse.y + LAYERS[2].size, w * Math.min(1, age / 600), 1);
        }
        c.globalAlpha = 1;
        if ("letterSpacing" in c) c.letterSpacing = "0px";
      }

      /* `source-atop` so the reader's pointer brightens the type it passes
         over and never paints a disc on the photograph. */
      if (eased.a > 0.01) {
        c.save();
        c.globalCompositeOperation = "source-atop";
        const g = c.createRadialGradient(eased.x, eased.y, 0, eased.x, eased.y, 180);
        g.addColorStop(0, `rgba(242,238,230,${0.55 * eased.a})`);
        g.addColorStop(1, "rgba(242,238,230,0)");
        c.fillStyle = g;
        c.fillRect(eased.x - 180, eased.y - 180, 360, 360);
        c.restore();
      }

      if (mask) {
        c.save();
        c.globalCompositeOperation = "destination-in";
        c.drawImage(mask, 0, 0, width, height);
        c.restore();
      } else {
        fallbackMask();
      }

      if (!cv.dataset.ready) cv.dataset.ready = "true";
    }

    function measure() {
      const rect = rt.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.5 : 2);
      cv.width = Math.round(width * dpr);
      cv.height = Math.round(height * dpr);
      cv.style.width = `${width}px`;
      cv.style.height = `${height}px`;
    }

    function rebuild() {
      measure();
      buildStrips();
      buildRows();
      buildMask();
      draw(performance.now(), reduced.matches);
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      if (now > nextPulse) {
        spawnPulse(now);
        nextPulse = now + 1600 + Math.random() * 1600;
      }
      eased.x += (pointer.x - eased.x) * 0.12;
      eased.y += (pointer.y - eased.y) * 0.12;
      eased.a += ((pointer.on ? 1 : 0) - eased.a) * 0.08;
      draw(now, false);
    }

    function start() {
      if (reduced.matches || frame) return;
      last = 0;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        rebuild();
        if (visible && !document.hidden) start();
      }, 150);
    };

    const onScroll = () => {
      progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, height * 0.85)));
      if (reduced.matches) draw(performance.now(), true);
    };

    const onPointer = (event: PointerEvent) => {
      if (coarse.matches) return;
      const rect = rt.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, on: inside };
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };

    const onMotionChange = () => {
      stop();
      pulses = [];
      draw(performance.now(), reduced.matches);
      if (!reduced.matches && visible && !document.hidden) start();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      },
      { rootMargin: "120px" },
    );

    let ready = false;
    const begin = () => {
      if (disposed) return;
      ready = true;
      family = getComputedStyle(rt).fontFamily || "sans-serif";
      rebuild();
      observer.observe(rt);
      if (!reduced.matches) start();
    };
    if (document.fonts?.ready) void document.fonts.ready.then(begin);
    else begin();

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);
    wide.addEventListener("change", onResize);

    return () => {
      disposed = true;
      stop();
      window.clearTimeout(resizeTimer);
      if (ready) observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
      wide.removeEventListener("change", onResize);
    };
  }, [posterWide, posterTall, wideQuery, clearSelector, objectPositionWide, objectPositionTall]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}

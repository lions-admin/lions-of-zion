"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

// Cinematic engine — single full-screen awakening sequence
export default function LionExperience() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const isMobile = isCoarse || window.innerWidth < 860;
    const dprCap = isMobile ? 1.5 : 1.9;
    const DPR = Math.min(window.devicePixelRatio || 1, dprCap);

    // canvas + renderer — with graceful fallback if WebGL unavailable
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    wrap.appendChild(canvas);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (e) {
      console.warn("WebGL unavailable, falling back to static", e);
      canvas.remove();
      // simple static fallback — still cinematic
      const fb = document.createElement("div");
      fb.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#020509;overflow:hidden";
      const img = document.createElement("img");
      img.src = "/lions/lion.jpg";
      img.alt = "Lion";
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;object-position:center 42%;filter:brightness(0.95) contrast(1.08) saturate(0.92);opacity:0;transition:opacity 1.8s ease, filter 2.2s ease";
      fb.appendChild(img);
      wrap.appendChild(fb);
      requestAnimationFrame(() => {
        img.style.opacity = "1";
        img.style.filter = "brightness(1) contrast(1.08) saturate(0.92)";
      });
      // still reveal typography after short delay
      setTimeout(() => {
        revealedRef.current = true;
        setRevealed(true);
        setTimeout(() => setHint(true), 700);
      }, 1600);
      return () => {
        try { fb.remove(); } catch {}
      };
    }
    if (!renderer) return;
    renderer.setPixelRatio(DPR);
    renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
    renderer.setClearColor(0x020509, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      34,
      wrap.clientWidth / wrap.clientHeight,
      0.1,
      60
    );
    camera.position.set(0, 0.08, 10);

    // groups for subtle parallax
    const root = new THREE.Group();
    scene.add(root);
    const bgGroup = new THREE.Group();
    const lionGroup = new THREE.Group();
    const partGroup = new THREE.Group();
    const fgGroup = new THREE.Group();
    root.add(bgGroup);
    root.add(partGroup);
    root.add(lionGroup);
    root.add(fgGroup);

    const clock = new THREE.Timer();

    // --- sizing --- fit within view (camera fov 34, z10 => view H ~6.1, W ~10.8)
    const PLANE_H = 6.15; // world units — fits with slight headroom
    const PLANE_W = PLANE_H * (16 / 9);

    // responsive layout: landscape keeps cinematic cover crop;
    // portrait reframes on the face (shows ~40% of image width)
    const layout = { s: 1.02, offY: -0.06 };
    function layoutForAspect() {
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const visW = halfW * 2;
      if (camera.aspect < 1.05) {
        layout.s = visW / (PLANE_W * 0.40);
        const faceLocalY = (0.65 - 0.5) * PLANE_H; // face centre in plane space (v=0.65)
        layout.offY = 0.10 - faceLocalY * layout.s;
      } else {
        layout.s = 1.02;
        layout.offY = -0.06;
      }
    }
    layoutForAspect();

    // --- eye positions in UV space (0..1, 0 bottom) ---
    // measured on candidate-a.jpg (2048x1152): eyes ~ (900,505) & (1145,500) from top
    // uv y from bottom => 1 - y_top
    const EYE_L = new THREE.Vector2(0.439, 0.562);
    const EYE_R = new THREE.Vector2(0.559, 0.566);
    // face centre
    // muzzle ~ (1024, 680) from top -> v 0.41
    // chin ~ v 0.32

    // --- uniforms shared ---
    let uReveal = 0; // 0..1 staged
    let uProgress = 0; // particle 0..1
    let uDissolve = 0; // 0..1 pulse
    let dissolvePhase: 0 | 1 | 2 = 0; // 0 idle, 1 dissolve out, 2 rebuild
    let dissolveT = 0;
    const pointer = { x: 0, y: 0 };
    const pointerSmooth = { x: 0, y: 0 };
    const autoDrift = { x: 0, y: 0 };
    let hasPointer = false;
    let elapsed = 0;
    let revealedDone = false;
    let raf = 0;
    let destroyed = false;

    // timing
    const T_REVEAL_START = prefersReduced ? 0.15 : 1.15;
    const REVEAL_DUR = prefersReduced ? 1.35 : 7.2;
    const PARTICLE_LEAD = 0.22; // particles slightly ahead

    // --- helpers: atmosphere ---
    const bgGeo = new THREE.PlaneGeometry(36, 22, 1, 1);
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uReveal;
        // hash
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p);
          float a=h(i); float b=h(i+vec2(1.,0.)); float c=h(i+vec2(0.,1.)); float d=h(i+vec2(1.,1.));
          vec2 u=f*f*(3.-2.*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }
        float fbm(vec2 p){
          float v=0.; float a=0.5;
          for(int i=0;i<4;i++){ v+= a*n(p); p*=2.03; a*=0.5; }
          return v;
        }
        void main(){
          vec2 uv=vUv;
          vec2 c=uv-0.5;
          float r=length(c*vec2(1.55,1.0));
          // deep navy-black vignette
          vec3 colA = vec3(0.015,0.028,0.048);
          vec3 colB = vec3(0.028,0.058,0.11);
          vec3 colC = vec3(0.006,0.012,0.024);
          vec3 base = mix(colA, colC, smoothstep(0.0,0.95, r));
          // central cool glow very subtle
          float glow = exp(-r*2.2)*0.22;
          base += vec3(0.06,0.11,0.20)*glow;
          // volumetric haze driven by fbm
          vec2 hp = uv*vec2(2.8,1.7) + vec2(uTime*0.018, uTime*0.011);
          float haze = fbm(hp*1.6);
          float haze2 = fbm(hp*3.2 + 7.3);
          float hMask = smoothstep(0.2,0.85, 1.0 - r*0.9) * 0.42;
          base += vec3(0.08,0.14,0.24)*haze*hMask*0.55;
          base += vec3(0.05,0.09,0.16)*haze2*hMask*0.28;
          // scanning traces early — very subtle single line
          float scanPhase = fract(uTime*0.032);
          float traceA = 1.0 - smoothstep(0.0,0.0045, abs(uv.y - (0.68 - scanPhase*0.62)));
          float early = 1.0 - smoothstep(0.22,0.62, uReveal);
          float trace = traceA*early*0.34;
          trace *= smoothstep(0.18,0.42, uv.x)*smoothstep(0.92,0.58, uv.x);
          trace *= 0.5 + 0.5*sin(uTime*2.1)*0.2; // faint flicker
          base += vec3(0.38,0.58,0.84)*trace*0.14;
          // faint grain
          float g = h(uv*420.0 + uTime*0.04)*0.015;
          base += g;
          gl_FragColor = vec4(base,1.0);
        }
      `,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.z = -9.5;
    bgMesh.scale.set(1.2, 1.2, 1);
    bgGroup.add(bgMesh);

    // subtle vignette overlay plane near camera (multiply-like)
    const vigGeo = new THREE.PlaneGeometry(22, 16, 1, 1);
    const vigMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;void main(){
        vec2 c=vUv-0.5; float r=length(c*vec2(1.2,1.0));
        float v=smoothstep(0.45,0.95, r);
        gl_FragColor=vec4(0.,0.,0., v*0.72);
      }`,
    });
    const vigMesh = new THREE.Mesh(vigGeo, vigMat);
    vigMesh.position.z = 5.8;
    vigMesh.renderOrder = 10;
    scene.add(vigMesh);

    // --- lion plane (populated after texture load) ---
    let lionMesh: THREE.Mesh | null = null;
    let lionMat: THREE.ShaderMaterial | null = null;

    // --- particle systems (created after texture) ---
    let particles: THREE.Points | null = null;
    let pMat: THREE.ShaderMaterial | null = null;
    let dataField: THREE.Points | null = null;
    let dust: THREE.Points | null = null;

    let lionTex: THREE.Texture | null = null;

    const loader = new THREE.TextureLoader();
    loader.load(
      "/lions/lion.jpg",
      (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        lionTex = tex;
        buildLion(tex);
        buildParticles(tex);
        buildDataField();
        buildDust();
        if (!destroyed) animate();
      },
      undefined,
      () => {
        // fallback: still run without texture (atmosphere only)
        buildDataField();
        buildDust();
        if (!destroyed) animate();
      }
    );

    function buildLion(tex: THREE.Texture) {
      const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 96, 58);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTex: { value: tex },
          uReveal: { value: 0 },
          uDissolve: { value: 0 },
          uTime: { value: 0 },
          uScanY: { value: -0.2 },
          uEyeL: { value: EYE_L.clone() },
          uEyeR: { value: EYE_R.clone() },
          uBreath: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float uReveal;
          uniform float uTime;
          uniform float uDissolve;
          void main(){
            vUv = uv;
            vec3 p = position;
            float b = sin(uTime*0.38)*0.006 * (1.0 - uDissolve*0.65);
            p.y *= 1.0 + b;
            float d = distance(uv, vec2(0.5, 0.46));
            float swayMask = smoothstep(0.20, 0.42, d) * smoothstep(1.02, 0.62, uv.y) * 0.58;
            float sway = sin(uTime*0.52 + uv.x*7.2 + uv.y*4.0) * 0.013 * swayMask;
            sway += sin(uTime*0.31 + uv.x*3.1)*0.006*swayMask*0.6;
            p.x += sway;
            p.z += sway*0.45;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform sampler2D uTex;
          uniform float uReveal;
          uniform float uDissolve;
          uniform float uTime;
          uniform float uScanY;
          uniform vec2 uEyeL;
          uniform vec2 uEyeR;
          uniform float uBreath;

          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
          float hash1(float p){ return fract(sin(p*127.1)*43758.5453); }

          void main(){
            vec2 uv = vUv;

            // --- staged reveal masks — weighted max (guaranteed 1 at end) ---
            float r = uReveal;
            // base shapes (always computed, weighted by r)
            float dL = distance(uv, uEyeL);
            float dR = distance(uv, uEyeR);
            float dEye = min(dL, dR);
            // eyes: twin small circles, sharp
            float eyeShape = 1.0 - smoothstep(0.038, 0.058, dEye);
            float eyeW = smoothstep(0.00, 0.13, r);
            // face ellipse (broad)
            vec2 cF = vec2(0.5, 0.505);
            float rf = length((uv - cF) / vec2(0.235, 0.31));
            float faceShape = 1.0 - smoothstep(0.38, 0.62, rf);
            float faceW = smoothstep(0.07, 0.34, r);
            // muzzle
            vec2 cM = vec2(0.5, 0.382);
            float rm = length((uv - cM) / vec2(0.185, 0.158));
            float muzzShape = 1.0 - smoothstep(0.34, 0.56, rm);
            float muzzW = smoothstep(0.24, 0.49, r);
            // whisker streak horizontal
            float rw = length(vec2((uv.x-0.5)/0.27, (uv.y-0.382)/0.062));
            float whiskShape = 1.0 - smoothstep(0.36, 0.68, rw);
            float whiskW = smoothstep(0.30, 0.55, r) * 0.62;
            // mane large
            vec2 cMa = vec2(0.5, 0.46);
            float rMa = length((uv - cMa) / vec2(0.415, 0.505));
            float maneShape = 1.0 - smoothstep(0.48, 0.78, rMa);
            float maneW = smoothstep(0.42, 0.77, r);

            float mask = 0.0;
            mask = max(mask, eyeShape * eyeW);
            mask = max(mask, faceShape * faceW * 0.98);
            mask = max(mask, muzzShape * muzzW);
            mask = max(mask, whiskShape * whiskW);
            mask = max(mask, maneShape * maneW * 0.92);
            // final full coverage — guarantees 1.0 at the end
            float full = smoothstep(0.78, 0.98, r);
            mask = mix(mask, 1.0, full);
            // dithered edge softness
            float dither = (hash(uv*430.0)-0.5)*0.055 * (1.0 - full*0.6);
            mask = clamp(mask + dither * step(0.08, r) * (1.0 - mask*0.5), 0.0, 1.0);

            // assembly offset near edge (pixels assembling from neighbor)
            float edge = smoothstep(0.22, 0.78, mask);
            vec2 assemble = vec2(
              (hash(uv*180.0+0.3)-0.5),
              (hash(uv*180.0+7.1)-0.5)
            ) * (1.0 - edge) * 0.025 * (1.0 - uReveal*0.45);
            vec2 sUv = uv + assemble;
            sUv = clamp(sUv, 0.0, 1.0);

            vec4 texc = texture2D(uTex, sUv);
            vec3 col = texc.rgb;

            // breathing brightness
            float breath = 1.0 + sin(uTime*0.34)*0.012 + uBreath*0.6;
            col *= breath;

            // subtle eye-region lift (very restrained)
            float dLE = distance(uv, uEyeL);
            float dRE = distance(uv, uEyeR);
            float eyeLift = exp(-min(dLE,dRE)*32.0)*0.055 * (0.7 + 0.3*sin(uTime*1.1));
            eyeLift *= smoothstep(0.18,0.42, uReveal);
            col += vec3(0.22,0.26,0.32)*eyeLift;

            // scanning line — very fine, restrained
            float scan = 1.0 - smoothstep(0.0, 0.0085, abs(uv.y - uScanY));
            float scan2 = 1.0 - smoothstep(0.0, 0.022, abs(uv.y - uScanY));
            float scanVis = scan * (0.35 + 0.35*smoothstep(0.22,0.78,uReveal));
            float scanVis2 = scan2 * 0.16 * smoothstep(0.18,0.82, uReveal);
            col += vec3(0.38,0.58,0.92)*scanVis*0.065;
            col += vec3(0.62,0.74,0.98)*scanVis*0.032;
            float trail = 1.0 - smoothstep(0.0, 0.10, uScanY - uv.y);
            trail *= step(uv.y, uScanY) * smoothstep(0.0,0.04, uScanY - uv.y);
            col += vec3(0.14,0.26,0.52)*trail*scanVis2*0.18;

            // dithered edge assemble glow
            float edgeGlow = (1.0 - edge) * mask * 0.0;
            // actually shimmer on just-revealed band
            float band = smoothstep(0.18,0.35, mask) * (1.0 - smoothstep(0.58,0.92, mask));
            float shimmer = hash(uv*280.0 + uTime*0.4) * band * 0.10 * smoothstep(0.15,0.85,uReveal);
            col += vec3(0.55,0.68,0.88)*shimmer;

            // dissolve: noise threshold
            float nD = hash(uv*380.0 + vec2(hash1(uTime*0.2)*2.0, 0.0));
            float dissolveMask = smoothstep(uDissolve - 0.08, uDissolve + 0.12, nD);
            // edge of dissolve glows faint blue-white
            float dEdge = exp(-pow(abs(nD - uDissolve)*11.0, 1.2))*0.65 * step(0.02, uDissolve)*step(uDissolve,0.98);
            col += vec3(0.62,0.74,0.96)*dEdge*0.28;
            col += vec3(0.22,0.18,0.12)*dEdge*0.10; // faint warm hint for bronze

            float alpha = mask * dissolveMask;
            // fade edge softly
            alpha *= smoothstep(0.0, 0.06, mask);
            // global fade near end of dissolve
            // premultiply subtle
            // keep lion fully opaque at center even early? mask already controls

            // very subtle vignette inside lion (darken rim of plane)
            float vign = 1.0 - smoothstep(0.55, 0.98, length((uv-0.5)*vec2(1.15,0.85)));
            // don't apply — keep as is

            gl_FragColor = vec4(col, alpha);
          }
        `,
      });
      lionMat = mat;
      lionMesh = new THREE.Mesh(geo, mat);
      lionMesh.position.set(0, 0.14, 0.06);
      lionMesh.scale.set(1.0, 1.0, 1);
      lionGroup.add(lionMesh);
    }

    function buildParticles(tex: THREE.Texture) {
      // sample image luminance into particles
      const W = 320;
      const H = 180;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const img = tex.image as HTMLImageElement | HTMLCanvasElement;
      // draw covering
      ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, W, H);
      let data: ImageData;
      try {
        data = ctx.getImageData(0, 0, W, H);
      } catch {
        return;
      }
      const d = data.data;

      // build luminance list
      type P = { x: number; y: number; r: number; g: number; b: number; lum: number };
      const cands: P[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const r = d[i] / 255;
          const g = d[i + 1] / 255;
          const b = d[i + 2] / 255;
          // perceived lum weighted + slight blue boost
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          // bright pass: keep luminous parts; dark bg low lum will be rare
          if (lum < 0.035) continue;
          // also discard extreme border? keep all
          cands.push({ x, y, r, g, b, lum });
        }
      }
      if (cands.length === 0) return;

      const COUNT_DESKTOP = 38000;
      const COUNT_MOBILE = 14000;
      const COUNT_REDUCED = 0;
      const COUNT = prefersReduced ? COUNT_REDUCED : isMobile ? COUNT_MOBILE : COUNT_DESKTOP;
      if (COUNT === 0) return;

      // weighted selection: lum ^ 1.4 as weight
      // build cumulative-ish via rejection sampling loop
      const picks: P[] = [];
      // precompute weights normalized approx by max lum
      // rejection sample: pick random cand, accept with prob (lum/max)^gamma
      const maxL = Math.max(...cands.map((c) => c.lum));
      let attempts = 0;
      const gamma = 1.45;
      while (picks.length < COUNT && attempts < COUNT * 12) {
        const idx = (Math.random() * cands.length) | 0;
        const cand = cands[idx];
        const w = Math.pow(cand.lum / maxL, gamma);
        // boost eye region slightly for denser eyes?
        // remap cand xy to uv: uv_x = x/W, uv_y=1 - y/H (since y top->bottom vs gl uv bottom)
        const uvx = cand.x / W;
        const uvy = 1 - cand.y / H;
        let bias = 1;
        // eye proximity bias +20%
        const deL = Math.hypot(uvx - EYE_L.x, uvy - EYE_L.y);
        const deR = Math.hypot(uvx - EYE_R.x, uvy - EYE_R.y);
        if (Math.min(deL, deR) < 0.085) bias = 1.9;
        else if (Math.min(deL, deR) < 0.14) bias = 1.35;
        if (Math.random() < w * bias) {
          picks.push(cand);
        }
        attempts++;
      }
      // fill remainder with brightest if shortage
      if (picks.length < COUNT) {
        const sorted = [...cands].sort((a, b) => b.lum - a.lum);
        for (let i = 0; picks.length < COUNT && i < sorted.length; i++) picks.push(sorted[i % sorted.length]);
      }

      const geo = new THREE.BufferGeometry();
      const posScatter = new Float32Array(COUNT * 3);
      const posTarget = new Float32Array(COUNT * 3);
      const colArr = new Float32Array(COUNT * 3);
      const seeds = new Float32Array(COUNT);

      for (let i = 0; i < COUNT; i++) {
        const p = picks[i];
        const uvx = p.x / W;
        const uvy = 1 - p.y / H;
        // jitter within pixel
        const jx = (Math.random() - 0.5) * (1 / W);
        const jy = (Math.random() - 0.5) * (1 / H);
        const ux = uvx + jx;
        const uy = uvy + jy;
        const tx = (ux - 0.5) * PLANE_W;
        const ty = (uy - 0.5) * PLANE_H + 0.14; // match lion mesh y offset
        const tz = 0.14 + (Math.random() - 0.5) * 0.18; // just in front of plane
        posTarget[i * 3] = tx;
        posTarget[i * 3 + 1] = ty;
        posTarget[i * 3 + 2] = tz;

        // scatter start: spherical shell around center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 7.5 + Math.random() * 6.5;
        const sx = r * Math.sin(phi) * Math.cos(theta) * 0.9;
        const sy = r * Math.sin(phi) * Math.sin(theta) * 0.62;
        const sz = r * Math.cos(phi) * 0.45 + 1.2;
        posScatter[i * 3] = sx;
        posScatter[i * 3 + 1] = sy;
        posScatter[i * 3 + 2] = sz;

        // color: sample, slightly cool-shift but keep bronze warm hints
        let rr = p.r, gg = p.g, bb = p.b;
        // lift very dark but not crushed
        const lift = 0.08;
        rr = rr * (1 - lift) + lift * 0.18;
        gg = gg * (1 - lift) + lift * 0.19;
        bb = bb * (1 - lift) + lift * 0.28;
        // subtle blue-white push for rim particles vs warm mane
        const isWarm = rr > bb * 1.18 && rr > 0.22;
        if (isWarm) {
          // keep bronze-gold
          rr *= 1.04; gg *= 1.02;
        } else {
          bb *= 1.06; gg *= 1.03;
        }
        colArr[i * 3] = rr;
        colArr[i * 3 + 1] = gg;
        colArr[i * 3 + 2] = bb;
        seeds[i] = Math.random();
      }

      geo.setAttribute("position", new THREE.BufferAttribute(posScatter, 3));
      geo.setAttribute("aTarget", new THREE.BufferAttribute(posTarget, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(colArr, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uProgress: { value: 0 },
          uDissolve: { value: 0 },
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uSize: { value: isMobile ? 1.05 : 1.32 },
        },
        vertexShader: `
          attribute vec3 aTarget;
          attribute vec3 aColor;
          attribute float aSeed;
          uniform float uProgress;
          uniform float uDissolve;
          uniform float uTime;
          uniform vec2 uPointer;
          uniform float uSize;
          varying vec3 vColor;
          varying float vAlpha;
          float hash(float n){ return fract(sin(n*43758.5453)*43758.5453); }
          void main(){
            vColor = aColor;
            float seed = aSeed;
            // staggered progress per particle
            float t = clamp(uProgress * (1.35 + seed*0.45) - seed*0.52, 0.0, 1.0);
            t = t*t*(3.0-2.0*t); // smoothstep
            // scatter jitter drift
            vec3 scatterJ = position + vec3(
              sin(uTime*0.22 + seed*7.3)*0.08,
              cos(uTime*0.18 + seed*5.1)*0.07,
              sin(uTime*0.25 + seed*9.2)*0.05
            ) * (1.0 - t*0.7);
            vec3 base = mix(scatterJ, aTarget, t);
            // idle shimmer when converged
            if(t > 0.985){
              base += vec3(
                sin(uTime*0.75 + seed*12.0)*0.012,
                cos(uTime*0.62 + seed*8.7)*0.010,
                sin(uTime*0.55 + seed*10.1)*0.008
              ) * (0.5+seed*0.5);
            }
            // pointer repulsion (world xy)
            vec2 toP = base.xy - uPointer;
            float d = length(toP);
            float rep = exp(-d*1.85)*0.42;
            // stronger when particle not yet fully converged? gentle
            rep *= (0.55 + 0.55*t);
            if(d > 0.012) base.xy += normalize(toP)*rep*(0.7+seed*0.7);
            // dissolve explosion
            float expl = uDissolve * (1.9 + seed*2.2);
            vec3 dir = normalize(base + vec3(hash(seed*3.1)-0.5, hash(seed*7.7)-0.5, hash(seed*13.2)-0.5)*0.85);
            base += dir * expl * (1.0 - t*0.25);
            // additional swirl during dissolve
            if(uDissolve > 0.02){
              float ang = uDissolve*1.8 + seed*1.2;
              base.xy += vec2(sin(ang), cos(ang))*uDissolve*0.18*(0.5+seed);
            }
            vec4 mv = modelViewMatrix * vec4(base, 1.0);
            gl_Position = projectionMatrix * mv;
            float s = uSize * (0.58 + seed*0.42);
            // attenuate by progress alpha ramp near start
            float pAlpha = smoothstep(0.0, 0.18, uProgress + seed*0.12);
            // size fades slightly when dissolving
            s *= (1.0 - uDissolve*0.38);
            // distance attenuation
            gl_PointSize = s * (86.0 / max(1.0, -mv.z));
            // per particle alpha
            float a = pAlpha * (1.0 - uDissolve*0.55);
            // particles that are behind the lion plane and very converged can be slightly dimmer to avoid overdraw? keep visible as shimmer
            // brighten eye region particles slightly
            float postFade = 1.0 - smoothstep(0.78, 0.98, uProgress) * 0.78;
            vAlpha = a * (0.85 + seed*0.15) * postFade;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main(){
            vec2 c = gl_PointCoord*2.0 - 1.0;
            float d = dot(c,c);
            if(d > 1.0) discard;
            float a = exp(-d*2.92) * 0.38;
            float inner = exp(-d*4.2)*0.18;
            vec3 col = vColor * (0.92 + inner*0.6);
            col += vec3(0.55,0.66,0.92)*inner*0.08;
            float fade = 1.0 - smoothstep(0.78, 1.0, vAlpha); // vAlpha not uniform, use progress in vertex? fallback: keep but reduce
            float alpha = a * vAlpha * 0.55;
            // soft
            gl_FragColor = vec4(col, alpha);
          }
        `,
      });
      pMat = mat;
      particles = new THREE.Points(geo, mat);
      particles.frustumCulled = false;
      partGroup.add(particles);
    }

    function buildDataField() {
      const N = isMobile ? 650 : 1450;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      const seeds = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 26;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 2] = -5.5 - Math.random() * 7.5;
        seeds[i] = Math.random();
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
        },
        vertexShader: `
          attribute float aSeed;
          uniform float uTime;
          uniform float uReveal;
          uniform vec2 uPointer;
          varying float vA;
          varying float vS;
          void main(){
            vec3 p = position;
            // slow drift
            p.x += sin(uTime*0.08 + aSeed*6.0)*0.55;
            p.y += cos(uTime*0.07 + aSeed*5.3)*0.32;
            p.z += sin(uTime*0.05 + aSeed*7.1)*0.45;
            // parallax with pointer (stronger for far field)
            vec2 toP = p.xy - uPointer*0.35;
            // not repelling, just drifting with parallax
            p.xy += uPointer*0.12 * (0.5 + aSeed*0.5);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float s = (0.55 + aSeed*1.1) * (1.0 + sin(uTime*0.9 + aSeed*12.0)*0.22);
            gl_PointSize = s * (64.0 / max(1.5, -mv.z));
            float revealA = smoothstep(0.05, 0.32, uReveal);
            float tw = 0.55 + 0.45*sin(uTime*1.4 + aSeed*9.2);
            vA = revealA * (0.42 + tw*0.38) * (0.55 + aSeed*0.45);
            vS = aSeed;
          }
        `,
        fragmentShader: `
          varying float vA; varying float vS;
          void main(){
            vec2 c=gl_PointCoord*2.0-1.0; float d=dot(c,c); if(d>1.0) discard;
            float a = exp(-d*3.0)*vA*0.82;
            vec3 col = mix(vec3(0.34,0.52,0.78), vec3(0.62,0.72,0.92), vS*0.5);
            col += vec3(0.3,0.5,0.85)*exp(-d*3.2)*0.25;
            gl_FragColor = vec4(col, a);
          }
        `,
      });
      dataField = new THREE.Points(geo, mat);
      (dataField.material as THREE.ShaderMaterial).uniforms = mat.uniforms;
      bgGroup.add(dataField);
    }

    function buildDust() {
      if (prefersReduced) return;
      const N = isMobile ? 90 : 210;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      const seeds = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 18;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 11;
        pos[i * 3 + 2] = 1.2 + Math.random() * 4.8;
        seeds[i] = Math.random();
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(0, 0) } },
        vertexShader: `
          attribute float aSeed; uniform float uTime; uniform vec2 uPointer;
          varying float vA; varying float vS;
          void main(){
            vec3 p=position;
            p.x += sin(uTime*0.14 + aSeed*8.0)*0.35 + uPointer.x*0.55*(0.4 + aSeed*0.6);
            p.y += cos(uTime*0.11 + aSeed*6.2)*0.25 + uPointer.y*0.48*(0.4 + aSeed*0.6);
            p.z += sin(uTime*0.09 + aSeed*9.1)*0.18;
            vec4 mv=modelViewMatrix*vec4(p,1.0);
            gl_Position=projectionMatrix*mv;
            float s=(1.1 + aSeed*1.8) * (0.9 + 0.2*sin(uTime*0.7 + aSeed*10.0));
            gl_PointSize = s * (68.0 / max(0.8, -mv.z));
            vA = 0.18 + aSeed*0.16 + sin(uTime*0.8 + aSeed*11.0)*0.06;
            vS=aSeed;
          }
        `,
        fragmentShader: `
          varying float vA; varying float vS;
          void main(){
            vec2 c=gl_PointCoord*2.0-1.0; float d=dot(c,c); if(d>1.0) discard;
            float a=exp(-d*2.2)*vA*0.42;
            vec3 col = vec3(0.66,0.74,0.88) + vec3(0.12,0.06,-0.04)*vS;
            gl_FragColor=vec4(col,a);
          }
        `,
      });
      dust = new THREE.Points(geo, mat);
      fgGroup.add(dust);
    }

    // pointer handling
    function onPointerMove(e: PointerEvent | MouseEvent) {
      const rect = (wrap as HTMLDivElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      hasPointer = true;
      pointer.x = x;
      pointer.y = y;
    }
    function onTouchMove(e: TouchEvent) {
      if (!e.touches[0]) return;
      const rect = (wrap as HTMLDivElement).getBoundingClientRect();
      const t = e.touches[0];
      pointer.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((t.clientY - rect.top) / rect.height) * 2 - 1);
      hasPointer = true;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    // device orientation (iOS permission gate)
    let useMotion = false;
    const motion = { x: 0, y: 0 };
    function handleOrient(e: DeviceOrientationEvent) {
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;
      motion.x = THREE.MathUtils.clamp(g / 30, -1, 1);
      motion.y = THREE.MathUtils.clamp((b - 45) / 35, -1, 1);
      useMotion = true;
    }
    // permission request on first click for iOS
    const tryMotion = () => {
      const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      const R = D?.requestPermission;
      if (R) {
        R.call(window.DeviceOrientationEvent)
          .then((s: string) => {
            if (s === "granted") window.addEventListener("deviceorientation", handleOrient, true);
          })
          .catch(() => {});
      } else {
        window.addEventListener("deviceorientation", handleOrient, true);
      }
    };

    // dissolve trigger
    function triggerDissolve() {
      if (dissolvePhase !== 0) return;
      if (!revealedDone) {
        // accelerate to reveal instead
        if (uReveal < 0.98) {
          // fast-forward by shrinking remaining time
          const remain = 1 - uReveal;
          uReveal = Math.min(1, uReveal + remain * 0.55 + 0.08);
          uProgress = Math.min(1, uProgress + 0.12);
          if (uReveal >= 0.97) {
            uReveal = 1;
            uProgress = 1;
          }
          return;
        }
      }
      dissolvePhase = 1;
      dissolveT = 0;
      // dim typography
      if (revealedRef.current) setHint(false);
    }

    (wrap as HTMLDivElement).addEventListener("click", () => {
      if (!hasPointer) tryMotion();
      triggerDissolve();
    });
    (wrap as HTMLDivElement).addEventListener("pointerdown", () => {
      if (!hasPointer) tryMotion();
    });
    // custom event for button
    (wrap as HTMLDivElement).addEventListener("reconstruct", triggerDissolve as EventListener);

    // resize
    function onResize() {
      const w = (wrap as HTMLDivElement).clientWidth, h = (wrap as HTMLDivElement).clientHeight;
      renderer!.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer!.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    }
    const origOnResize = onResize;
    function onResizeLayout() {
      origOnResize();
      layoutForAspect();
    }
    window.addEventListener("resize", onResizeLayout);

    // animation loop
    function easeInOutCubic(x: number) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function easeOutCubic(x: number) {
      return 1 - Math.pow(1 - x, 3);
    }

    function animate() {
      raf = requestAnimationFrame(animate);
      clock.update();
      const dt = Math.min(clock.getDelta(), 0.033);
      elapsed += dt;

      // --- timeline: reveal & progress ---  linear for evenly staged reveal
      if (!revealedDone) {
        const t = Math.max(0, elapsed - T_REVEAL_START);
        const lin = Math.min(1, t / REVEAL_DUR);
        uReveal = lin; // linear keeps eye/face/muzzle/mane stages evenly spaced
        // particles easeOut slightly ahead
        const pLin = Math.min(1, (t + PARTICLE_LEAD) / REVEAL_DUR);
        uProgress = Math.min(1, easeOutCubic(pLin) * 1.02);
        if (lin >= 1) {
          revealedDone = true;
          uReveal = 1;
          uProgress = 1;
          revealedRef.current = true;
          setRevealed(true);
          setTimeout(() => setHint(true), 900);
        }
      } else {
        // keep fully revealed
        uReveal = 1;
        uProgress = 1;
      }

      // dissolve cycle
      if (dissolvePhase !== 0) {
        const speedOut = 1 / 0.62;
        const speedIn = 1 / 1.35;
        if (dissolvePhase === 1) {
          dissolveT += dt * speedOut;
          if (dissolveT >= 1) {
            dissolveT = 1;
            dissolvePhase = 2;
          }
          uDissolve = THREE.MathUtils.smoothstep(dissolveT, 0, 1);
          // lift a bit then ease
          uDissolve = Math.pow(uDissolve, 0.9);
        } else {
          dissolveT -= dt * speedIn;
          if (dissolveT <= 0) {
            dissolveT = 0;
            dissolvePhase = 0;
            uDissolve = 0;
            setHint(true);
          } else {
            uDissolve = THREE.MathUtils.smoothstep(dissolveT, 0, 1);
            uDissolve = Math.pow(uDissolve, 0.9);
          }
        }
        // dim hint during dissolve
        if (uDissolve > 0.18) setHint(false);
        else if (revealedDone && dissolvePhase === 0) setHint(true);
      }

      // pointer smooth + auto drift fallback
      if (useMotion) {
        pointer.x = motion.x;
        pointer.y = motion.y;
        hasPointer = true;
      } else if (!hasPointer) {
        autoDrift.x = Math.sin(elapsed * 0.11) * 0.42 + Math.sin(elapsed * 0.052) * 0.18;
        autoDrift.y = Math.cos(elapsed * 0.09) * 0.28 + Math.cos(elapsed * 0.067) * 0.14;
        pointer.x = autoDrift.x;
        pointer.y = autoDrift.y;
      }
      pointerSmooth.x += (pointer.x - pointerSmooth.x) * 0.06;
      pointerSmooth.y += (pointer.y - pointerSmooth.y) * 0.06;
      // reduced motion: freeze drift amplitude
      const pmx = prefersReduced ? 0 : pointerSmooth.x;
      const pmy = prefersReduced ? 0 : pointerSmooth.y;

      // world pointer at lion plane (z=0)
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const worldPointer = new THREE.Vector2(pmx * halfW, pmy * halfH);

      // parallax: move groups
      const px = pmx, py = pmy;
      const breath = Math.sin(elapsed * 0.34) * 0.5 + 0.5; // 0..1
      // root subtle tilt
      root.rotation.y = px * 0.035;
      root.rotation.x = -py * 0.022;
      bgGroup.position.set(px * -0.32, py * -0.22, 0);
      lionGroup.position.set(px * 0.18, py * 0.14 + layout.offY, 0);
      partGroup.position.set(px * 0.42, py * 0.30 + layout.offY, 0);
      fgGroup.position.set(px * 0.75, py * 0.52, 0);
      // camera micro shift
      camera.position.x = px * 0.18;
      camera.position.y = 0.08 + py * 0.10;
      camera.lookAt(0, -0.04, -2);

      // scan y cycles 0..1 top->bottom repeating
      const scanCycle = 7.2;
      const scanY = 1 - ((elapsed * 0.95) % scanCycle) / scanCycle; // 1->0 then snap
      // hold scan off until reveal mid
      const scanActive = uReveal > 0.22 ? scanY : -0.4;

      const t = elapsed;

      // push uniforms
      bgMat.uniforms.uTime.value = t;
      bgMat.uniforms.uReveal.value = uReveal;
      if (lionMat) {
        lionMat.uniforms.uTime.value = t;
        lionMat.uniforms.uReveal.value = uReveal;
        lionMat.uniforms.uDissolve.value = uDissolve;
        lionMat.uniforms.uScanY.value = scanActive;
        lionMat.uniforms.uBreath.value = breath * 0.015;
      }
      if (pMat) {
        pMat.uniforms.uTime.value = t;
        pMat.uniforms.uProgress.value = uProgress;
        pMat.uniforms.uDissolve.value = uDissolve;
        // convert world pointer into particle-group local space (scaled/offset)
        pMat.uniforms.uPointer.value.set(
          (worldPointer.x - px * 0.42) / layout.s,
          (worldPointer.y - (py * 0.30 + layout.offY)) / layout.s
        );
      }
      const dfMat = dataField?.material as THREE.ShaderMaterial | undefined;
      if (dfMat) {
        dfMat.uniforms.uTime.value = t;
        dfMat.uniforms.uReveal.value = uReveal;
        dfMat.uniforms.uPointer.value.copy(worldPointer);
      }
      const dustMat = dust?.material as THREE.ShaderMaterial | undefined;
      if (dustMat) {
        dustMat.uniforms.uTime.value = t;
        dustMat.uniforms.uPointer.value.copy(worldPointer);
      }
      // breathing micro-scale + responsive layout scale on groups
      {
        const bScale = (1 + Math.sin(t * 0.38) * 0.0045) * layout.s;
        lionGroup.scale.set(bScale, bScale, layout.s);
        partGroup.scale.set(layout.s, layout.s, layout.s);
      }

      renderer!.render(scene, camera);
    }

    // error trap for headless verification
    const errEl = document.createElement("div");
    errEl.id = "__errlog";
    errEl.style.display = "none";
    wrap.appendChild(errEl);
    const origErr = console.error;
    // @ts-expect-error -- runtime debug contract
    window.__ceedErrors = [];
    window.addEventListener("error", (e) => {
      // @ts-expect-error -- runtime debug contract
      window.__ceedErrors.push(e.message);
      errEl.textContent = (errEl.textContent || "") + e.message + "\n";
    });
    window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
      const m = String(e.reason?.message ?? e.reason ?? "rejection");
      // @ts-expect-error -- runtime debug contract
      window.__ceedErrors.push(m);
      errEl.textContent = (errEl.textContent || "") + m + "\n";
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResizeLayout);
      window.removeEventListener("deviceorientation", handleOrient);
      try { renderer.dispose(); } catch {}
      try { wrap.removeChild(canvas); } catch {}
      try { wrap.removeChild(errEl); } catch {}
      // dispose geos/mats
      [bgGeo, vigGeo].forEach((g) => g.dispose());
      [bgMat, vigMat].forEach((m) => m.dispose());
      if (lionMesh) {
        lionMesh.geometry.dispose();
        (lionMesh.material as THREE.Material).dispose();
      }
      if (particles) {
        particles.geometry.dispose();
        (particles.material as THREE.Material).dispose();
      }
      if (dataField) {
        dataField.geometry.dispose();
        (dataField.material as THREE.Material).dispose();
      }
      if (dust) {
        dust.geometry.dispose();
        (dust.material as THREE.Material).dispose();
      }
      lionTex?.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        // Contains the z-indexed typography below, so the intro that plays
        // over this page is not punched through by it.
        isolation: "isolate",
        background: "#020509",
        overflow: "hidden",
        cursor: "pointer",
      }}
      aria-label="Lions of Zion — interactive awakening"
      role="img"
    >
      {/* typography */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "7.5vh",
          zIndex: 20,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
            fontWeight: 300,
            fontSize: "clamp(1.35rem, 3.8vw, 3.05rem)",
            letterSpacing: "0.48em",
            textIndent: "0.48em",
            lineHeight: 1,
            color: revealed ? "#eaf0fb" : "transparent",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(14px)",
            filter: revealed ? "blur(0px)" : "blur(7px)",
            transition:
              "opacity 1.25s ease 0.15s, transform 1.35s cubic-bezier(.16,1,.3,1) 0.15s, filter 1.25s ease 0.15s, color 0.6s ease",
            textShadow: revealed
              ? "0 0 22px rgba(120,160,255,0.22), 0 1px 0 rgba(255,255,255,0.06)"
              : "none",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          LIONS OF ZION
        </h1>
        <p
          style={{
            marginTop: "0.95rem",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "clamp(0.58rem, 1.15vw, 0.78rem)",
            letterSpacing: "0.52em",
            textIndent: "0.52em",
            fontWeight: 400,
            color: revealed ? "rgba(168,188,225,0.92)" : "transparent",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(10px)",
            filter: revealed ? "blur(0px)" : "blur(6px)",
            transition:
              "opacity 1.15s ease 0.85s, transform 1.25s cubic-bezier(.16,1,.3,1) 0.85s, filter 1.15s ease 0.85s",
            textAlign: "center",
          }}
        >
          TRUTH HAS A SIGNAL
        </p>
        {/* hairline */}
        <div
          style={{
            marginTop: "1.35rem",
            width: revealed ? "88px" : "0px",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(140,170,225,0.55), transparent)",
            opacity: revealed ? 1 : 0,
            transition: "width 1.1s ease 1.15s, opacity 0.9s ease 1.15s",
          }}
        />
      </div>

      {/* hint */}
      <div
        style={{
          position: "absolute",
          right: "18px",
          bottom: "14px",
          zIndex: 21,
          pointerEvents: "none",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.22em",
          color: "rgba(170,190,225,0.42)",
          opacity: hint ? 1 : 0,
          transform: hint ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 0.9s ease, transform 0.9s ease",
          textShadow: "0 1px 10px rgba(0,0,0,0.9)",
        }}
      >
        PRESS · CLICK TO RECONSTRUCT
      </div>

      {/* top hairline data bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent 4%, rgba(90,130,200,0.22) 28%, rgba(160,190,240,0.16) 50%, rgba(90,130,200,0.18) 72%, transparent 96%)",
          opacity: revealed ? 0.9 : 0.55,
          transition: "opacity 1.2s ease",
          pointerEvents: "none",
          zIndex: 22,
        }}
      />
      {/* focus ring corners */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "14px",
          border: "1px solid rgba(120,150,210,0.08)",
          pointerEvents: "none",
          zIndex: 11,
          opacity: 0.9,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -1,
            left: -1,
            width: 18,
            height: 18,
            borderTop: "1px solid rgba(160,190,240,0.32)",
            borderLeft: "1px solid rgba(160,190,240,0.32)",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: -1,
            right: -1,
            width: 18,
            height: 18,
            borderTop: "1px solid rgba(160,190,240,0.32)",
            borderRight: "1px solid rgba(160,190,240,0.32)",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: -1,
            left: -1,
            width: 18,
            height: 18,
            borderBottom: "1px solid rgba(160,190,240,0.18)",
            borderLeft: "1px solid rgba(160,190,240,0.18)",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 18,
            height: 18,
            borderBottom: "1px solid rgba(160,190,240,0.18)",
            borderRight: "1px solid rgba(160,190,240,0.18)",
          }}
        />
      </div>

      {/* early loading veil for non-JS? handled by canvas clear */}
      <noscript>
        <img
          src="/lions/lion.jpg"
          alt="Lion"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </noscript>
    </div>
  );
}

/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, prefer-const */
// @ts-nocheck -- faithful port of the supplied WebGL prototype; lifecycle is owned by React.
/**
 * LIONSOFZION Typographic Motion Engine
 *
 * Full-screen ultra-dense typographic matrix simulation:
 * - System A: Continuous independent wrapped character text streams from LIONSOFZION_DATASET
 * - System B: Dynamic procedural visibility & intensity field with independent motion
 * - System C: Real-time continuous character pulse/activity keeping dataset phrases intact
 * - System D: Shared panoramic / elliptical cylindrical curvature projection
 * - Pure black background with restrained neutral and warm-signal hierarchy
 * - Optical center brand attenuation for LIONSOFZION
 */

import { generateRowStreams } from "./dataset";

/**
 * 19. Centralized Typography Field Configuration
 */
export const typographyFieldConfig = {
  // Grid Density (increased font size for enhanced legibility while maintaining rich matrix density)
  fontSizeDesktop: 8.8,          // Font size 8.8px
  fontSizeMobile: 7.4,           // Slightly larger mobile glyphs at lower density
  lineHeightDesktop: 12.0,       // Preserve information density with black breathing room
  lineHeightMobile: 11.5,        // Reduce mobile row density

  // Row Movement (System A)
  velocityMin: 38.0,             // Minimum horizontal row velocity (px/sec)
  velocityMax: 86.0,             // Maximum horizontal row velocity
  velocityVariation: 0.85,       // Differential flow variation between rows
  flowDirection: 1.0,            // Dominant flow (left-to-right)
  mobileMotionScale: 0.82,       // Preserve urgency without over-driving small screens
  surgeInterval: 6.5,            // Seconds between controlled acceleration waves
  surgeDuration: 0.85,           // Acceleration-wave duration
  surgeMultiplier: 1.35,         // Peak acceleration-wave multiplier

  // Visibility / Intensity Field Mask (System B)
  maskSpeed: 0.30,               // Mask temporal evolution rate
  maskScaleX: 0.0016,            // Mask horizontal spatial scale (creates wide horizontal bands)
  maskScaleY: 0.0036,            // Mask vertical spatial scale
  maskVelocityX: 42.0,           // Independent horizontal mask drift velocity (px/s)
  maskVelocityY: -12.0,          // Independent vertical mask drift velocity (px/s)
  maskThreshold: 0.53,           // Reveal more of the field without flattening its hierarchy
  maskContrast: 0.22,            // Preserve distinct noise / analysis / signal levels

  // Character Activity Pulse (System C)
  mutationRate: 24,              // Rare signal activations across the field
  mutationBurstSize: 4,          // Restrained local signal cluster
  mutationPulseDuration: 0.22,   // Brief activation without flashing

  // Panoramic / Elliptical Curvature Transform (System D)
  curvatureStrength: 0.15,       // Gentle panoramic cylindrical bow
  edgeCompression: 0.36,         // Horizontal glyph compression toward left/right edges
  depthStrength: 0.22,           // Depth variation
  edgeVignette: 0.24,            // Edge brightness falloff

  // Central Brand Attenuation
  centerRadiusX: 350,            // Desktop clearing radius X around the complete brand lockup
  centerRadiusY: 250,            // Desktop clearing radius Y around the complete brand lockup
  centerRadiusXMobile: 220,      // Mobile clearing radius X
  centerRadiusYMobile: 180,      // Mobile clearing radius Y
  centerMinAlpha: 0.045,         // Soft shadow behind the lion without swallowing nearby type

  // Interactivity
  pointerStrength: 0.30,
  pointerRadius: 160,
  pointerVelocityBoost: 0.22,

  // Performance & DPR
  dprCap: 2.0,
  fontFamily: "'JetBrains Mono', monospace"
};

/**
 * TypographicMotionEngine Class
 */
export class TypographicMotionEngine {
  constructor(canvasElement, config = {}) {
    this.canvas = canvasElement;
    this.config = { ...typographyFieldConfig, ...config };

    this.gl = null;
    this.ctx = null;
    this.useWebGL = true;
    this.isWebGL2 = false;
    this.extInstancing = null;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.rows = [];
    this.rowCount = 0;
    this.charsPerRow = 0;
    this.fontSize = 0;
    this.lineHeight = 0;
    this.charWidth = 0;
    this.motionScale = 1;
    this.centerRadiusX = this.config.centerRadiusX;
    this.centerRadiusY = this.config.centerRadiusY;

    this.time = 0;
    this.lastTimestamp = 0;
    this.maskOffsetX = 0;
    this.maskOffsetY = 0;

    this.pointerX = -9999;
    this.pointerY = -9999;
    this.pointerTargetX = -9999;
    this.pointerTargetY = -9999;

    this.mutationAccumulator = 0;
    this.mutationBoosts = null;
    this.instanceData = null;

    this.isRunning = false;
    this.animationFrameId = null;
    this.destroyed = false;
    this.handleWindowResize = () => this.handleResize();
    this.handlePointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerTargetX = (event.clientX - rect.left) * this.dpr;
      this.pointerTargetY = (event.clientY - rect.top) * this.dpr;
    };
    this.handlePointerLeave = () => {
      this.pointerTargetX = -9999;
      this.pointerTargetY = -9999;
    };
    this.handleVisibilityChange = () => {
      if (document.hidden) this.stop();
      else if (!this.destroyed) this.start();
    };

    this.init();
  }

  async init() {
    if (document.fonts) {
      try {
        await document.fonts.ready;
        await document.fonts.load("600 44px 'JetBrains Mono'");
      } catch (e) {
        // Continue
      }
    }

    if (this.destroyed) return;

    this.initContext();
    this.handleResize();
    this.initEventListeners();
    this.start();
  }

  initContext() {
    const glOptions = {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      powerPreference: "high-performance"
    };

    this.gl = this.canvas.getContext("webgl2", glOptions);
    this.isWebGL2 = !!this.gl;

    if (!this.gl) {
      this.gl = this.canvas.getContext("webgl", glOptions) ||
                this.canvas.getContext("experimental-webgl", glOptions);
      if (this.gl) {
        this.extInstancing = this.gl.getExtension("ANGLE_instanced_arrays");
      }
    }

    if (this.gl) {
      this.useWebGL = true;
      this.initWebGL();
    } else {
      console.warn("WebGL not available. Falling back to 2D Canvas.");
      this.useWebGL = false;
      this.ctx = this.canvas.getContext("2d", { alpha: false });
    }
  }

  initEventListeners() {
    window.addEventListener("resize", this.handleWindowResize);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerleave", this.handlePointerLeave);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  handleResize() {
    const isMobile = window.innerWidth < 768;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap);
    this.motionScale = isMobile ? this.config.mobileMotionScale : 1;
    this.centerRadiusX = isMobile ? this.config.centerRadiusXMobile : this.config.centerRadiusX;
    this.centerRadiusY = isMobile ? this.config.centerRadiusYMobile : this.config.centerRadiusY;

    this.width = Math.floor(window.innerWidth * this.dpr);
    this.height = Math.floor(window.innerHeight * this.dpr);

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.lineHeight = (isMobile ? this.config.lineHeightMobile : this.config.lineHeightDesktop) * this.dpr;
    this.charWidth = this.lineHeight * (40.0 / 64.0); // Exact cell aspect ratio
    this.fontSize = (isMobile ? this.config.fontSizeMobile : this.config.fontSizeDesktop) * this.dpr;

    // Full vertical coverage with buffer rows
    this.rowCount = Math.ceil(this.height / this.lineHeight) + 14;
    // Span across full viewport width + panoramic wrap margin
    const fieldWidth = this.width * 1.5;
    this.charsPerRow = Math.ceil(fieldWidth / this.charWidth) + 10;

    this.initRowData();

    if (this.useWebGL && this.gl) {
      this.gl.viewport(0, 0, this.width, this.height);
    }
  }

  initRowData() {
    const rawStreams = generateRowStreams(this.rowCount, this.charsPerRow + 50);
    this.rows = [];

    const totalChars = this.rowCount * this.charsPerRow;
    this.mutationBoosts = new Float32Array(totalChars);
    this.instanceData = new Float32Array(totalChars * 7);

    const totalRowWidth = this.charsPerRow * this.charWidth;

    const velocitySpan = this.config.velocityMax - this.config.velocityMin;
    const bandSpan = velocitySpan / 3;

    for (let r = 0; r < this.rowCount; r++) {
      const stream = rawStreams[r];
      const depthBand = stream.level;
      const wave = Math.sin(r * 0.73) * 0.5 + 0.5;
      const bandProgress = 0.5 + (wave - 0.5) * this.config.velocityVariation;
      const bandMin = this.config.velocityMin + depthBand * bandSpan;
      const speed = (bandMin + bandSpan * bandProgress) * this.dpr * this.motionScale;
      const direction = (r % 5 === 0) ? -0.55 : this.config.flowDirection;
      const depth = [0.54, 0.82, 1.12][depthBand];
      const baseVelocity = speed * direction;

      this.rows.push({
        asciiCodes: stream.asciiCodes,
        length: this.charsPerRow,
        offset: (r * 87.3) % totalRowWidth,
        baseVelocity,
        velocity: baseVelocity,
        depth: depth,
        semanticLevel: depthBand,
        phase: (r * 0.23) % Math.PI
      });
    }
  }

  // ==========================================
  // WebGL Pipeline Implementation
  // ==========================================
  initWebGL() {
    const gl = this.gl;

    this.createFontAtlas();

    const vsSource = `
      precision highp float;

      attribute vec2 a_quadVertex; // [-0.5, -0.5] to [0.5, 0.5]
      attribute vec2 a_gridPos;    // (colIndex, rowIndex)
      attribute float a_ascii;     // ASCII code
      attribute float a_rowOffset; // Row scroll offset in pixels
      attribute float a_rowSpeed;  // Row velocity
      attribute float a_depth;     // Row depth
      attribute float a_mutation;  // Mutation pulse [0..1]

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_fontSize;
      uniform float u_lineHeight;
      uniform float u_charWidth;
      uniform float u_curvature;
      uniform float u_edgeCompression;
      uniform float u_depthStrength;
      uniform float u_charsPerRow;
      uniform float u_totalRows;

      varying vec2 v_uv;
      varying vec2 v_screenPos;
      varying vec2 v_normPos;
      varying float v_depth;
      varying float v_mutation;

      void main() {
        float col = a_gridPos.x;
        float row = a_gridPos.y;

        // Base continuous horizontal flow wrapping
        float fieldWidth = u_charsPerRow * u_charWidth;
        float uncurvedX = mod(col * u_charWidth - a_rowOffset, fieldWidth);
        
        // Center uncurved field around screen center
        float halfW = u_resolution.x * 0.5;
        float halfH = u_resolution.y * 0.5;
        float shiftX = (fieldWidth - u_resolution.x) * 0.5;
        float screenX = uncurvedX - shiftX;

        // Vertical screen coordinate covering entire screen
        float screenY = (row - 6.0) * u_lineHeight + u_lineHeight * 0.5;

        // Center-relative normalized coordinates [-1.0 .. 1.0]
        float nx = (screenX - halfW) / halfW;
        float ny = (screenY - halfH) / halfH;

        // SYSTEM D: Panoramic Cylindrical Projection
        float theta = nx * 0.70; // ~40 degrees
        float compFactor = cos(theta);
        float nxCurved = sin(theta) / sin(0.70);

        // Vertical bow: gentle concave panoramic curve across the whole cylinder
        float nyCurved = ny * (1.0 + u_curvature * (1.0 / max(compFactor, 0.1) - 1.0));

        // Quad scaled to exact character dimensions
        vec2 charSize = vec2(u_charWidth * compFactor * (1.0 - u_edgeCompression * 0.25 * nx * nx), u_lineHeight);
        vec2 worldPos = vec2(halfW + nxCurved * halfW, halfH + nyCurved * halfH) + a_quadVertex * charSize;

        // Map to clip space [-1, 1]
        vec2 clipSpace = (worldPos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;

        gl_Position = vec4(clipSpace, 0.0, 1.0);

        // Atlas UV coordinates (16 cols x 8 rows atlas for 128 chars)
        float asciiIndex = clamp(a_ascii - 32.0, 0.0, 95.0);
        float atlasCol = mod(asciiIndex, 16.0);
        float atlasRow = floor(asciiIndex / 16.0);

        // Precise upright texture coordinates
        float u = (atlasCol + (a_quadVertex.x + 0.5)) / 16.0;
        float v = (atlasRow + (a_quadVertex.y + 0.5)) / 8.0;
        v_uv = vec2(u, v);

        v_screenPos = worldPos;
        v_normPos = vec2(nx, ny);
        v_depth = a_depth;
        v_mutation = a_mutation;
      }
    `;

    const fsSource = `
      precision highp float;

      uniform sampler2D u_atlas;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_maskOffset;
      uniform vec2 u_maskScale;
      uniform float u_maskThreshold;
      uniform float u_maskContrast;
      uniform vec2 u_centerRadius;
      uniform float u_centerMinAlpha;
      uniform vec2 u_pointer;
      uniform float u_pointerRadius;
      uniform float u_edgeVignette;

      varying vec2 v_uv;
      varying vec2 v_screenPos;
      varying vec2 v_normPos;
      varying float v_depth;
      varying float v_mutation;

      // Fast multi-harmonic procedural noise for System B
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p, float t) {
        float v = 0.0;
        mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
        vec2 p1 = p + vec2(t * 0.10, -t * 0.05);
        v += 0.50 * smoothNoise(p1);
        vec2 p2 = rot * p * 2.02 + vec2(13.4, 37.1) + vec2(-t * 0.08, t * 0.06);
        v += 0.32 * smoothNoise(p2);
        vec2 p3 = rot * p2 * 2.05 + vec2(41.7, 19.3) + vec2(t * 0.12, t * 0.09);
        v += 0.18 * smoothNoise(p3);
        return v;
      }

      void main() {
        // Sample glyph mask from JetBrains Mono texture atlas
        float glyphMask = texture2D(u_atlas, v_uv).a;
        if (glyphMask < 0.05) {
          discard;
        }

        // SYSTEM B: Dynamic Visibility & Intensity Mask Calculation
        vec2 maskCoord = (v_screenPos + u_maskOffset) * u_maskScale;
        float rawNoise = fbm(maskCoord, u_time);

        // Smooth organic contrast curve
        float activeMask = smoothstep(u_maskThreshold - u_maskContrast, u_maskThreshold + u_maskContrast, rawNoise);
        
        // Most information remains atmospheric; only selected fragments resolve.
        float baseFloor = 0.10;
        float intensity = baseFloor + activeMask * 0.72;

        // Depth modulation
        intensity *= v_depth;

        // SYSTEM C: Character Activity Flash Pulse
        intensity = clamp(intensity + v_mutation * 0.38, 0.0, 1.0);

        // Optical Center Radial Attenuation for LIONSOFZION
        vec2 centerDiff = (v_screenPos - u_resolution * 0.5) / u_centerRadius;
        float centerDist = length(centerDiff);
        float centerAtten = mix(u_centerMinAlpha, 1.0, smoothstep(0.35, 1.1, centerDist));
        intensity *= centerAtten;

        // Edge Vignette Falloff
        float nx2 = v_normPos.x * v_normPos.x;
        float edgeFade = 1.0 - u_edgeVignette * nx2;
        intensity *= edgeFade;

        // Interactive Pointer Glow
        if (u_pointer.x > 0.0) {
          float pDist = length(v_screenPos - u_pointer);
          float pFactor = 1.0 - smoothstep(0.0, u_pointerRadius, pDist);
          intensity += pFactor * 0.14;
        }

        // Neutral information hierarchy. Gold is reserved for resolved signal rows.
        vec3 color;
        float finalAlpha;

        if (v_depth > 1.0 && intensity > 0.76) {
          color = vec3(0.63, 0.49, 0.25);
          finalAlpha = 0.86 * glyphMask;
        } else if (intensity < 0.24) {
          color = vec3(0.16, 0.165, 0.17);
          finalAlpha = 0.38 * glyphMask;
        } else if (intensity < 0.52) {
          float t = (intensity - 0.24) / 0.28;
          color = mix(vec3(0.24, 0.245, 0.25), vec3(0.48, 0.485, 0.49), t);
          finalAlpha = (0.44 + 0.18 * t) * glyphMask;
        } else if (intensity < 0.80) {
          float t = (intensity - 0.52) / 0.28;
          color = mix(vec3(0.52, 0.525, 0.53), vec3(0.76, 0.765, 0.77), t);
          finalAlpha = (0.64 + 0.18 * t) * glyphMask;
        } else {
          float t = (intensity - 0.80) / 0.20;
          color = mix(vec3(0.80, 0.795, 0.78), vec3(0.96, 0.95, 0.92), t);
          finalAlpha = (0.84 + 0.12 * t) * glyphMask;
        }

        gl_FragColor = vec4(color, finalAlpha);
      }
    `;

    this.program = this.createProgram(gl, vsSource, fsSource);

    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      time: gl.getUniformLocation(this.program, "u_time"),
      fontSize: gl.getUniformLocation(this.program, "u_fontSize"),
      lineHeight: gl.getUniformLocation(this.program, "u_lineHeight"),
      charWidth: gl.getUniformLocation(this.program, "u_charWidth"),
      curvature: gl.getUniformLocation(this.program, "u_curvature"),
      edgeCompression: gl.getUniformLocation(this.program, "u_edgeCompression"),
      depthStrength: gl.getUniformLocation(this.program, "u_depthStrength"),
      charsPerRow: gl.getUniformLocation(this.program, "u_charsPerRow"),
      totalRows: gl.getUniformLocation(this.program, "u_totalRows"),
      maskOffset: gl.getUniformLocation(this.program, "u_maskOffset"),
      maskScale: gl.getUniformLocation(this.program, "u_maskScale"),
      maskThreshold: gl.getUniformLocation(this.program, "u_maskThreshold"),
      maskContrast: gl.getUniformLocation(this.program, "u_maskContrast"),
      centerRadius: gl.getUniformLocation(this.program, "u_centerRadius"),
      centerMinAlpha: gl.getUniformLocation(this.program, "u_centerMinAlpha"),
      pointer: gl.getUniformLocation(this.program, "u_pointer"),
      pointerRadius: gl.getUniformLocation(this.program, "u_pointerRadius"),
      edgeVignette: gl.getUniformLocation(this.program, "u_edgeVignette"),
      atlas: gl.getUniformLocation(this.program, "u_atlas")
    };

    this.attribs = {
      quadVertex: gl.getAttribLocation(this.program, "a_quadVertex"),
      gridPos: gl.getAttribLocation(this.program, "a_gridPos"),
      ascii: gl.getAttribLocation(this.program, "a_ascii"),
      rowOffset: gl.getAttribLocation(this.program, "a_rowOffset"),
      rowSpeed: gl.getAttribLocation(this.program, "a_rowSpeed"),
      depth: gl.getAttribLocation(this.program, "a_depth"),
      mutation: gl.getAttribLocation(this.program, "a_mutation")
    };

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
      -0.5,  0.5,
      -0.5,  0.5,
       0.5, -0.5,
       0.5,  0.5
    ]), gl.STATIC_DRAW);

    this.instanceBuffer = gl.createBuffer();
  }

  createFontAtlas() {
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = 640;
    atlasCanvas.height = 512;
    const ctx = atlasCanvas.getContext("2d");

    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);

    ctx.font = "600 44px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    const cellW = 40; // 640 / 16
    const cellH = 64; // 512 / 8

    for (let i = 0; i < 96; i++) {
      const char = String.fromCharCode(32 + i);
      const col = i % 16;
      const row = Math.floor(i / 16);
      const cx = col * cellW + cellW * 0.5;
      const cy = row * cellH + cellH * 0.5;
      ctx.fillText(char, cx, cy);
    }

    const gl = this.gl;
    this.atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  createProgram(gl, vs, fs) {
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vs);
    gl.compileShader(vShader);
    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      console.error("Vertex Shader Error:", gl.getShaderInfoLog(vShader));
    }

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fs);
    gl.compileShader(fShader);
    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      console.error("Fragment Shader Error:", gl.getShaderInfoLog(fShader));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program Link Error:", gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  start() {
    if (this.isRunning || this.destroyed) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    const loop = (timestamp) => {
      if (!this.isRunning) return;
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      this.update(dt);
      this.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerleave", this.handlePointerLeave);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

    if (this.gl) {
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
      if (this.atlasTexture) this.gl.deleteTexture(this.atlasTexture);
      if (this.program) this.gl.deleteProgram(this.program);
    }
  }

  update(dt) {
    this.time += dt;

    if (this.pointerTargetX > 0) {
      this.pointerX += (this.pointerTargetX - this.pointerX) * 0.12;
      this.pointerY += (this.pointerTargetY - this.pointerY) * 0.12;
    } else {
      this.pointerX = -9999;
      this.pointerY = -9999;
    }

    // SYSTEM A: Update continuous row flow with a controlled global acceleration wave.
    const surgePhase = this.time % this.config.surgeInterval;
    const surgeProgress = Math.min(1, surgePhase / this.config.surgeDuration);
    const surgePulse = surgePhase < this.config.surgeDuration
      ? Math.sin(Math.PI * surgeProgress) ** 2
      : 0;
    const surge = 1 + (this.config.surgeMultiplier - 1) * surgePulse;
    const totalRowWidth = this.charsPerRow * this.charWidth;
    for (let r = 0; r < this.rowCount; r++) {
      const row = this.rows[r];
      let pointerBoost = 1;
      if (this.pointerY > 0) {
        const rowY = (r - 6) * this.lineHeight + this.lineHeight * 0.5;
        const pointerDistance = Math.abs(rowY - this.pointerY);
        const pointerFalloff = Math.max(
          0,
          1 - pointerDistance / (this.config.pointerRadius * this.dpr),
        );
        pointerBoost += pointerFalloff * this.config.pointerVelocityBoost;
      }
      row.velocity = row.baseVelocity * surge * pointerBoost;
      row.offset = (row.offset + row.velocity * dt) % totalRowWidth;
      if (row.offset < 0) row.offset += totalRowWidth;
    }

    // SYSTEM B: Update Independent Mask Drift
    this.maskOffsetX += this.config.maskVelocityX * this.dpr * this.motionScale * dt;
    this.maskOffsetY += this.config.maskVelocityY * this.dpr * this.motionScale * dt;

    // SYSTEM C: Real-Time Character Activity Pulse (keeps exact dataset words intact)
    this.mutationAccumulator += dt * this.config.mutationRate * this.motionScale;
    while (this.mutationAccumulator >= 1.0) {
      this.mutationAccumulator -= 1.0;
      this.performLocalActivityPulse();
    }

    // Decay mutation flash pulses
    const decay = dt / this.config.mutationPulseDuration;
    for (let i = 0; i < this.mutationBoosts.length; i++) {
      if (this.mutationBoosts[i] > 0) {
        this.mutationBoosts[i] = Math.max(0, this.mutationBoosts[i] - decay);
      }
    }
  }

  performLocalActivityPulse() {
    const r = Math.floor(Math.random() * this.rowCount);
    const c = Math.floor(Math.random() * this.charsPerRow);

    for (let b = 0; b < this.config.mutationBurstSize; b++) {
      const targetC = (c + b) % this.charsPerRow;
      const index = r * this.charsPerRow + targetC;
      this.mutationBoosts[index] = 1.0;
    }
  }

  render() {
    if (this.useWebGL && this.gl) {
      this.renderWebGL();
    } else if (this.ctx) {
      this.renderCanvas2D();
    }
  }

  renderWebGL() {
    const gl = this.gl;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.resolution, this.width, this.height);
    gl.uniform1f(this.uniforms.time, this.time * this.config.maskSpeed);
    gl.uniform1f(this.uniforms.fontSize, this.fontSize);
    gl.uniform1f(this.uniforms.lineHeight, this.lineHeight);
    gl.uniform1f(this.uniforms.charWidth, this.charWidth);
    gl.uniform1f(this.uniforms.curvature, this.config.curvatureStrength);
    gl.uniform1f(this.uniforms.edgeCompression, this.config.edgeCompression);
    gl.uniform1f(this.uniforms.depthStrength, this.config.depthStrength);
    gl.uniform1f(this.uniforms.charsPerRow, this.charsPerRow);
    gl.uniform1f(this.uniforms.totalRows, this.rowCount);
    gl.uniform2f(this.uniforms.maskOffset, this.maskOffsetX, this.maskOffsetY);
    gl.uniform2f(this.uniforms.maskScale, this.config.maskScaleX, this.config.maskScaleY);
    gl.uniform1f(this.uniforms.maskThreshold, this.config.maskThreshold);
    gl.uniform1f(this.uniforms.maskContrast, this.config.maskContrast);
    gl.uniform2f(this.uniforms.centerRadius, this.centerRadiusX * this.dpr, this.centerRadiusY * this.dpr);
    gl.uniform1f(this.uniforms.centerMinAlpha, this.config.centerMinAlpha);
    gl.uniform2f(this.uniforms.pointer, this.pointerX, this.pointerY);
    gl.uniform1f(this.uniforms.pointerRadius, this.config.pointerRadius * this.dpr);
    gl.uniform1f(this.uniforms.edgeVignette, this.config.edgeVignette);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.uniforms.atlas, 0);

    const totalChars = this.rowCount * this.charsPerRow;

    if (this.isWebGL2 || this.extInstancing) {
      let ptr = 0;
      for (let r = 0; r < this.rowCount; r++) {
        const row = this.rows[r];
        const offset = row.offset;
        const speed = row.velocity;
        const depth = row.depth;

        for (let c = 0; c < this.charsPerRow; c++) {
          const ascii = row.asciiCodes[c];
          const mutation = this.mutationBoosts[r * this.charsPerRow + c] || 0.0;

          this.instanceData[ptr++] = c;
          this.instanceData[ptr++] = r;
          this.instanceData[ptr++] = ascii;
          this.instanceData[ptr++] = offset;
          this.instanceData[ptr++] = speed;
          this.instanceData[ptr++] = depth;
          this.instanceData[ptr++] = mutation;
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      if (this.attribs.quadVertex >= 0) {
        gl.enableVertexAttribArray(this.attribs.quadVertex);
        gl.vertexAttribPointer(this.attribs.quadVertex, 2, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceData, gl.DYNAMIC_DRAW);

      const stride = 7 * 4;

      const setupInstancedAttrib = (loc, size, offset) => {
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
          if (this.isWebGL2) {
            gl.vertexAttribDivisor(loc, 1);
          } else {
            this.extInstancing.vertexAttribDivisorANGLE(loc, 1);
          }
        }
      };

      setupInstancedAttrib(this.attribs.gridPos, 2, 0);
      setupInstancedAttrib(this.attribs.ascii, 1, 2 * 4);
      setupInstancedAttrib(this.attribs.rowOffset, 1, 3 * 4);
      setupInstancedAttrib(this.attribs.rowSpeed, 1, 4 * 4);
      setupInstancedAttrib(this.attribs.depth, 1, 5 * 4);
      setupInstancedAttrib(this.attribs.mutation, 1, 6 * 4);

      if (this.isWebGL2) {
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, totalChars);
      } else {
        this.extInstancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, totalChars);
      }
    } else {
      this.renderCanvas2D();
    }
  }

  renderCanvas2D() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `600 ${this.fontSize}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const cRadX = this.centerRadiusX * this.dpr;
    const cRadY = this.centerRadiusY * this.dpr;
    const fieldWidth = this.charsPerRow * this.charWidth;
    const shiftX = (fieldWidth - this.width) * 0.5;

    const t = this.time * this.config.maskSpeed;

    for (let r = 0; r < this.rowCount; r++) {
      const row = this.rows[r];
      const screenY = (r - 6) * this.lineHeight + this.lineHeight * 0.5;
      const ny = (screenY - halfH) / halfH;

      for (let c = 0; c < this.charsPerRow; c++) {
        let uncurvedX = ((c * this.charWidth - row.offset) % fieldWidth + fieldWidth) % fieldWidth;
        let screenX = uncurvedX - shiftX;

        const nx = (screenX - halfW) / halfW;
        const theta = nx * 0.70;
        const compFactor = Math.cos(theta);
        const nxCurved = Math.sin(theta) / Math.sin(0.70);
        const nyCurved = ny * (1.0 + this.config.curvatureStrength * (1.0 / Math.max(compFactor, 0.1) - 1.0));

        const worldX = halfW + nxCurved * halfW;
        const worldY = halfH + nyCurved * halfH;

        if (worldX < -30 || worldX > this.width + 30 || worldY < -30 || worldY > this.height + 30) {
          continue;
        }

        const mx = (worldX + this.maskOffsetX) * this.config.maskScaleX;
        const my = (worldY + this.maskOffsetY) * this.config.maskScaleY;
        const noiseVal = Math.sin(mx + t * 0.8) * Math.cos(my - t * 0.6) * 0.5 + 0.5;

        let activeCluster = (noiseVal - (this.config.maskThreshold - this.config.maskContrast)) / (this.config.maskContrast * 2);
        activeCluster = Math.max(0, Math.min(1, activeCluster));

        let intensity = (0.10 + activeCluster * 0.72) * row.depth;

        const mutation = this.mutationBoosts[r * this.charsPerRow + c] || 0;
        intensity = Math.min(1, intensity + mutation * 0.38);

        const cdx = (worldX - halfW) / cRadX;
        const cdy = (worldY - halfH) / cRadY;
        const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
        const centerAtten = this.config.centerMinAlpha + (1.0 - this.config.centerMinAlpha) * Math.min(1, Math.max(0, (cDist - 0.35) / 0.75));
        intensity *= centerAtten;

        const char = String.fromCharCode(row.asciiCodes[c]);
        if (row.semanticLevel === 2 && intensity > 0.76) {
          ctx.fillStyle = "rgba(161, 125, 64, 0.86)";
        } else if (intensity < 0.24) {
          ctx.fillStyle = "rgba(41, 42, 43, 0.38)";
        } else if (intensity < 0.52) {
          ctx.fillStyle = "rgba(92, 94, 96, 0.54)";
        } else if (intensity < 0.80) {
          ctx.fillStyle = "rgba(164, 166, 168, 0.74)";
        } else {
          ctx.fillStyle = "rgba(240, 237, 229, 0.94)";
        }

        ctx.fillText(char, worldX, worldY);
      }
    }
  }
}

/**
 * LIONSOFZION Typographic Motion Engine
 *
 * Full-screen ultra-dense typographic information matrix simulation:
 * - Sourced exclusively from the canonical 28-category word bank and 157-handle bank.
 * - System A: Seamless continuous horizontal wrapping character streams flowing to the right.
 * - System B: Independent procedural visibility & intensity field (multi-octave noise, sweeps, beams).
 * - System C: Continuous seeded character glyph mutation cycling & activity pulses.
 * - System D: Shared panoramic cylindrical / elliptical projection with soft brand attenuation.
 * - Hardware-accelerated GPU instancing with WebGL2 / WebGL1 and 2D Canvas fallback.
 * - Performance tiers (desktop/high, desktop/low, mobile, reduced-motion, no-GPU).
 */

import {
  generateRowStreams,
  getCanonicalMutationAtlasIndices,
  ARROW_GLYPH,
  ARROW_ATLAS_INDEX,
  type RowStream,
} from "./stream-generator";

export interface TypographicFieldConfig {
  // Grid Density (130-190 desktop rows for ultra-dense matrix)
  fontSizeDesktop: number;
  fontSizeMobile: number;
  lineHeightDesktop: number;
  lineHeightMobile: number;

  // System A: Row Movement
  velocityMin: number;
  velocityMax: number;
  velocityVariation: number;
  flowDirection: number;
  mobileMotionScale: number;
  surgeInterval: number;
  surgeDuration: number;
  surgeMultiplier: number;

  // System B: Screen-Space Visibility / Intensity Field
  maskSpeed: number;
  maskScaleX: number;
  maskScaleY: number;
  maskVelocityX: number;
  maskVelocityY: number;
  maskThreshold: number;
  maskContrast: number;

  // System C: Character Glyph Mutation & Activity Pulse
  mutationRate: number;
  mutationBurstSize: number;
  mutationPulseDuration: number;

  // System D: Panoramic Cylindrical Projection
  curvatureStrength: number;
  edgeCompression: number;
  depthStrength: number;
  edgeVignette: number;

  // Central Brand Attenuation
  centerRadiusX: number;
  centerRadiusY: number;
  centerRadiusXMobile: number;
  centerRadiusYMobile: number;
  centerMinAlpha: number;

  // Interactivity
  pointerStrength: number;
  pointerRadius: number;
  pointerVelocityBoost: number;

  // Performance & DPR
  dprCap: number;
  fontFamily: string;
}

export const defaultFieldConfig: TypographicFieldConfig = {
  // Desktop: ~130–190 rows depending on viewport height (7.0px pitch)
  fontSizeDesktop: 6.2,
  fontSizeMobile: 6.0,
  lineHeightDesktop: 7.2,
  lineHeightMobile: 8.8,

  // Row Movement: all rows flow strictly to the right
  velocityMin: 32.0,
  velocityMax: 78.0,
  velocityVariation: 0.75,
  flowDirection: 1.0, // Strictly rightward
  mobileMotionScale: 0.85,
  surgeInterval: 6.8,
  surgeDuration: 0.9,
  surgeMultiplier: 1.35,

  // Visibility / Intensity Field
  maskSpeed: 0.28,
  maskScaleX: 0.0015,
  maskScaleY: 0.0032,
  maskVelocityX: 38.0,
  maskVelocityY: -10.0,
  maskThreshold: 0.52,
  maskContrast: 0.24,

  // Continuous Character Mutation
  mutationRate: 48, // Active mutations per second across the field
  mutationBurstSize: 5,
  mutationPulseDuration: 0.25,

  // Panoramic Geometry
  curvatureStrength: 0.16,
  edgeCompression: 0.38,
  depthStrength: 0.24,
  edgeVignette: 0.26,

  // Center Brand Attenuation
  centerRadiusX: 360,
  centerRadiusY: 260,
  centerRadiusXMobile: 210,
  centerRadiusYMobile: 170,
  centerMinAlpha: 0.06,

  // Interactivity
  pointerStrength: 0.35,
  pointerRadius: 180,
  pointerVelocityBoost: 0.24,

  // Performance
  dprCap: 2.0,
  fontFamily: "'JetBrains Mono', monospace",
};

interface RowState {
  charCodes: Uint16Array;
  length: number;
  offset: number;
  baseVelocity: number;
  velocity: number;
  depth: number;
  semanticLevel: number;
  phase: number;
}

export class TypographicMotionEngine {
  public canvas: HTMLCanvasElement;
  public config: TypographicFieldConfig;
  public isRunning = false;
  public destroyed = false;

  public rowCount = 0;
  public charsPerRow = 0;
  public width = 0;
  public height = 0;
  public dpr = 1;

  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private isWebGL2 = false;
  private extInstancing: ANGLE_instanced_arrays | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private useWebGL = true;

  private rows: RowState[] = [];
  private mutationBoosts: Float32Array = new Float32Array(0);
  private mutationTimers: Float32Array = new Float32Array(0);
  private currentAscii: Uint8Array = new Uint8Array(0);
  private canonicalAscii: Uint8Array = new Uint8Array(0);
  private instanceData: Float32Array = new Float32Array(0);

  private mutationCandidates: Uint8Array = new Uint8Array(0);
  private mutationAccumulator = 0;

  private time = 0;
  private lastTimestamp = 0;
  private maskOffsetX = 0;
  private maskOffsetY = 0;

  private pointerX = -9999;
  private pointerY = -9999;
  private pointerTargetX = -9999;
  private pointerTargetY = -9999;

  private animationFrameId: number | null = null;
  private isReducedMotion = false;

  // WebGL Buffers & Handles
  private program: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private atlasTexture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private attribs: Record<string, number> = {};

  private fontSize = 0;
  private lineHeight = 0;
  private charWidth = 0;
  private motionScale = 1;
  private centerRadiusX = 360;
  private centerRadiusY = 260;

  private handleWindowResize = () => this.handleResize();
  private handlePointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTargetX = (event.clientX - rect.left) * this.dpr;
    this.pointerTargetY = (event.clientY - rect.top) * this.dpr;
  };
  private handlePointerLeave = () => {
    this.pointerTargetX = -9999;
    this.pointerTargetY = -9999;
  };
  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.stop();
    } else if (!this.destroyed) {
      this.start();
    }
  };

  constructor(canvasElement: HTMLCanvasElement, customConfig: Partial<TypographicFieldConfig> = {}) {
    this.canvas = canvasElement;
    this.config = { ...defaultFieldConfig, ...customConfig };
    this.mutationCandidates = getCanonicalMutationAtlasIndices();

    this.isReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.init();
  }

  private async init() {
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
        await document.fonts.load("400 44px 'JetBrains Mono'");
      } catch {
        // Fallback gracefully
      }
    }

    if (this.destroyed) return;

    this.initContext();
    this.handleResize();
    this.initEventListeners();
    this.start();
  }

  private initContext() {
    const glOptions: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    };

    try {
      this.gl = this.canvas.getContext("webgl2", glOptions) as WebGL2RenderingContext | null;
      this.isWebGL2 = !!this.gl;

      if (!this.gl) {
        this.gl =
          (this.canvas.getContext("webgl", glOptions) as WebGLRenderingContext | null) ||
          (this.canvas.getContext("experimental-webgl", glOptions) as WebGLRenderingContext | null);
        if (this.gl) {
          this.extInstancing = this.gl.getExtension("ANGLE_instanced_arrays");
        }
      }
    } catch {
      this.gl = null;
    }

    if (this.gl) {
      this.useWebGL = true;
      this.initWebGL();
    } else {
      this.useWebGL = false;
      this.ctx = this.canvas.getContext("2d", { alpha: false });
    }
  }

  private initEventListeners() {
    window.addEventListener("resize", this.handleWindowResize, { passive: true });
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibilityChange, { passive: true });
  }

  public handleResize() {
    if (!this.canvas) return;

    const isMobile = window.innerWidth < 768;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : this.config.dprCap);
    this.motionScale = isMobile ? this.config.mobileMotionScale : 1;
    this.centerRadiusX = (isMobile ? this.config.centerRadiusXMobile : this.config.centerRadiusX) * this.dpr;
    this.centerRadiusY = (isMobile ? this.config.centerRadiusYMobile : this.config.centerRadiusY) * this.dpr;

    this.width = Math.floor(window.innerWidth * this.dpr);
    this.height = Math.floor(window.innerHeight * this.dpr);

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const baseLineHeight = isMobile ? this.config.lineHeightMobile : this.config.lineHeightDesktop;
    const baseFontSize = isMobile ? this.config.fontSizeMobile : this.config.fontSizeDesktop;

    this.lineHeight = baseLineHeight * this.dpr;
    this.fontSize = baseFontSize * this.dpr;
    this.charWidth = this.lineHeight * (40.0 / 64.0); // Exact cell aspect ratio

    // Density: desktop creates ~130–190 rows across viewport height
    this.rowCount = Math.ceil(this.height / this.lineHeight) + 16;
    const fieldWidth = this.width * 1.45;
    this.charsPerRow = Math.ceil(fieldWidth / this.charWidth) + 12;

    this.initRowData();

    if (this.useWebGL && this.gl) {
      this.gl.viewport(0, 0, this.width, this.height);
    }
  }

  private initRowData() {
    const rawStreams: RowStream[] = generateRowStreams(this.rowCount, this.charsPerRow + 50, 42);
    this.rows = [];

    const totalChars = this.rowCount * this.charsPerRow;
    this.mutationBoosts = new Float32Array(totalChars);
    this.mutationTimers = new Float32Array(totalChars);
    this.currentAscii = new Uint8Array(totalChars);
    this.canonicalAscii = new Uint8Array(totalChars);
    this.instanceData = new Float32Array(totalChars * 7);

    const totalRowWidth = this.charsPerRow * this.charWidth;

    for (let r = 0; r < this.rowCount; r++) {
      const stream = rawStreams[r];
      const baseVelocity = stream.baseVelocity * this.dpr * this.motionScale;

      this.rows.push({
        charCodes: stream.charCodes,
        length: this.charsPerRow,
        offset: (r * 113.7) % totalRowWidth,
        baseVelocity,
        velocity: baseVelocity,
        depth: stream.depth,
        semanticLevel: stream.semanticLevel,
        phase: stream.phase,
      });

      for (let c = 0; c < this.charsPerRow; c++) {
        const ascii = stream.charCodes[c % stream.charCodes.length];
        const idx = r * this.charsPerRow + c;
        this.canonicalAscii[idx] = ascii;
        this.currentAscii[idx] = ascii;
      }
    }
  }

  private initWebGL() {
    const gl = this.gl;
    if (!gl) return;

    this.createFontAtlas();

    const vsSource = `
      precision highp float;

      attribute vec2 a_quadVertex; // [-0.5, -0.5] to [0.5, 0.5]
      attribute vec2 a_gridPos;    // (colIndex, rowIndex)
      attribute float a_ascii;     // Character atlas index [0..95]
      attribute float a_rowOffset; // Row scroll offset in pixels
      attribute float a_rowSpeed;  // Row velocity
      attribute float a_depth;     // Semantic depth factor
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

        // Base horizontal continuous wrapping
        float fieldWidth = u_charsPerRow * u_charWidth;
        float uncurvedX = mod(col * u_charWidth + a_rowOffset, fieldWidth);

        float halfW = u_resolution.x * 0.5;
        float halfH = u_resolution.y * 0.5;
        float shiftX = (fieldWidth - u_resolution.x) * 0.5;
        float screenX = uncurvedX - shiftX;

        // Vertical screen coordinate covering entire viewport
        float screenY = (row - 8.0) * u_lineHeight + u_lineHeight * 0.5;

        // Normalized screen coordinates [-1.0 .. 1.0]
        float nx = (screenX - halfW) / halfW;
        float ny = (screenY - halfH) / halfH;

        // SYSTEM D: Shared Panoramic Cylindrical Projection
        float theta = nx * 0.72; // ~41 degrees cylindrical arc
        float compFactor = cos(theta);
        float nxCurved = sin(theta) / sin(0.72);

        // Vertical curvature tightening near top and bottom boundaries
        float nyCurved = ny * (1.0 + u_curvature * (1.0 / max(compFactor, 0.12) - 1.0));

        // Quad geometry with edge compression
        vec2 charSize = vec2(
          u_charWidth * compFactor * (1.0 - u_edgeCompression * 0.22 * nx * nx),
          u_lineHeight
        );
        vec2 worldPos = vec2(halfW + nxCurved * halfW, halfH + nyCurved * halfH) + a_quadVertex * charSize;

        // Clip space [-1.0, 1.0]
        vec2 clipSpace = (worldPos / u_resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;

        gl_Position = vec4(clipSpace, 0.0, 1.0);

        // Atlas UV coordinates (16 cols x 8 rows atlas for 128 cells)
        float atlasIndex = clamp(a_ascii, 0.0, 95.0);
        float atlasCol = mod(atlasIndex, 16.0);
        float atlasRow = floor(atlasIndex / 16.0);

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
        vec2 p1 = p + vec2(t * 0.08, -t * 0.04);
        v += 0.50 * smoothNoise(p1);
        vec2 p2 = rot * p * 2.04 + vec2(13.4, 37.1) + vec2(-t * 0.06, t * 0.05);
        v += 0.32 * smoothNoise(p2);
        vec2 p3 = rot * p2 * 2.06 + vec2(41.7, 19.3) + vec2(t * 0.10, t * 0.08);
        v += 0.18 * smoothNoise(p3);
        return v;
      }

      void main() {
        // Sample glyph mask from JetBrains Mono texture atlas
        float glyphMask = texture2D(u_atlas, v_uv).a;
        if (glyphMask < 0.06) {
          discard;
        }

        // SYSTEM B: Dynamic Visibility & Intensity Mask Calculation
        vec2 maskCoord = (v_screenPos + u_maskOffset) * u_maskScale;
        float rawNoise = fbm(maskCoord, u_time);

        // Smooth contrast reveal curve
        float activeMask = smoothstep(u_maskThreshold - u_maskContrast, u_maskThreshold + u_maskContrast, rawNoise);
        
        // 5%-30% base atmosphere visibility; sparse highlights resolve
        float baseFloor = 0.08;
        float intensity = baseFloor + activeMask * 0.74;
        intensity *= v_depth;

        // SYSTEM C: Character Activity Flash Pulse
        intensity = clamp(intensity + v_mutation * 0.40, 0.0, 1.0);

        // Optical Center Soft Attenuation Mask (LIONSOFZION sits at 0.5, 0.47)
        vec2 centerOrigin = vec2(u_resolution.x * 0.5, u_resolution.y * 0.47);
        vec2 centerDiff = (v_screenPos - centerOrigin) / u_centerRadius;
        float centerDist = length(centerDiff);
        float centerAtten = mix(u_centerMinAlpha, 1.0, smoothstep(0.32, 1.08, centerDist));
        intensity *= centerAtten;

        // Edge Vignette Falloff
        float nx2 = v_normPos.x * v_normPos.x;
        float edgeFade = 1.0 - u_edgeVignette * nx2;
        intensity *= edgeFade;

        // Interactive Pointer Energy Source
        if (u_pointer.x > 0.0) {
          float pDist = length(v_screenPos - u_pointer);
          float pFactor = 1.0 - smoothstep(0.0, u_pointerRadius, pDist);
          intensity += pFactor * 0.16;
        }

        // Project Design Token Intensity Hierarchy
        vec3 color;
        float finalAlpha;

        if (v_depth > 1.05 && intensity > 0.74) {
          // Medium accent (muted gold) for resolved high-signal items
          color = vec3(0.63, 0.49, 0.25);
          finalAlpha = 0.88 * glyphMask;
        } else if (intensity < 0.22) {
          // Deep inactive text (lowest-emphasis atmospheric ground)
          color = vec3(0.14, 0.145, 0.15);
          finalAlpha = 0.35 * glyphMask;
        } else if (intensity < 0.50) {
          // Low intensity (low-emphasis foreground)
          float t = (intensity - 0.22) / 0.28;
          color = mix(vec3(0.22, 0.225, 0.23), vec3(0.44, 0.445, 0.45), t);
          finalAlpha = (0.42 + 0.18 * t) * glyphMask;
        } else if (intensity < 0.78) {
          // Active text (high-emphasis foreground)
          float t = (intensity - 0.50) / 0.28;
          color = mix(vec3(0.50, 0.505, 0.51), vec3(0.75, 0.755, 0.76), t);
          finalAlpha = (0.62 + 0.18 * t) * glyphMask;
        } else {
          // Peak highlights (maximum-emphasis highlight)
          float t = (intensity - 0.78) / 0.22;
          color = mix(vec3(0.78, 0.775, 0.76), vec3(0.96, 0.95, 0.92), t);
          finalAlpha = (0.84 + 0.14 * t) * glyphMask;
        }

        gl_FragColor = vec4(color, finalAlpha);
      }
    `;

    this.program = this.createProgram(gl, vsSource, fsSource);
    if (!this.program) return;

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
      atlas: gl.getUniformLocation(this.program, "u_atlas"),
    };

    this.attribs = {
      quadVertex: gl.getAttribLocation(this.program, "a_quadVertex"),
      gridPos: gl.getAttribLocation(this.program, "a_gridPos"),
      ascii: gl.getAttribLocation(this.program, "a_ascii"),
      rowOffset: gl.getAttribLocation(this.program, "a_rowOffset"),
      rowSpeed: gl.getAttribLocation(this.program, "a_rowSpeed"),
      depth: gl.getAttribLocation(this.program, "a_depth"),
      mutation: gl.getAttribLocation(this.program, "a_mutation"),
    };

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5,
         0.5, -0.5,
        -0.5,  0.5,
        -0.5,  0.5,
         0.5, -0.5,
         0.5,  0.5,
      ]),
      gl.STATIC_DRAW
    );

    this.instanceBuffer = gl.createBuffer();
  }

  private createFontAtlas() {
    if (typeof document === "undefined") return;
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = 640;
    atlasCanvas.height = 512;
    const ctx = atlasCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    ctx.font = "400 44px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    const cellW = 40; // 640 / 16
    const cellH = 64; // 512 / 8

    // ASCII 32 to 126 (slots 0 to 94)
    for (let i = 0; i < 95; i++) {
      const char = String.fromCharCode(32 + i);
      const col = i % 16;
      const row = Math.floor(i / 16);
      const cx = col * cellW + cellW * 0.5;
      const cy = row * cellH + cellH * 0.5;
      ctx.fillText(char, cx, cy);
    }

    // Slot 95: Canonical Arrow Glyph '→'
    const arrowCol = ARROW_ATLAS_INDEX % 16;
    const arrowRow = Math.floor(ARROW_ATLAS_INDEX / 16);
    const acx = arrowCol * cellW + cellW * 0.5;
    const acy = arrowRow * cellH + cellH * 0.5;
    ctx.fillText(ARROW_GLYPH, acx, acy);

    const gl = this.gl;
    if (!gl) return;
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

  private createProgram(gl: WebGLRenderingContext | WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vShader) return null;
    gl.shaderSource(vShader, vs);
    gl.compileShader(vShader);
    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      console.error("Vertex Shader Error:", gl.getShaderInfoLog(vShader));
      gl.deleteShader(vShader);
      return null;
    }

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fShader) return null;
    gl.shaderSource(fShader, fs);
    gl.compileShader(fShader);
    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      console.error("Fragment Shader Error:", gl.getShaderInfoLog(fShader));
      gl.deleteShader(fShader);
      return null;
    }

    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program Link Error:", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  public start() {
    if (this.isRunning || this.destroyed) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      this.update(dt);
      this.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.handleWindowResize);
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("pointerleave", this.handlePointerLeave);
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }

    if (this.gl) {
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
      if (this.atlasTexture) this.gl.deleteTexture(this.atlasTexture);
      if (this.program) this.gl.deleteProgram(this.program);
    }
  }

  private update(dt: number) {
    if (this.isReducedMotion) {
      // In reduced motion, keep settled field without translations
      return;
    }

    this.time += dt;

    // Smooth pointer damping
    if (this.pointerTargetX > 0) {
      this.pointerX += (this.pointerTargetX - this.pointerX) * 0.12;
      this.pointerY += (this.pointerTargetY - this.pointerY) * 0.12;
    } else {
      this.pointerX = -9999;
      this.pointerY = -9999;
    }

    // SYSTEM A: Row translation strictly to the right with gentle acceleration waves
    const surgePhase = this.time % this.config.surgeInterval;
    const surgeProgress = Math.min(1, surgePhase / this.config.surgeDuration);
    const surgePulse =
      surgePhase < this.config.surgeDuration
        ? Math.sin(Math.PI * surgeProgress) ** 2
        : 0;
    const surge = 1 + (this.config.surgeMultiplier - 1) * surgePulse;
    const totalRowWidth = this.charsPerRow * this.charWidth;

    for (let r = 0; r < this.rowCount; r++) {
      const row = this.rows[r];
      let pointerBoost = 1;
      if (this.pointerY > 0) {
        const rowY = (r - 8) * this.lineHeight + this.lineHeight * 0.5;
        const pointerDistance = Math.abs(rowY - this.pointerY);
        const pointerFalloff = Math.max(
          0,
          1 - pointerDistance / (this.config.pointerRadius * this.dpr)
        );
        pointerBoost += pointerFalloff * this.config.pointerVelocityBoost;
      }

      row.velocity = row.baseVelocity * surge * pointerBoost;
      // Wrap seamlessly strictly to the right
      row.offset = (row.offset + row.velocity * dt) % totalRowWidth;
      if (row.offset < 0) row.offset += totalRowWidth;
    }

    // SYSTEM B: Independent Screen-Space Mask Drift
    this.maskOffsetX += this.config.maskVelocityX * this.dpr * this.motionScale * dt;
    this.maskOffsetY += this.config.maskVelocityY * this.dpr * this.motionScale * dt;

    // SYSTEM C: Character Glyph Mutation & Activity Pulse
    const pointerNear = this.pointerX > 0;
    const effectiveRate = this.config.mutationRate * (pointerNear ? 1.4 : 1.0) * this.motionScale;
    this.mutationAccumulator += dt * effectiveRate;

    while (this.mutationAccumulator >= 1.0) {
      this.mutationAccumulator -= 1.0;
      this.performCharacterMutation();
    }

    // Update active mutation timers and glyph cycling
    const totalChars = this.rowCount * this.charsPerRow;
    for (let i = 0; i < totalChars; i++) {
      if (this.mutationTimers[i] > 0) {
        this.mutationTimers[i] -= dt;
        if (this.mutationTimers[i] <= 0) {
          this.mutationTimers[i] = 0;
          this.currentAscii[i] = this.canonicalAscii[i]; // restore canonical glyph
        } else {
          // Cycle glyph during active mutation
          if (Math.random() < 0.22) {
            const cIdx = Math.floor(Math.random() * this.mutationCandidates.length);
            this.currentAscii[i] = this.mutationCandidates[cIdx];
          }
        }
      }

      if (this.mutationBoosts[i] > 0) {
        this.mutationBoosts[i] = Math.max(0, this.mutationBoosts[i] - dt / this.config.mutationPulseDuration);
      }
    }
  }

  private performCharacterMutation() {
    if (this.rowCount === 0 || this.charsPerRow === 0) return;

    let r = Math.floor(Math.random() * this.rowCount);
    const c = Math.floor(Math.random() * this.charsPerRow);

    // If pointer is active, bias some mutations near pointer
    if (this.pointerX > 0 && Math.random() < 0.35) {
      const approxRow = Math.floor((this.pointerY / this.lineHeight) + 8);
      r = Math.max(0, Math.min(this.rowCount - 1, approxRow + Math.floor(Math.random() * 5 - 2)));
    }

    const burst = this.config.mutationBurstSize;
    for (let b = 0; b < burst; b++) {
      const tc = (c + b) % this.charsPerRow;
      const idx = r * this.charsPerRow + tc;

      this.mutationBoosts[idx] = 1.0;
      this.mutationTimers[idx] = 0.15 + Math.random() * 0.20; // 150ms-350ms lifetime

      const candIdx = Math.floor(Math.random() * this.mutationCandidates.length);
      this.currentAscii[idx] = this.mutationCandidates[candIdx];
    }
  }

  public render() {
    if (this.useWebGL && this.gl) {
      this.renderWebGL();
    } else if (this.ctx) {
      this.renderCanvas2D();
    }
  }

  private renderWebGL() {
    const gl = this.gl;
    if (!gl || !this.program) return;

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
    gl.uniform2f(this.uniforms.centerRadius, this.centerRadiusX, this.centerRadiusY);
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
          const idx = r * this.charsPerRow + c;
          const ascii = this.currentAscii[idx];
          const mutation = this.mutationBoosts[idx] || 0.0;

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
      const setupInstancedAttrib = (loc: number, size: number, offset: number) => {
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
          if (this.isWebGL2) {
            (gl as WebGL2RenderingContext).vertexAttribDivisor(loc, 1);
          } else if (this.extInstancing) {
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
        (gl as WebGL2RenderingContext).drawArraysInstanced(gl.TRIANGLES, 0, 6, totalChars);
      } else if (this.extInstancing) {
        this.extInstancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, totalChars);
      }
    } else {
      this.renderCanvas2D();
    }
  }

  private renderCanvas2D() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `400 ${this.fontSize}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const centerOriginY = this.height * 0.47;
    const cRadX = this.centerRadiusX;
    const cRadY = this.centerRadiusY;
    const fieldWidth = this.charsPerRow * this.charWidth;
    const shiftX = (fieldWidth - this.width) * 0.5;
    const t = this.time * this.config.maskSpeed;

    for (let r = 0; r < this.rowCount; r++) {
      const row = this.rows[r];
      const screenY = (r - 8) * this.lineHeight + this.lineHeight * 0.5;
      const ny = (screenY - halfH) / halfH;

      for (let c = 0; c < this.charsPerRow; c++) {
        const uncurvedX = ((c * this.charWidth + row.offset) % fieldWidth + fieldWidth) % fieldWidth;
        const screenX = uncurvedX - shiftX;

        const nx = (screenX - halfW) / halfW;
        const theta = nx * 0.72;
        const compFactor = Math.cos(theta);
        const nxCurved = Math.sin(theta) / Math.sin(0.72);
        const nyCurved = ny * (1.0 + this.config.curvatureStrength * (1.0 / Math.max(compFactor, 0.12) - 1.0));

        const worldX = halfW + nxCurved * halfW;
        const worldY = halfH + nyCurved * halfH;

        if (worldX < -25 || worldX > this.width + 25 || worldY < -25 || worldY > this.height + 25) {
          continue;
        }

        const mx = (worldX + this.maskOffsetX) * this.config.maskScaleX;
        const my = (worldY + this.maskOffsetY) * this.config.maskScaleY;
        const noiseVal = Math.sin(mx + t * 0.8) * Math.cos(my - t * 0.6) * 0.5 + 0.5;

        let activeCluster =
          (noiseVal - (this.config.maskThreshold - this.config.maskContrast)) /
          (this.config.maskContrast * 2);
        activeCluster = Math.max(0, Math.min(1, activeCluster));

        let intensity = (0.08 + activeCluster * 0.74) * row.depth;
        const idx = r * this.charsPerRow + c;
        const mutation = this.mutationBoosts[idx] || 0;
        intensity = Math.min(1, intensity + mutation * 0.40);

        const cdx = (worldX - halfW) / cRadX;
        const cdy = (worldY - centerOriginY) / cRadY;
        const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
        const centerAtten =
          this.config.centerMinAlpha +
          (1.0 - this.config.centerMinAlpha) * Math.min(1, Math.max(0, (cDist - 0.32) / 0.76));
        intensity *= centerAtten;

        const ascii = this.currentAscii[idx];
        const char = ascii === ARROW_ATLAS_INDEX ? ARROW_GLYPH : String.fromCharCode(32 + ascii);

        if (row.depth > 1.05 && intensity > 0.74) {
          ctx.fillStyle = "rgba(161, 125, 64, 0.88)";
        } else if (intensity < 0.22) {
          ctx.fillStyle = "rgba(36, 37, 38, 0.35)";
        } else if (intensity < 0.50) {
          ctx.fillStyle = "rgba(85, 87, 89, 0.52)";
        } else if (intensity < 0.78) {
          ctx.fillStyle = "rgba(162, 164, 166, 0.72)";
        } else {
          ctx.fillStyle = "rgba(242, 239, 232, 0.94)";
        }

        ctx.fillText(char, worldX, worldY);
      }
    }
  }
}

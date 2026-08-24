/**
 * The navigation layer's real-time scene.
 *
 * Six draw calls: one `LineSegments` carrying every line in the system (rings,
 * node circles, ticks, icons, the mark, the connections and the burst ring),
 * and one `Points` carrying every particle. Everything that changes with state
 * changes in a shader, driven by uniforms — the buffers are rebuilt only when
 * the layout does, which is to say on resize.
 *
 * The scene draws into its own canvas over the homepage rather than into the
 * homepage's renderer. That is the same compositing the intro already uses,
 * and it keeps this layer from having to be threaded through a 1,200-line
 * imperative effect it does not own. What it shares with the scene underneath
 * is the thing that actually matters: the viewport contract, so both are
 * measuring one composition rather than two.
 */

import * as THREE from "three";
import {
  CAMERA_FOV,
  CAMERA_Z,
  type QualityTier,
  type ViewportSnapshot,
} from "@/components/graphics/viewport";
import { ICON_GRID, ICON_PATHS } from "./icon-paths";
import { LION_MARK_PATHS, MARK_GRID } from "./lion-mark";
import {
  bezierPoint,
  connectionControlPoint,
  computeNavLayout,
  type NavLayout,
} from "./ring-geometry";
import {
  flattenPaths,
  normalise,
  sampleByArcLength,
  toLineSegments,
  type Polylines,
} from "./path-sampling";
import { SECTIONS, SECTION_COUNT, type SectionId } from "./sections";
import {
  RECESSION_ACTIVE,
  RECESSION_AT_REST,
  TRANSFER_MS,
  type NavigationSnapshot,
} from "./navigation-state";

/* ------------------------------------------------------------------ *
 * Budget
 * ------------------------------------------------------------------ */

interface Budget {
  particles: number;
  travellers: number;
  ringLoops: number;
  haloPerNode: number;
  orbital: number;
}

const BUDGETS: Record<QualityTier, Budget> = {
  ultra: { particles: 8000, travellers: 240, ringLoops: 5, haloPerNode: 120, orbital: 420 },
  high: { particles: 5000, travellers: 160, ringLoops: 4, haloPerNode: 90, orbital: 300 },
  medium: { particles: 3000, travellers: 80, ringLoops: 3, haloPerNode: 55, orbital: 180 },
  low: { particles: 1500, travellers: 40, ringLoops: 2, haloPerNode: 30, orbital: 90 },
  fallback: { particles: 0, travellers: 0, ringLoops: 0, haloPerNode: 0, orbital: 0 },
};

/* Roles, shared between the buffer builder and the shader. */
const ROLE_RING = 0;
const ROLE_NODE = 1;
const ROLE_TICK = 2;
const ROLE_ICON = 3;
const ROLE_MARK = 4;
const ROLE_CONNECTION = 5;
/** Graduations around the outer ring; the four cardinals are drawn longer. */
const ROLE_GRADUATION = 6;
/** The faint second ring around each node. */
const ROLE_HALO = 7;
const ROLE_BURST = 8;

/* Particle categories. */
const CAT_AMBIENT = 0;
const CAT_ORBITAL = 1;
const CAT_HALO = 2;
const CAT_TRAVELLER = 3;
const CAT_MARK = 4;

const BURST_MS = 620;

/**
 * How far out the concentric rings reach, as a fraction of the node ring.
 *
 * The references cluster them around the centre mark and leave the space
 * between there and the nodes almost empty. Running them all the way out to
 * the nodes turns the composition into a target rather than an orbit.
 */
const RING_BAND = 0.58;
const BURST_RADIUS_IN_NODE_RADII = 0.9;

/** Deterministic noise, so the field is stable enough to feel designed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface NodeRuntime {
  hover: number;
  active: number;
  focus: number;
  /** Eased faster than `hover`: the field reacts before the node brightens. */
  attract: number;
}

export interface NavSceneOptions {
  canvas: HTMLCanvasElement;
  getState: () => NavigationSnapshot;
  /** What the layer asks the background for, 0..1. */
  onRecession: (value: number) => void;
  /**
   * Both layouts, so the DOM can travel between them on the same eased value
   * the shader uses.
   */
  onLayout: (
    closed: NavLayout,
    open: NavLayout,
    snapshot: ViewportSnapshot,
  ) => void;
  /** World-space box the content panel occupies, if one is open. */
  getPanelRect: () => DOMRect | null;
  /**
   * The eased open/closed value, 0..1.
   *
   * The DOM half is driven from here rather than from a CSS transition of its
   * own: the drawn circle and the focusable circle have to stay exactly
   * coincident, and two easings of one value never quite agree.
   */
  onOpen: (t: number) => void;
}

export class NavScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private lines: THREE.LineSegments | null = null;
  private points: THREE.Points | null = null;
  private lineMaterial: THREE.ShaderMaterial;
  private pointMaterial: THREE.ShaderMaterial;

  private snapshot: ViewportSnapshot;
  /** The ring with the frame to itself, and the ring sharing it with a panel. */
  private layout: NavLayout;
  private layoutOpen: NavLayout;
  private budget: Budget;
  private options: NavSceneOptions;

  private nodes: NodeRuntime[] = SECTIONS.map(() => ({
    hover: 0,
    active: 0,
    focus: 0,
    attract: 0,
  }));

  private rise = 0;
  private open = 0;
  private recession = RECESSION_AT_REST;
  private burstAt = -1;
  private burstNode = -1;
  private clock = new THREE.Clock();
  private frame = 0;
  private elapsed = 0;
  private disposed = false;

  constructor(options: NavSceneOptions, snapshot: ViewportSnapshot) {
    this.options = options;
    this.snapshot = snapshot;
    this.budget = BUDGETS[snapshot.tier];
    this.layout = computeNavLayout(snapshot, false);
    this.layoutOpen = computeNavLayout(snapshot, true);

    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(snapshot.dpr);
    this.renderer.setSize(snapshot.width, snapshot.height, false);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      snapshot.aspect,
      0.1,
      60,
    );
    this.camera.position.set(0, 0, CAMERA_Z);

    this.lineMaterial = createLineMaterial();
    this.pointMaterial = createPointMaterial();

    this.build();
    this.options.onLayout(this.layout, this.layoutOpen, this.snapshot);
  }

  /**
   * The layout as it stands between the two baked ones. The particle system
   * reads its geometry from uniforms rather than from a buffer, so it simply
   * travels; only the line buffer needs both positions baked.
   */
  private current(): NavLayout {
    const t = this.open;
    if (t <= 0) return this.layout;
    if (t >= 1) return this.layoutOpen;
    const a = this.layout;
    const b = this.layoutOpen;
    const mix = (x: number, y: number) => x + (y - x) * t;
    return {
      ...a,
      centerX: mix(a.centerX, b.centerX),
      centerY: mix(a.centerY, b.centerY),
      radiusX: mix(a.radiusX, b.radiusX),
      radiusY: mix(a.radiusY, b.radiusY),
      nodeRadius: mix(a.nodeRadius, b.nodeRadius),
      nodeHaloRadius: mix(a.nodeHaloRadius, b.nodeHaloRadius),
      coreRadius: mix(a.coreRadius, b.coreRadius),
      nodes: a.nodes.map((node, i) => ({
        ...node,
        x: mix(node.x, b.nodes[i].x),
        y: mix(node.y, b.nodes[i].y),
      })),
    };
  }

  /* ---------------------------------------------------------------- *
   * Geometry
   * ---------------------------------------------------------------- */

  private build() {
    this.disposeObjects();
    this.buildLines();
    this.buildParticles();
  }

  /**
   * Every line in the system, for one layout, as flat rows of
   * `[anchorX, anchorY, localX0, localY0, localX1, localY1, node, role, param]`.
   *
   * Emitted rather than built directly because it is run twice — once for the
   * ring with the frame to itself, once for the ring sharing it with a panel —
   * and the two results are zipped into one buffer the shader travels along.
   * The emission order is deterministic, so row *i* describes the same vertex
   * in both.
   */
  private emitLines(layout: NavLayout): number[] {
    const rows: number[] = [];

    const push = (
      ax: number,
      ay: number,
      lx0: number,
      ly0: number,
      lx1: number,
      ly1: number,
      node: number,
      role: number,
      param: number,
    ) => {
      rows.push(ax, ay, lx0, ly0, lx1, ly1, node, role, param);
    };

    /* --- concentric rings around the hub (GRAPHIC 02) --- */
    const loops = this.budget.ringLoops;
    for (let loop = 0; loop < loops; loop += 1) {
      const t = loops === 1 ? 1 : loop / (loops - 1);
      const rx =
        layout.coreRadius + (layout.radiusX * RING_BAND - layout.coreRadius) * t;
      const ry =
        layout.coreRadius + (layout.radiusY * RING_BAND - layout.coreRadius) * t;
      const segments = 160;
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        push(
          layout.centerX,
          layout.centerY,
          Math.cos(a0) * rx,
          Math.sin(a0) * ry,
          Math.cos(a1) * rx,
          Math.sin(a1) * ry,
          -1,
          ROLE_RING,
          t,
        );
      }
    }

    /* --- graduations around the outer ring --- */
    {
      const ticks = this.budget.ringLoops > 0 ? layout.tickCount : 0;
      for (let i = 0; i < ticks; i += 1) {
        const angle = (i / ticks) * Math.PI * 2;
        const cardinal = i % (ticks / 4) === 0;
        // Graduated against the outermost concentric ring, not the node ring.
        const rx = layout.radiusX * RING_BAND;
        const ry = layout.radiusY * RING_BAND;
        const inner = cardinal ? 0.955 : 0.978;
        const outer = cardinal ? layout.cardinalScale : 1.0;
        push(
          layout.centerX,
          layout.centerY,
          Math.cos(angle) * rx * inner,
          Math.sin(angle) * ry * inner,
          Math.cos(angle) * rx * outer,
          Math.sin(angle) * ry * outer,
          -1,
          ROLE_GRADUATION,
          cardinal ? 1 : 0,
        );
      }
    }

    /* --- connections (GRAPHIC 06) --- */
    for (const node of layout.nodes) {
      const control = connectionControlPoint(layout, node);
      const from = { x: layout.centerX, y: layout.centerY };
      const to = { x: node.x, y: node.y };
      const segments = 48;
      for (let i = 0; i < segments; i += 1) {
        const p0 = bezierPoint(from, control, to, i / segments);
        const p1 = bezierPoint(from, control, to, (i + 1) / segments);
        push(
          0,
          0,
          p0.x,
          p0.y,
          p1.x,
          p1.y,
          node.index,
          ROLE_CONNECTION,
          i / segments,
        );
      }
    }

    /* --- node circles and ticks (GRAPHIC 03) --- */
    for (const node of layout.nodes) {
      const r = layout.nodeRadius;
      const segments = 72;
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        push(
          node.x,
          node.y,
          Math.cos(a0) * r,
          Math.sin(a0) * r,
          Math.cos(a1) * r,
          Math.sin(a1) * r,
          node.index,
          ROLE_NODE,
          0,
        );
      }
      const halo = layout.nodeHaloRadius;
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        push(
          node.x,
          node.y,
          Math.cos(a0) * halo,
          Math.sin(a0) * halo,
          Math.cos(a1) * halo,
          Math.sin(a1) * halo,
          node.index,
          ROLE_HALO,
          0,
        );
      }

      const ticks = 8;
      for (let i = 0; i < ticks; i += 1) {
        const a = (i / ticks) * Math.PI * 2 + Math.PI / ticks;
        push(
          node.x,
          node.y,
          Math.cos(a) * r * 1.22,
          Math.sin(a) * r * 1.22,
          Math.cos(a) * r * 1.34,
          Math.sin(a) * r * 1.34,
          node.index,
          ROLE_TICK,
          0,
        );
      }
    }

    /* --- icons, from the same path data the particles sample (GRAPHIC 13) --- */
    for (const node of layout.nodes) {
      const icon = SECTIONS[node.index].icon;
      const polylines = normalise(flattenPaths(ICON_PATHS[icon]), {
        grid: ICON_GRID,
      });
      const segments = toLineSegments(polylines);
      const scale = layout.nodeRadius * 1.05;
      for (let i = 0; i < segments.length; i += 4) {
        push(
          node.x,
          node.y,
          segments[i] * scale,
          segments[i + 1] * scale,
          segments[i + 2] * scale,
          segments[i + 3] * scale,
          node.index,
          ROLE_ICON,
          0,
        );
      }
    }

    /* --- the central mark (GRAPHIC 12) --- */
    {
      const polylines = markPolylines();
      const segments = toLineSegments(polylines);
      const scale = layout.coreRadius * 1.5;
      for (let i = 0; i < segments.length; i += 4) {
        push(
          layout.centerX,
          layout.centerY,
          segments[i] * scale,
          segments[i + 1] * scale,
          segments[i + 2] * scale,
          segments[i + 3] * scale,
          -1,
          ROLE_MARK,
          0,
        );
      }
    }

    /* --- the burst ring (GRAPHIC 10), a unit circle placed by uniform --- */
    {
      const segments = 96;
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        push(
          0,
          0,
          Math.cos(a0),
          Math.sin(a0),
          Math.cos(a1),
          Math.sin(a1),
          -1,
          ROLE_BURST,
          0,
        );
      }
    }

    return rows;
  }

  private buildLines() {
    const closed = this.emitLines(this.layout);
    const open = this.emitLines(this.layoutOpen);
    if (closed.length !== open.length) {
      throw new Error("Layout emission diverged between open and closed");
    }

    const segments = closed.length / 9;
    const positions = new Float32Array(segments * 6);
    const anchors = new Float32Array(segments * 4);
    const anchorsOpen = new Float32Array(segments * 4);
    const locals = new Float32Array(segments * 4);
    const localsOpen = new Float32Array(segments * 4);
    const nodeIds = new Float32Array(segments * 2);
    const roles = new Float32Array(segments * 2);
    const params = new Float32Array(segments * 2);

    for (let i = 0; i < segments; i += 1) {
      const r = i * 9;
      const [ax, ay, lx0, ly0, lx1, ly1, node, role, param] = closed.slice(
        r,
        r + 9,
      );
      const oax = open[r];
      const oay = open[r + 1];

      positions.set([ax + lx0, ay + ly0, 0, ax + lx1, ay + ly1, 0], i * 6);
      anchors.set([ax, ay, ax, ay], i * 4);
      anchorsOpen.set([oax, oay, oax, oay], i * 4);
      locals.set([lx0, ly0, lx1, ly1], i * 4);
      localsOpen.set(
        [open[r + 2], open[r + 3], open[r + 4], open[r + 5]],
        i * 4,
      );
      nodeIds.set([node, node], i * 2);
      roles.set([role, role], i * 2);
      params.set([param, param], i * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAnchor", new THREE.BufferAttribute(anchors, 2));
    geometry.setAttribute("aAnchorOpen", new THREE.BufferAttribute(anchorsOpen, 2));
    geometry.setAttribute("aLocal", new THREE.BufferAttribute(locals, 2));
    geometry.setAttribute("aLocalOpen", new THREE.BufferAttribute(localsOpen, 2));
    geometry.setAttribute("aNode", new THREE.BufferAttribute(nodeIds, 1));
    geometry.setAttribute("aRole", new THREE.BufferAttribute(roles, 1));
    geometry.setAttribute("aParam", new THREE.BufferAttribute(params, 1));
    /* The burst ring travels; a static bounding sphere would cull it. */
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

    this.lines = new THREE.LineSegments(geometry, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  private buildParticles() {
    const total = this.budget.particles;
    if (total === 0) return;

    const layout = this.layout;
    const random = seeded(0x10a5);

    const markTarget = sampleByArcLength(markPolylines(), 320);
    const markCount = Math.min(320, Math.floor(total * 0.06));
    const haloCount = this.budget.haloPerNode * SECTION_COUNT;
    const travellerCount = this.budget.travellers;
    const orbitalCount = this.budget.orbital;
    const ambientCount = Math.max(
      0,
      total - markCount - haloCount - travellerCount - orbitalCount,
    );

    const positions = new Float32Array(total * 3);
    const homes = new Float32Array(total * 3);
    const targets = new Float32Array(total * 3);
    const targetsOpen = new Float32Array(total * 3);
    const seeds = new Float32Array(total);
    const categories = new Float32Array(total);
    const nodeIds = new Float32Array(total);
    const params = new Float32Array(total);

    let index = 0;
    const place = (
      category: number,
      node: number,
      param: number,
      home: [number, number, number],
      target: [number, number, number],
      targetOpen: [number, number, number] = target,
    ) => {
      positions[index * 3] = home[0];
      positions[index * 3 + 1] = home[1];
      positions[index * 3 + 2] = home[2];
      homes[index * 3] = home[0];
      homes[index * 3 + 1] = home[1];
      homes[index * 3 + 2] = home[2];
      targets[index * 3] = target[0];
      targets[index * 3 + 1] = target[1];
      targets[index * 3 + 2] = target[2];
      targetsOpen[index * 3] = targetOpen[0];
      targetsOpen[index * 3 + 1] = targetOpen[1];
      targetsOpen[index * 3 + 2] = targetOpen[2];
      seeds[index] = random();
      categories[index] = category;
      nodeIds[index] = node;
      params[index] = param;
      index += 1;
    };

    /* Ambient field: the population every other state borrows from. */
    for (let i = 0; i < ambientCount; i += 1) {
      const depth = random();
      place(
        CAT_AMBIENT,
        -1,
        random(),
        [
          (random() * 2 - 1) * this.snapshot.halfW * 1.05,
          (random() * 2 - 1) * this.snapshot.halfH * 1.05,
          -2 + depth * 2.4,
        ],
        [0, 0, 0],
      );
    }

    /* Orbital particles riding the rings. */
    for (let i = 0; i < orbitalCount; i += 1) {
      const loop = Math.floor(random() * Math.max(1, this.budget.ringLoops));
      const t =
        this.budget.ringLoops <= 1
          ? 1
          : loop / (this.budget.ringLoops - 1);
      place(CAT_ORBITAL, -1, random(), [t, random(), 0], [0, 0, 0]);
    }

    /* Node halos. */
    for (let n = 0; n < SECTION_COUNT; n += 1) {
      for (let i = 0; i < this.budget.haloPerNode; i += 1) {
        place(CAT_HALO, n, random(), [random(), random(), 0], [0, 0, 0]);
      }
    }

    /* Travellers along the connections. */
    for (let i = 0; i < travellerCount; i += 1) {
      const node = i % SECTION_COUNT;
      place(CAT_TRAVELLER, node, random(), [random(), 0, 0], [0, 0, 0]);
    }

    /* Mark particles, targeting points sampled along the mark's own path —
       in both layouts. Baking only the closed one drew the mark twice: the
       lines travelled to the open centre while the particles stayed behind and
       reassembled the emblem where the ring used to be. */
    const markScale = layout.coreRadius * 1.5;
    const markScaleOpen = this.layoutOpen.coreRadius * 1.5;
    for (let i = 0; i < markCount; i += 1) {
      const s = (i % 320) * 2;
      place(
        CAT_MARK,
        -1,
        random(),
        [
          (random() * 2 - 1) * this.snapshot.halfW,
          (random() * 2 - 1) * this.snapshot.halfH,
          0,
        ],
        [
          layout.centerX + markTarget[s] * markScale,
          layout.centerY + markTarget[s + 1] * markScale,
          0,
        ],
        [
          this.layoutOpen.centerX + markTarget[s] * markScaleOpen,
          this.layoutOpen.centerY + markTarget[s + 1] * markScaleOpen,
          0,
        ],
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aHome", new THREE.BufferAttribute(homes, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
    geometry.setAttribute(
      "aTargetOpen",
      new THREE.BufferAttribute(targetsOpen, 3),
    );
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aCategory", new THREE.BufferAttribute(categories, 1));
    geometry.setAttribute("aNode", new THREE.BufferAttribute(nodeIds, 1));
    geometry.setAttribute("aParam", new THREE.BufferAttribute(params, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

    this.points = new THREE.Points(geometry, this.pointMaterial);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /* ---------------------------------------------------------------- *
   * Lifecycle
   * ---------------------------------------------------------------- */

  resize(snapshot: ViewportSnapshot) {
    const tierChanged = snapshot.tier !== this.snapshot.tier;
    this.snapshot = snapshot;
    this.budget = BUDGETS[snapshot.tier];
    this.layout = computeNavLayout(snapshot, false);
    this.layoutOpen = computeNavLayout(snapshot, true);

    this.renderer.setPixelRatio(snapshot.dpr);
    this.renderer.setSize(snapshot.width, snapshot.height, false);
    this.camera.aspect = snapshot.aspect;
    this.camera.updateProjectionMatrix();

    // Geometry is baked against the layout, so a layout change rebuilds it.
    // This happens on resize, never per frame.
    this.build();
    void tierChanged;
    this.options.onLayout(this.layout, this.layoutOpen, this.snapshot);
  }

  /** A node was activated; fire the convergence burst at it. */
  burst(node: number) {
    if (this.snapshot.reducedMotion) return;
    this.burstAt = performance.now();
    this.burstNode = node;
  }

  start() {
    const loop = () => {
      if (this.disposed) return;
      this.frame = requestAnimationFrame(loop);
      this.render();
    };
    this.frame = requestAnimationFrame(loop);
  }

  private render() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    const state = this.options.getState();
    const reduced = this.snapshot.reducedMotion;
    const ease = (current: number, target: number, rate: number) =>
      reduced ? target : current + (target - current) * Math.min(1, dt * rate);

    this.rise = ease(this.rise, 1, 1.6);

    /* Per-node state. Attraction is eased faster than luminance, so the field
       moves before the node brightens — the environment reacts first. */
    const stateArray = this.lineMaterial.uniforms.uNodeState
      .value as Float32Array;
    for (let i = 0; i < SECTION_COUNT; i += 1) {
      const id = SECTIONS[i].id;
      const runtime = this.nodes[i];
      const hovered =
        state.hoveredSection === id || state.focusedSection === id ? 1 : 0;
      runtime.hover = ease(runtime.hover, hovered, 4.2);
      runtime.focus = ease(runtime.focus, state.focusedSection === id ? 1 : 0, 6);
      runtime.active = ease(
        runtime.active,
        state.activeSection === id ? 1 : 0,
        3.4,
      );
      runtime.attract = ease(runtime.attract, hovered, 9);

      stateArray[i * 4] = runtime.hover;
      stateArray[i * 4 + 1] = runtime.active;
      stateArray[i * 4 + 2] = runtime.focus;
      stateArray[i * 4 + 3] = runtime.attract;
    }

    /* The strongest attractor, and only one: a field pulled toward two points
       at once reads as noise rather than as intent. */
    let attractIndex = -1;
    let attractStrength = 0;
    for (let i = 0; i < SECTION_COUNT; i += 1) {
      if (this.nodes[i].attract > attractStrength) {
        attractStrength = this.nodes[i].attract;
        attractIndex = i;
      }
    }
    const attract = this.lineMaterial.uniforms.uAttract.value as THREE.Vector4;
    const live = this.current();
    if (attractIndex >= 0 && !reduced) {
      const node = live.nodes[attractIndex];
      attract.set(node.x, node.y, attractStrength, live.nodeRadius * 6.5);
    } else {
      attract.set(0, 0, 0, 1);
    }

    /* Section transfer. */
    const transfer = this.pointMaterial.uniforms.uTransfer.value as THREE.Vector4;
    if (state.transition) {
      const progress = Math.min(
        1,
        (performance.now() - state.transition.startedAt) / TRANSFER_MS,
      );
      const from = state.transition.from
        ? SECTIONS.findIndex((s) => s.id === state.transition!.from)
        : -1;
      const to = state.transition.to
        ? SECTIONS.findIndex((s) => s.id === state.transition!.to)
        : -1;
      transfer.set(from, to, reduced ? 1 : progress, 1);
    } else {
      transfer.set(-1, -1, 0, 0);
    }

    /* Recession: what the layer below is asked for. */
    const wanted = state.activeSection ? RECESSION_ACTIVE : RECESSION_AT_REST;
    this.recession = ease(this.recession, wanted, 3.4);
    this.options.onRecession(this.recession);

    /* The convergence burst. */
    const burstUniform = this.lineMaterial.uniforms.uBurst.value as THREE.Vector4;
    if (this.burstAt > 0 && this.burstNode >= 0) {
      const progress = (performance.now() - this.burstAt) / BURST_MS;
      if (progress >= 1) {
        this.burstAt = -1;
        this.burstNode = -1;
        burstUniform.set(0, 0, 0, 0);
      } else {
        const node = live.nodes[this.burstNode];
        burstUniform.set(node.x, node.y, progress, 1);
      }
    }

    /* The exclusion field around any open panel, and the room the navigation
       makes for it. The panel is the one element that cannot move, so the
       constellation is what steps aside — which is what the reference shows:
       the ring on one side of the frame, the reading on the other. */
    const panelRect = this.options.getPanelRect();
    this.open = ease(this.open, state.activeSection ? 1 : 0, 3.0);
    this.options.onOpen(this.open);

    const panel = this.pointMaterial.uniforms.uPanel.value as THREE.Vector4;
    const panelStrength = this.pointMaterial.uniforms
      .uPanelStrength as THREE.IUniform<number>;
    if (panelRect && panelRect.width > 0) {
      const cx =
        ((panelRect.left + panelRect.width / 2) / this.snapshot.width) * 2 - 1;
      const cy =
        1 - ((panelRect.top + panelRect.height / 2) / this.snapshot.height) * 2;
      panel.set(
        cx * this.snapshot.halfW,
        cy * this.snapshot.halfH,
        (panelRect.width / this.snapshot.width) * this.snapshot.halfW,
        (panelRect.height / this.snapshot.height) * this.snapshot.halfH,
      );
      panelStrength.value = ease(panelStrength.value, 1, 3.2);
    } else {
      panelStrength.value = ease(panelStrength.value, 0, 3.2);
    }

    /* Shared uniforms. */
    this.syncUniforms(live);
    this.renderer.render(this.scene, this.camera);
  }

  private syncUniforms(layout: NavLayout) {
    const line = this.lineMaterial.uniforms;
    const point = this.pointMaterial.uniforms;

    (line.uOpen as THREE.IUniform<number>).value = this.open;
    (point.uOpen as THREE.IUniform<number>).value = this.open;
    line.uTime.value = this.elapsed;
    line.uRise.value = this.rise;
    line.uRecession.value = this.recession;
    line.uReduced.value = this.snapshot.reducedMotion ? 1 : 0;
    (line.uBurstRadius as THREE.IUniform<number>).value =
      layout.nodeRadius * BURST_RADIUS_IN_NODE_RADII * 2;

    point.uTime.value = this.elapsed;
    point.uRise.value = this.rise;
    point.uRecession.value = this.recession;
    point.uReduced.value = this.snapshot.reducedMotion ? 1 : 0;
    (point.uHalf.value as THREE.Vector2).set(
      this.snapshot.halfW,
      this.snapshot.halfH,
    );
    (point.uHub.value as THREE.Vector2).set(layout.centerX, layout.centerY);
    (point.uRingRadius.value as THREE.Vector2).set(
      layout.radiusX,
      layout.radiusY,
    );
    (point.uCoreRadius as THREE.IUniform<number>).value = layout.coreRadius;
    (point.uNodeRadius as THREE.IUniform<number>).value = layout.nodeRadius;
    (point.uSize as THREE.IUniform<number>).value =
      this.snapshot.tier === "low" ? 1.0 : 1.2;

    const nodePos = point.uNodePos.value as Float32Array;
    const nodeControl = point.uNodeControl.value as Float32Array;
    for (const node of layout.nodes) {
      nodePos[node.index * 2] = node.x;
      nodePos[node.index * 2 + 1] = node.y;
      const control = connectionControlPoint(layout, node);
      nodeControl[node.index * 2] = control.x;
      nodeControl[node.index * 2 + 1] = control.y;
    }
    (point.uNodeState.value as Float32Array).set(
      line.uNodeState.value as Float32Array,
    );
    (point.uAttract.value as THREE.Vector4).copy(
      line.uAttract.value as THREE.Vector4,
    );
    (point.uBurst.value as THREE.Vector4).copy(
      line.uBurst.value as THREE.Vector4,
    );
  }

  private disposeObjects() {
    for (const object of [this.lines, this.points]) {
      if (!object) continue;
      this.scene.remove(object);
      object.geometry.dispose();
    }
    this.lines = null;
    this.points = null;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.disposeObjects();
    this.lineMaterial.dispose();
    this.pointMaterial.dispose();
    this.renderer.dispose();
  }
}

function markPolylines(): Polylines {
  return normalise(flattenPaths(LION_MARK_PATHS), { grid: MARK_GRID });
}

/* ------------------------------------------------------------------ *
 * Shaders
 * ------------------------------------------------------------------ */

/** The palette, as the shader sees it. */
const GLSL_PALETTE = `
  const vec3 COLD_WHITE   = vec3(0.910, 0.937, 0.984);
  const vec3 BLUE_WHITE   = vec3(0.659, 0.737, 0.882);
  const vec3 ELECTRIC     = vec3(0.431, 0.608, 0.878);
  const vec3 GOLD         = vec3(0.788, 0.635, 0.153);
  const vec3 BRONZE       = vec3(0.549, 0.420, 0.184);
`;

/** Node state lookup without dynamic indexing, which not every context allows. */
const GLSL_NODE_LOOKUP = `
  vec4 nodeStateOf(float id) {
    vec4 found = vec4(0.0);
    for (int i = 0; i < 8; i++) {
      if (abs(float(i) - id) < 0.5) found = uNodeState[i];
    }
    return found;
  }
`;

function createLineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRise: { value: 0 },
      uRecession: { value: 0 },
      uReduced: { value: 0 },
      uNodeState: { value: new Float32Array(SECTION_COUNT * 4) },
      uAttract: { value: new THREE.Vector4() },
      uBurst: { value: new THREE.Vector4() },
      uBurstRadius: { value: 0.5 },
      uOpen: { value: 0 },
    },
    vertexShader: `
      attribute vec2 aAnchor;
      attribute vec2 aAnchorOpen;
      attribute vec2 aLocal;
      attribute vec2 aLocalOpen;
      attribute float aNode;
      attribute float aRole;
      attribute float aParam;

      uniform float uTime;
      uniform float uRise;
      uniform float uRecession;
      uniform float uReduced;
      uniform vec4 uNodeState[8];
      uniform vec4 uAttract;
      uniform vec4 uBurst;
      uniform float uBurstRadius;
      uniform float uOpen;

      varying vec3 vColor;
      varying float vAlpha;

      ${GLSL_PALETTE}
      ${GLSL_NODE_LOOKUP}

      void main() {
        vec4 st = aNode >= 0.0 ? nodeStateOf(aNode) : vec4(0.0);
        /* Where this vertex sits with the frame to itself, and where it sits
           once a panel has taken part of it. */
        vec2 anchor = mix(aAnchor, aAnchorOpen, uOpen);
        vec2 local = mix(aLocal, aLocalOpen, uOpen);
        float alpha = 0.0;
        vec3 color = BLUE_WHITE;

        float breath = uReduced > 0.5 ? 0.0 : sin(uTime * 0.42) * 0.004;

        if (aRole < 0.5) {
          // Concentric rings: breathing under half a percent.
          local *= 1.0 + breath;
          alpha = 0.15 + aParam * 0.05;
          color = mix(BLUE_WHITE, ELECTRIC, 0.35);
        } else if (aRole < 1.5) {
          // Node circle.
          local *= 1.0 + st.x * 0.05 + st.y * 0.09 + breath;
          alpha = 0.30 + st.x * 0.30 + st.y * 0.55;
          color = mix(BLUE_WHITE, GOLD, 0.28 + st.y * 0.55);
        } else if (aRole < 2.5) {
          // Ticks.
          local *= 1.0 + st.x * 0.06;
          alpha = 0.13 + st.x * 0.24 + st.y * 0.32;
          color = BLUE_WHITE;
        } else if (aRole < 3.5) {
          // Icon.
          local *= 1.0 + st.y * 0.04;
          alpha = 0.40 + st.x * 0.34 + st.y * 0.55;
          color = mix(BRONZE, GOLD, 0.4 + st.y * 0.6);
        } else if (aRole < 4.5) {
          // The mark takes the centre only once the lion has stepped back.
          alpha = smoothstep(0.5, 0.92, uRecession) * 0.62;
          color = mix(BRONZE, GOLD, 0.7);
        } else if (aRole < 5.5) {
          /* Connection: mostly invisible, with traffic passing along it. Gold
             belongs to the active path and to no other — st.y is nonzero for
             one node at a time. */
          float travel = uReduced > 0.5
            ? 0.0
            : exp(-pow(abs(fract(uTime * 0.22 - aParam * 0.85) - 0.5) * 6.0, 2.0));
          alpha = 0.075 + st.y * 0.22 + st.x * 0.06 + travel * (0.09 + st.y * 0.3);
          color = mix(ELECTRIC, GOLD, st.y * 0.85);
        } else if (aRole < 6.5) {
          // Graduations; the cardinals sit a touch brighter.
          local *= 1.0 + breath;
          alpha = 0.11 + aParam * 0.08;
          color = mix(BLUE_WHITE, COLD_WHITE, aParam * 0.5);
        } else if (aRole < 7.5) {
          // The node's faint outer ring, which opens as the node wakes.
          local *= 1.0 + st.x * 0.10 + st.y * 0.16;
          alpha = 0.09 + st.x * 0.12 + st.y * 0.18;
          color = mix(ELECTRIC, GOLD, st.y * 0.4);
        } else {
          // Burst ring: a unit circle, placed and sized by uniform.
          anchor = uBurst.xy;
          local = aLocal * uBurst.z * uBurstRadius;
          alpha = uBurst.w * (1.0 - uBurst.z) * (1.0 - uBurst.z) * 0.55;
          color = GOLD;
        }

        vec2 world = anchor + local;
        vColor = color;
        vAlpha = alpha * uRise;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.001) discard;
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
  });
}

function createPointMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRise: { value: 0 },
      uRecession: { value: 0 },
      uReduced: { value: 0 },
      uSize: { value: 1.4 },
      uHalf: { value: new THREE.Vector2(8, 4) },
      uHub: { value: new THREE.Vector2() },
      uRingRadius: { value: new THREE.Vector2(2, 2) },
      uCoreRadius: { value: 0.6 },
      uNodeRadius: { value: 0.25 },
      uNodePos: { value: new Float32Array(SECTION_COUNT * 2) },
      uNodeControl: { value: new Float32Array(SECTION_COUNT * 2) },
      uNodeState: { value: new Float32Array(SECTION_COUNT * 4) },
      uAttract: { value: new THREE.Vector4() },
      uBurst: { value: new THREE.Vector4() },
      uTransfer: { value: new THREE.Vector4(-1, -1, 0, 0) },
      uPanel: { value: new THREE.Vector4() },
      uPanelStrength: { value: 0 },
      uOpen: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aHome;
      attribute vec3 aTarget;
      attribute vec3 aTargetOpen;
      attribute float aSeed;
      attribute float aCategory;
      attribute float aNode;
      attribute float aParam;

      uniform float uTime;
      uniform float uRise;
      uniform float uRecession;
      uniform float uReduced;
      uniform float uSize;
      uniform vec2 uHalf;
      uniform vec2 uHub;
      uniform vec2 uRingRadius;
      uniform float uCoreRadius;
      uniform float uNodeRadius;
      uniform vec2 uNodePos[8];
      uniform vec2 uNodeControl[8];
      uniform vec4 uNodeState[8];
      uniform vec4 uAttract;
      uniform vec4 uBurst;
      uniform vec4 uTransfer;
      uniform vec4 uPanel;
      uniform float uPanelStrength;
      uniform float uOpen;

      varying vec3 vColor;
      varying float vAlpha;

      ${GLSL_PALETTE}
      ${GLSL_NODE_LOOKUP}

      vec2 nodePosOf(float id) {
        vec2 found = vec2(0.0);
        for (int i = 0; i < 8; i++) {
          if (abs(float(i) - id) < 0.5) found = uNodePos[i];
        }
        return found;
      }

      vec2 nodeControlOf(float id) {
        vec2 found = vec2(0.0);
        for (int i = 0; i < 8; i++) {
          if (abs(float(i) - id) < 0.5) found = uNodeControl[i];
        }
        return found;
      }

      vec2 quadratic(vec2 a, vec2 c, vec2 b, float t) {
        float u = 1.0 - t;
        return u * u * a + 2.0 * u * t * c + t * t * b;
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      /* Finite falloff: exactly zero beyond the radius, so the field has an
         edge and everything outside it is genuinely untouched. */
      float falloff(float d, float r) {
        float x = clamp(1.0 - d / r, 0.0, 1.0);
        return x * x * (3.0 - 2.0 * x);
      }

      void main() {
        vec3 pos = aHome;
        float alpha = 0.0;
        vec3 color = BLUE_WHITE;
        float size = 1.0;
        float motion = uReduced > 0.5 ? 0.0 : 1.0;

        if (aCategory < 0.5) {
          /* Ambient field: horizontal drift in both directions, layered by
             depth, wrapped so the field never runs out. */
          float depth = 0.3 + aSeed * 0.7;
          float dir = hash(vec2(aSeed, 3.7)) < 0.5 ? -1.0 : 1.0;
          float speed = (0.035 + depth * 0.16) * dir * motion;
          float x = aHome.x + uTime * speed;
          float span = uHalf.x * 2.2;
          x = mod(x + span * 0.5, span) - span * 0.5;
          pos = vec3(
            x,
            aHome.y + sin(uTime * 0.17 * motion + aSeed * 21.0) * 0.035,
            aHome.z
          );
          alpha = (0.03 + depth * 0.075) * (1.0 - uRecession * 0.15);
          size = 0.55 + depth * 0.6;
          color = mix(ELECTRIC, COLD_WHITE, depth * 0.6);
        } else if (aCategory < 1.5) {
          /* Orbital particles riding the concentric rings. */
          float t = aHome.x;
          vec2 radius = mix(vec2(uCoreRadius), uRingRadius, t);
          float rate = 0.03 + hash(vec2(aSeed, 1.3)) * 0.05;
          float dir = t > 0.5 ? 1.0 : -1.0;
          float angle = aParam * 6.2831853 + uTime * rate * dir * motion;
          pos = vec3(
            uHub.x + cos(angle) * radius.x,
            uHub.y + sin(angle) * radius.y,
            0.0
          );
          alpha = 0.10 + aHome.y * 0.10;
          size = 0.7 + aHome.y * 0.5;
          color = mix(BLUE_WHITE, COLD_WHITE, aHome.y);
        } else if (aCategory < 2.5) {
          /* Node halo: sparse at rest, drawn tighter as the node wakes. */
          vec4 st = nodeStateOf(aNode);
          vec2 centre = nodePosOf(aNode);
          float angle = aParam * 6.2831853 + uTime * 0.09 * motion;
          float spread = 1.28 - st.x * 0.16 - st.y * 0.22;
          float radius = uNodeRadius * (1.05 + aHome.x * spread);
          pos = vec3(
            centre.x + cos(angle) * radius,
            centre.y + sin(angle) * radius,
            0.0
          );
          alpha = 0.05 + st.x * 0.16 + st.y * 0.24 + aHome.y * 0.05;
          size = 0.6 + aHome.y * 0.5 + st.y * 0.4;
          /* Gold reaches 1.5 node radii and stops. The halo itself extends
             further than that, and gilding all of it put gold across 6.5% of a
             square frame — over the budget the palette rule sets. */
          float goldable = 1.0 - smoothstep(
            uNodeRadius * 1.2,
            uNodeRadius * 1.5,
            radius
          );
          color = mix(BLUE_WHITE, GOLD, st.y * 0.5 * goldable);
        } else if (aCategory < 3.5) {
          /* Travellers. Curve interpolation, never linear, and during a
             transfer they run the outgoing path inward then the incoming
             path outward, staggered so the group reads as traffic. */
          float id = aNode;
          float t = fract(aParam + uTime * (0.05 + hash(vec2(aSeed, 9.1)) * 0.05) * motion);
          float visible = 1.0;

          if (uTransfer.w > 0.5) {
            float p = clamp(uTransfer.z + (aSeed - 0.5) * 0.22, 0.0, 1.0);
            if (abs(id - uTransfer.x) < 0.5) {
              t = 1.0 - min(1.0, p * 2.0);
              visible = p < 0.5 ? 1.0 : 0.0;
            } else if (abs(id - uTransfer.y) < 0.5) {
              t = max(0.0, (p - 0.5) * 2.0);
              visible = p >= 0.5 ? 1.0 : 0.0;
            }
          }

          vec2 a = uHub;
          vec2 c = nodeControlOf(id);
          vec2 b = nodePosOf(id);
          vec2 p = quadratic(a, c, b, t);
          /* A per-particle offset perpendicular to the path, so eight curves
             do not become eight wires. */
          vec2 tangent = normalize(b - a + vec2(1e-5));
          vec2 normal = vec2(-tangent.y, tangent.x);
          float offset = (aSeed - 0.5) * uNodeRadius * 0.5 * sin(t * 3.1415926);
          pos = vec3(p + normal * offset, 0.0);

          vec4 st = nodeStateOf(id);
          alpha = (0.07 + st.y * 0.28 + st.x * 0.08) * visible;
          size = 0.7 + st.y * 0.5;
          color = mix(BLUE_WHITE, COLD_WHITE, 0.4);
        } else {
          /* The mark, reconstructing from the field as the lion recedes. */
          float mix01 = smoothstep(0.45, 0.95, uRecession);
          float stagger = clamp(mix01 * 1.35 - aSeed * 0.35, 0.0, 1.0);
          vec3 target = mix(aTarget, aTargetOpen, uOpen);
          pos = mix(aHome, target, stagger);
          alpha = mix01 * (0.14 + aSeed * 0.1);
          size = 0.8 + aSeed * 0.4;
          color = mix(GOLD, COLD_WHITE, 0.35);
        }

        /* --- forces, applied to the field rather than to the structures --- */
        if (aCategory < 0.5) {
          /* Hover attraction (GRAPHIC 04). */
          if (uAttract.z > 0.001) {
            vec2 toward = uAttract.xy - pos.xy;
            float d = length(toward);
            float f = falloff(d, uAttract.w) * uAttract.z;
            pos.xy += normalize(toward + vec2(1e-6)) * f * min(d, uAttract.w) * 0.55;
            alpha += f * 0.06;
            /* Gold only very near the target, and only for a few. */
            float near = falloff(d, uNodeRadius * 1.5);
            color = mix(color, GOLD, near * 0.8);
          }

          /* Convergence burst (GRAPHIC 10). */
          if (uBurst.w > 0.5) {
            vec2 toward = uBurst.xy - pos.xy;
            float d = length(toward);
            float pull = falloff(d, uNodeRadius * 4.0) * (1.0 - uBurst.z);
            pos.xy += normalize(toward + vec2(1e-6)) * pull * min(d, 1.0) * 0.7;
            alpha += pull * 0.1;
          }

          /* Panel exclusion (GRAPHIC 09): the field parts sideways rather
             than radiating, matching the flow it already has. */
          if (uPanelStrength > 0.001) {
            vec2 delta = pos.xy - uPanel.xy;
            vec2 inside = uPanel.zw + vec2(0.35, 0.2) - abs(delta);
            if (inside.x > 0.0 && inside.y > 0.0) {
              float push = min(inside.x, inside.y * 2.0) * uPanelStrength;
              pos.x += sign(delta.x + 1e-6) * push;
              alpha *= 1.0 - uPanelStrength * 0.45;
            }
          }
        }

        vAlpha = alpha * uRise;
        vColor = color;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        /* 58 rather than something invented: the scene underneath attenuates
           its three particle systems by 64–86 over the same camera distance,
           and a field that does not match it is a second visual language. */
        gl_PointSize = uSize * size * (58.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.002) discard;
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float d = dot(c, c);
        if (d > 1.0) discard;
        float a = exp(-d * 3.1) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });
}

export type { SectionId };

/**
 * Curvature-weighted, deterministic surface sampling.
 * Same seed → byte-identical bake, which makes re-model diffs meaningful.
 */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export interface SampledCloud {
  /** xyz interleaved, bodyCount + crownCount entries; crown is the trailing range. */
  positions: Float32Array;
  normals: Float32Array;
  crownStart: number;
  crownCount: number;
}

/** Mulberry32 — small, seedable, good enough for sampling jitter. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surfaceArea(g: THREE.BufferGeometry): number {
  const index = g.getIndex()!;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
  }
  return area;
}

function sampleGeometry(
  g: THREE.BufferGeometry,
  count: number,
  rng: () => number,
  positions: Float32Array,
  normals: Float32Array,
  offset: number,
): void {
  const mesh = new THREE.Mesh(g);
  const sampler = new MeshSurfaceSampler(mesh).setWeightAttribute('curvatureWeight');
  (sampler as MeshSurfaceSampler & { setRandomGenerator(random: () => number): void })
    .setRandomGenerator(rng);
  sampler.build();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n);
    const o = (offset + i) * 3;
    positions[o] = p.x;
    positions[o + 1] = p.y;
    positions[o + 2] = p.z;
    normals[o] = n.x;
    normals[o + 1] = n.y;
    normals[o + 2] = n.z;
  }
}

/**
 * The crown is held ~12% brighter at runtime and must read as jewellery, not
 * noise — it gets a flat extra sampling multiplier over its raw area share,
 * with a floor so a small crown still resolves.
 */
export function sampleLion(
  body: THREE.BufferGeometry,
  crown: THREE.BufferGeometry,
  totalCount: number,
  seed: number,
): SampledCloud {
  const areaBody = surfaceArea(body);
  const areaCrown = surfaceArea(crown);
  const crownShare = Math.min(0.18, Math.max(0.05, (areaCrown / (areaBody + areaCrown)) * 2.5));
  const crownCount = Math.round(totalCount * crownShare);
  const bodyCount = totalCount - crownCount;

  const positions = new Float32Array(totalCount * 3);
  const normals = new Float32Array(totalCount * 3);
  const rng = mulberry32(seed);
  sampleGeometry(body, bodyCount, rng, positions, normals, 0);
  sampleGeometry(crown, crownCount, rng, positions, normals, bodyCount);

  return { positions, normals, crownStart: bodyCount, crownCount };
}

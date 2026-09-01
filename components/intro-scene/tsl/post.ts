/**
 * TSL pass() + bloom() post chain (brief §2: the legacy EffectComposer is not
 * ported to WebGPU — never use it). Tier-aware: full / reduced / off.
 */
import { RenderPipeline, type Camera, type Renderer, type Scene } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { SimParams } from '../types';

export interface PostHandle {
  post: RenderPipeline;
  setBloom(threshold: number, strength: number, radius: number): void;
  dispose(): void;
}

export function createPost(
  renderer: Renderer,
  scene: Scene,
  camera: Camera,
  params: SimParams,
  tier: 'full' | 'reduced' | 'off',
): PostHandle {
  const post = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode();

  if (tier === 'off') {
    post.outputNode = color;
    return {
      post,
      setBloom: () => {},
      dispose: () => post.dispose(),
    };
  }

  const radius = tier === 'reduced' ? Math.min(params.bloomRadius, 0.3) : params.bloomRadius;
  const bloomNode = bloom(color, params.bloomStrength, radius, params.bloomThreshold);
  post.outputNode = color.add(bloomNode);

  return {
    post,
    setBloom(threshold, strength, r) {
      (bloomNode.threshold as { value: number }).value = threshold;
      (bloomNode.strength as { value: number }).value = strength;
      (bloomNode.radius as { value: number }).value = tier === 'reduced' ? Math.min(r, 0.3) : r;
    },
    dispose: () => {
      bloomNode.dispose();
      post.dispose();
    },
  };
}

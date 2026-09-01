/**
 * Divergence-free curl noise — the lion's ambient breath (brief §6).
 * Finite-difference curl of a vector noise potential: 6 evaluations of
 * mx_noise_vec3 per particle. Runs only in the lion compute pass.
 */
import { Fn, float, vec3, mx_noise_vec3 } from 'three/tsl';

const EPS = 0.05;

// The arg accepts any vec3-valued node — TSL's overload types are narrower
// than the runtime, so keep the parameter loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const curlNoise = /*@__PURE__*/ Fn(([p]: [any]) => {
  const e = float(EPS);
  const dx = vec3(e, 0, 0);
  const dy = vec3(0, e, 0);
  const dz = vec3(0, 0, e);

  const px0 = mx_noise_vec3(p.sub(dx));
  const px1 = mx_noise_vec3(p.add(dx));
  const py0 = mx_noise_vec3(p.sub(dy));
  const py1 = mx_noise_vec3(p.add(dy));
  const pz0 = mx_noise_vec3(p.sub(dz));
  const pz1 = mx_noise_vec3(p.add(dz));

  const inv2e = float(1 / (2 * EPS));
  // curl F = (dFz/dy − dFy/dz, dFx/dz − dFz/dx, dFy/dx − dFx/dy)
  const x = py1.z.sub(py0.z).sub(pz1.y.sub(pz0.y)).mul(inv2e);
  const y = pz1.x.sub(pz0.x).sub(px1.z.sub(px0.z)).mul(inv2e);
  const z = px1.y.sub(px0.y).sub(py1.x.sub(py0.x)).mul(inv2e);
  return vec3(x, y, z);
});

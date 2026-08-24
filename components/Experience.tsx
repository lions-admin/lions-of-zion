import { ParticleNav } from "@/components/particle-nav";
import { defaultNodes } from "@/components/particle-nav/config";

/**
 * One canvas owns both acts. The same WebGPU/TSL lion assembles for the story,
 * relocates, and remains as the centre of the network navigation. Real links
 * stay server-rendered for accessibility and the no-JavaScript path.
 */
export default function Experience() {
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 0 }}>
      <ParticleNav nodes={defaultNodes} intro />
    </main>
  );
}

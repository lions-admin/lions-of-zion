"use client";

/**
 * The two measured diagrams on `/information-war`.
 *
 * `SignalBeam` needs live refs to a container and both endpoints, which is a
 * client concern. This file is the whole of that boundary: it renders the
 * positioned host, finds the anchors already present in the server markup,
 * and draws the wires. `InformationWarSystem.tsx` stays a server component
 * and every word, number and box in both diagrams is still server-rendered —
 * these components only ever receive them as `children` (§23).
 *
 * Neither diagram depends on a beam to be understood:
 *
 *   · The system flow already owns its wire — `.systemFlow::before`, a rail
 *     that needs no JavaScript. The beams there contribute the travelling
 *     packet only and their own track is suppressed, so nothing is drawn
 *     twice and reduced motion leaves the diagram exactly as it is today.
 *   · The convergence fan is the opposite case. Its CSS lines are five 1px
 *     rules at two fixed angles — an approximation that does not actually
 *     reach the origin. The measured beams do, so once they have mounted the
 *     approximation stands down. With JavaScript off it is still there, and
 *     under reduced motion the beams keep their track and lose only the
 *     packet.
 *
 * Both are `role="img"`/list structures whose relationship is already stated
 * in prose and in an `aria-label`, so no beam is the sole statement of
 * anything and none takes `SignalBeam`'s `label` prop.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { SignalBeam } from "@/components/motion";
import styles from "./information-war-system.module.css";

type Anchor = RefObject<HTMLElement | null>;

/* The ambient register. `--dur-ambient` is 7s in the token file and a beam's
   duration is a prop rather than a custom property, so this is the one place
   the number is restated — not a per-diagram timing choice. */
const AMBIENT_SECONDS = 7;

/** A ref object over an element that already exists, stable for the mount. */
function anchor(element: HTMLElement): Anchor {
  return { current: element };
}

/**
 * `04 / The Lions of Zion system` — the verification pipeline.
 *
 * One packet per span between consecutive stage marks, phase-offset by an
 * even share of the cycle so the eye reads a signal moving down the chain
 * rather than five things blinking together. Collection is continuous, which
 * is what a continuously occupied pipeline says.
 */
export function SystemFlowBeams({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Anchor[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const found = Array.from(host.querySelectorAll<HTMLElement>("[data-beam-node]"));
    if (found.length < 2) return;
    setNodes(found.map(anchor));
  }, []);

  const spans = Math.max(nodes.length - 1, 1);

  return (
    <div ref={hostRef} className={styles.systemFlowHost}>
      {children}
      {nodes.slice(0, -1).map((from, index) => (
        <SignalBeam
          key={from.current?.dataset.beamNode ?? index}
          containerRef={hostRef}
          fromRef={from}
          toRef={nodes[index + 1]}
          /* The stages stack vertically at every width, so start, control
             and end share an x and the path is a straight vertical line.
             A curve here would be an invention. */
          curvature={0}
          duration={AMBIENT_SECONDS}
          delay={(index * AMBIENT_SECONDS) / spans}
          className={styles.flowBeam}
        />
      ))}
    </div>
  );
}

/**
 * `03 / The independence test` — five syndicated copies, one upstream origin.
 *
 * The relationship the beams draw is the section's whole claim: five
 * headlines that descend from one report are one confirmation. Each wire runs
 * from a copy's ember mark to the origin's mark, so the lines land on points
 * instead of crossing the boxes, and they overlap as they arrive — which is
 * the convergence stated geometrically rather than suggested.
 */
export function SourceConvergenceBeams({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState<Anchor[]>([]);
  const originRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const origin = host.querySelector<HTMLElement>("[data-beam-origin]");
    const found = Array.from(host.querySelectorAll<HTMLElement>("[data-beam-copy]"));
    if (!origin || found.length === 0) return;
    originRef.current = origin;
    setCopies(found.map(anchor));
  }, []);

  return (
    <div
      ref={hostRef}
      className={styles.sourceDiagram}
      role="img"
      aria-label={label}
      /* Set only once the measured wires exist, so the CSS fan is never
         removed on a tier that has nothing to replace it with. */
      data-beams={copies.length ? "on" : undefined}
    >
      {children}
      {copies.map((from, index) => (
        <SignalBeam
          key={from.current?.dataset.beamCopy ?? index}
          containerRef={hostRef}
          fromRef={from}
          toRef={originRef}
          /* Zero curvature is not a straight line here: `SignalBeam` puts
             the control point at `(midX, startY)`, so the wire leaves the
             copy horizontally and bends into the origin. That is the fan-in
             a converging diagram wants, and it holds its shape when the
             middle column narrows on a phone and the angles go steep. */
          curvature={0}
          duration={AMBIENT_SECONDS}
          delay={(index * AMBIENT_SECONDS) / copies.length}
          /* Ember is the copies' ramp throughout this section — the signal
             that looks like five confirmations. The origin keeps the blue. */
          tone="ember"
          className={styles.convergeBeam}
        />
      ))}
    </div>
  );
}

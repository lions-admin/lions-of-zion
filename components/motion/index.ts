/**
 * The motion primitive library.
 *
 * The behaviours here were taken from Magic UI (magicui.design) and rewritten
 * against this project's tokens and architecture. None of the original source
 * survives verbatim; what carried over is the mechanism, which is the part
 * that was worth having. Each file records what it came from and what changed;
 * the directory README that used to hold that summary was removed in bd3dfe3.
 * None of them import the `motion` package.
 *
 * Three of the seven that were built are gone, all for one reason — built,
 * never mounted, and never acquiring a caller. `Spotlight`, then `Ticker` on
 * 2026-09-02, then `ShinyText` on 2026-09-03 under CLEAN-008. The document's
 * own instruction for ShinyText was "use only on live processing words;
 * remove if no justified caller", and the two states that qualify already
 * have their marker: Ask's wait carries `BorderBeam`, a live region and a
 * ticking clock, and Search's "Searching the index…" is a sentence, which
 * this primitive explicitly did not take.
 */

export { Reveal } from "./Reveal";
export type { RevealProps, RevealDirection } from "./Reveal";

export { BorderBeam } from "./BorderBeam";
export type { BorderBeamProps } from "./BorderBeam";

export { SignalBeam } from "./SignalBeam";
export type { SignalBeamProps } from "./SignalBeam";

export { ProgressiveBlur } from "./ProgressiveBlur";
export type { ProgressiveBlurProps } from "./ProgressiveBlur";

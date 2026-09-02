/**
 * The motion primitive library.
 *
 * Six behaviours were taken from Magic UI (magicui.design) and rewritten
 * against this project's tokens and architecture. None of the original source
 * survives verbatim; what carried over is the mechanism, which is the part
 * that was worth having. See `README.md` in this directory for what each one
 * came from, what changed, and why the `motion` package is not a dependency.
 */

export { Reveal } from "./Reveal";
export type { RevealProps, RevealDirection } from "./Reveal";

export { BorderBeam } from "./BorderBeam";
export type { BorderBeamProps } from "./BorderBeam";

export { SignalBeam } from "./SignalBeam";
export type { SignalBeamProps } from "./SignalBeam";

export { Ticker } from "./Ticker";
export type { TickerProps } from "./Ticker";

export { ShinyText } from "./ShinyText";
export type { ShinyTextProps } from "./ShinyText";

export { ProgressiveBlur } from "./ProgressiveBlur";
export type { ProgressiveBlurProps } from "./ProgressiveBlur";

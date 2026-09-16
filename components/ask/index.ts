/**
 * Ask the desk.
 *
 * `AskDock` is the launcher in the site header; `AskDesk` is the surface,
 * rendered by `/ask` and — lazily — by the drawer. `AskComposer` is the
 * rebuilt question box on `components/ui` (the vendored Tailwind stack that
 * briefly served it was deleted on 2026-09-17).
 */

export { AskDock } from "./AskDock";
export { AskDesk } from "./AskDesk";
export { AskComposer } from "./AskComposer";
export type { AskComposerProps } from "./AskComposer";
export { CitationList } from "./CitationList";
export { AnswerRecord } from "./AnswerRecord";
export { toExchanges } from "./exchanges";
export type { Exchange } from "./exchanges";

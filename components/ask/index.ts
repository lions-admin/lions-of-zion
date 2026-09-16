/**
 * Ask the desk.
 *
 * `AskDock` is the launcher, mounted once in the site header. `AskDesk` is the
 * surface itself, rendered by `/ask` and lazily by the dock's drawer.
 */

export { AskDock } from "./AskDock";
export { AskDesk } from "./AskDesk";
export type { AskDeskLayout, AskDeskProps } from "./AskDesk";
export { AskField } from "./AskField";
export type { AskFieldProps } from "./AskField";
export { CitationList } from "./CitationList";
export { AnswerRecord, ANSWER_AUTHORSHIP } from "./AnswerRecord";
export { toExchanges } from "./exchanges";
export type { Exchange } from "./exchanges";

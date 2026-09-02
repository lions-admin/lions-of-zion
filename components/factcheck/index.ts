/**
 * The fact-check desk — one claim, its evidence chain, and the verdict.
 *
 * Server components throughout apart from the `Reveal` wrapper each entry
 * renders as its own `<li>`. The only interactive element is a native
 * `<details>`, so the whole page works with JavaScript off — the disclosure
 * included, which is the reason it is a `<details>` and not a state hook.
 */

export { FactCheckDesk, FACT_CHECK_PATH } from "./FactCheckDesk";
export type { FactCheckDeskProps } from "./FactCheckDesk";
export { ClaimEntry } from "./ClaimEntry";
export { ClaimLadder } from "./ClaimLadder";
export { EvidenceChain } from "./EvidenceChain";

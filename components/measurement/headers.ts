import { activeIds } from "./ids";

/**
 * Headers that let the server attribute an Ask outcome to this visit.
 *
 * Literal names rather than an import of `MEASUREMENT_*_HEADER` from
 * `server/contracts/measurement.ts`: that file carries zod, and this one ships
 * in every public page's bundle. `tests/measurement.test.ts` pins the two
 * spellings together.
 *
 * Empty unless the collector is running — so DNT/GPC, the admin surface and a
 * collector that failed to start all send nothing, and no id is ever minted
 * here.
 */
export function measurementHeaders(): Record<string, string> {
  try {
    const ids = activeIds();
    if (!ids) return {};
    return {
      "x-lz-visit": ids.visitId,
      "x-lz-visitor": ids.visitorId,
      "x-lz-path": window.location.pathname,
    };
  } catch {
    return {};
  }
}

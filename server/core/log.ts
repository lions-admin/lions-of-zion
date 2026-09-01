import "server-only";

/** Stable, machine-readable operational events; never pass bodies or secrets. */
export type BriefingLogContext = {
  requestId?: string;
  runId?: string;
  stage?: string;
  sourceId?: string;
  editionId?: string;
  provider?: string;
  model?: string;
};

export function briefingLog(
  level: "info" | "warn" | "error",
  event: string,
  context: BriefingLogContext = {},
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console[level](JSON.stringify(Object.fromEntries(Object.entries({ level, event, ...context, ...fields })
    .filter(([, value]) => value !== undefined))));
}

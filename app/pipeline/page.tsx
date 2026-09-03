import { PipelineVisualizer } from "@/components/pipeline-visualizer";

/**
 * An internal tool, and titled as one since 2026-09-02.
 *
 * The page used to be called "the LIVE system pipeline" in three places while
 * being driven end to end by `data/journeys.ts` — a scripted walkthrough with
 * no connection to the running backend. On a site whose subject is people
 * dressing invention up as reporting, a dashboard that animates like live
 * operations and is not is the one thing this codebase cannot ship. The word
 * "live" is gone from the title, the description and the header badge; the
 * telemetry strip states architectural guarantees instead of inventing
 * readings; and `app/robots.ts` disallows the route.
 */
export const metadata = {
  title: "System architecture map | Lions of Zion",
  description:
    "A scripted interactive model of information flow, claim verification, publication gates, and the daily brief — based on the codebase, not live runtime data.",
  robots: { index: false, follow: false },
};

export default function PipelinePage() {
  return (
    <main>
      <PipelineVisualizer />
    </main>
  );
}

"use client";

/**
 * LIONS OF ZION OPERATIONS CONSOLE — the shell.
 *
 * Five areas and a chat. The page used to be one column that mixed deployment
 * identity, user counts, search spend and pipeline throughput in a single
 * seventeen-cell grid, then panels in the order they happened to be written.
 * The areas are the operator's actual questions, in the order they get asked:
 *
 *   1. **Overview** — is it running, when did it last run, what came out.
 *   2. **Pipeline** — if it is not running, which stage is stuck and why.
 *   3. **Sources** — is anything still coming in.
 *   4. **Editorial Desk** — what is waiting for a person, and publishing.
 *   5. **System & Security** — users, cost, the audit log, incidents, secrets.
 *
 * `activation="manual"` on the tab row is deliberate: each area fetches its
 * own data, so arrowing across five tabs with automatic activation would fire
 * five reads nobody asked for. Arrow keys move focus; Enter or Space selects.
 *
 * The chat is docked rather than tabbed. It is the one surface an operator
 * uses *while* reading another, and putting it behind a tab would mean losing
 * the screen you are asking about.
 *
 * `signal` is how the chat and the areas stay honest with each other: when a
 * turn reports it changed state, the number goes up and the visible area
 * re-reads. It is a counter rather than a boolean so two changes in a row are
 * two reloads.
 */

import { useCallback, useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/Tabs";
import { EditorialDesk } from "./EditorialDesk";
import { AREA_LABEL } from "./lexicon";
import { OpsChat } from "./OpsChat";
import { OverviewPanel } from "./OverviewPanel";
import { PipelinePanel } from "./PipelinePanel";
import { SourcesPanel } from "./SourcesPanel";
import { SystemPanel } from "./SystemPanel";
import styles from "./admin.module.css";

/* The `value` is the wire word — it is what the tab state, the panel and
   `tests/admin-console.test.ts` all key on, and it stays Latin. The label is
   read from `lexicon.ts` rather than typed here, so the five areas are named
   once and the panels below can head themselves with the same words. */
const AREAS = [
  { value: "overview", label: AREA_LABEL.overview },
  { value: "pipeline", label: AREA_LABEL.pipeline },
  { value: "sources", label: AREA_LABEL.sources },
  { value: "editorial", label: AREA_LABEL.editorial },
  { value: "system", label: AREA_LABEL.system },
] as const;

export function OperationsConsole() {
  const [area, setArea] = useState<string>("overview");
  const [signal, setSignal] = useState(0);
  const reloadActiveArea = useCallback(() => setSignal((current) => current + 1), []);

  return (
    <div className={styles.consoleLayout}>
      <Tabs
        value={area}
        onValueChange={setArea}
        activation="manual"
        className={styles.consoleTabs}
      >
        <TabList label="אזורי הקונסולה" shape="segmented">
          {AREAS.map((entry) => (
            <Tab key={entry.value} value={entry.value}>{entry.label}</Tab>
          ))}
        </TabList>

        <TabPanel value="overview"><OverviewPanel signal={signal} /></TabPanel>
        <TabPanel value="pipeline"><PipelinePanel signal={signal} /></TabPanel>
        <TabPanel value="sources"><SourcesPanel signal={signal} /></TabPanel>
        <TabPanel value="editorial"><EditorialDesk signal={signal} /></TabPanel>
        <TabPanel value="system"><SystemPanel signal={signal} /></TabPanel>
      </Tabs>

      <aside className={styles.consoleRail} aria-label="עוזר התפעול">
        <OpsChat onStateChanged={reloadActiveArea} />
      </aside>
    </div>
  );
}

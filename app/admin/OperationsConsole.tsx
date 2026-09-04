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
 * the screen you are asking about. On a narrow screen a docked rail would
 * squeeze the areas it serves, so the rail collapses to one deliberate
 * toggle that opens the chat as a full-height end-edge drawer — a top-layer
 * `<dialog>`, never a floating obstruction. The two placements never coexist:
 * the same media query that decides the grid decides which one mounts, so
 * the chat cannot overlap the nav or the content in either of them.
 *
 * `signal` is how the chat and the areas stay honest with each other: when a
 * turn reports it changed state, the number goes up and the visible area
 * re-reads. It is a counter rather than a boolean so two changes in a row are
 * two reloads.
 *
 * The selected area is mirrored into the URL as `?area=` for deep-linking,
 * replacing the address with the History API — no navigation, no refetch.
 * The server always renders `overview`; the client syncs from the URL once
 * on mount, so the first paint never disagrees with the document that
 * produced it.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/Tabs";
import { EditorialDesk } from "./EditorialDesk";
import { AREA_LABEL, T } from "./lexicon";
import { OpsChat } from "./OpsChat";
import { OverviewPanel } from "./OverviewPanel";
import { PipelinePanel } from "./PipelinePanel";
import { SourcesPanel } from "./SourcesPanel";
import { SystemPanel } from "./SystemPanel";
import { CommandBackground } from "./_command/CommandBackground";
import cmd from "./command.module.css";
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

const DEFAULT_AREA = "overview";
const AREA_QUERY = "area";
/** The chat docks beside the areas at the same width the console layout
 *  reserves the rail column for; below it, the rail is the drawer toggle. */
const DOCKED_CHAT_QUERY = "(min-width: 64rem)";

function areaFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(AREA_QUERY);
  return AREAS.some((entry) => entry.value === value) ? value : null;
}

export function OperationsConsole() {
  const [area, setArea] = useState<string>(DEFAULT_AREA);
  const [signal, setSignal] = useState(0);
  /* `true` — the desktop rail. `false` — the narrow-screen toggle and drawer. */
  const [chatDocked, setChatDocked] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const reloadActiveArea = useCallback(() => setSignal((current) => current + 1), []);

  /* Sync from the URL once after hydration, so the server-rendered document
     (always `overview`) and the client agree before the first state change;
     and read the viewport's docking decision from the same media query the
     stylesheet uses. Both are deferred a tick — a synchronous `setState`
     inside an effect cascades a second render before paint, and neither the
     deep link nor the breakpoint is worth one. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromUrl = areaFromLocation();
      if (fromUrl) setArea(fromUrl);
      setChatDocked(window.matchMedia(DOCKED_CHAT_QUERY).matches);
    }, 0);
    const query = window.matchMedia(DOCKED_CHAT_QUERY);
    const sync = () => setChatDocked(query.matches);
    query.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer);
      query.removeEventListener("change", sync);
    };
  }, []);

  const selectArea = useCallback((next: string) => {
    setArea(next);
    /* A deep link, not a navigation: replace the address in place so the
       back button still leaves the console and no refetch is fired. */
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set(AREA_QUERY, next);
    window.history.replaceState(null, "", url);
  }, []);

  const chat = <OpsChat onStateChanged={reloadActiveArea} />;

  return (
    <div className={cmd.shell}>
      <CommandBackground />
      <div className={styles.consoleLayout}>
        <Tabs
          value={area}
          onValueChange={selectArea}
          activation="manual"
          className={styles.consoleTabs}
        >
          <div className={cmd.consoleNav}>
            <TabList label="אזורי הקונסולה" shape="segmented">
              {AREAS.map((entry) => (
                <Tab key={entry.value} value={entry.value}>{entry.label}</Tab>
              ))}
            </TabList>
          </div>

          <TabPanel value="overview"><OverviewPanel signal={signal} /></TabPanel>
          <TabPanel value="pipeline"><PipelinePanel signal={signal} /></TabPanel>
          <TabPanel value="sources"><SourcesPanel signal={signal} /></TabPanel>
          <TabPanel value="editorial"><EditorialDesk signal={signal} /></TabPanel>
          <TabPanel value="system"><SystemPanel signal={signal} /></TabPanel>
        </Tabs>

        <aside className={styles.consoleRail} aria-label="עוזר התפעול">
          {chatDocked ? (
            chat
          ) : (
            <div className={styles.railToggle}>
              <Button
                variant="secondary"
                size="md"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={chatOpen}
                onClick={() => setChatOpen(true)}
              >
                {T.openOpsChat}
              </Button>
            </div>
          )}
        </aside>
      </div>

      {/* The narrow-screen chat. Top-layer, full-height, closed by Escape or
          its own close control — and unmounted entirely on a desktop
          viewport, where the rail carries the same component instead. */}
      <Dialog
        open={!chatDocked && chatOpen}
        onClose={() => setChatOpen(false)}
        variant="drawer"
        size="wide"
        title="עוזר התפעול"
        closeLabel={T.closeOpsChat}
      >
        {!chatDocked ? chat : null}
      </Dialog>
    </div>
  );
}

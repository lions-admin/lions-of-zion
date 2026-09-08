"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { AskDesk } from "./AskDesk";
import styles from "./ask.module.css";

/** The homepage mounts its Signal Lens in the header, outside the reading area. */
export function AskDock({ home = false }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <a
        href="/ask"
        className={home ? styles.homeDockTrigger : styles.dockTrigger}
        data-ask-launcher=""
        aria-label="Ask the desk"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          // Keep native navigation available before hydration and for new-tab gestures.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span className={styles.dockGlyph} aria-hidden="true">
          <Icon name="ask" size={20} strokeWidth={1.5} />
        </span>
        {/* VA-58. This read "AI Chat" while the menu, the page title and the
            dialog all said "Ask the desk" — five names for one destination.
            The menu label wins, per the owner's naming ruling. What "AI Chat"
            was carrying honestly, that a machine answers, is not lost: the
            dialog description below says so, and every record now states its
            authorship (VA-47). */}
        <span className={styles.dockLabel}>Ask the desk</span>
      </a>
      <Dialog
        id={panelId}
        open={open}
        onClose={() => setOpen(false)}
        title="Ask the desk"
        description="A question answered across what this desk has published. Not a search box: Search finds a record, this reads them. Where there is no evidence, the answer says so."
        variant="drawer"
        size="wide"
        dismissOnBackdrop={false}
        closeLabel="Close the desk"
        className={styles.dockPanel}
      >
        <AskDesk />
      </Dialog>
    </>
  );
}

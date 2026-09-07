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
        aria-label="AI Chat — ask the desk"
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
        <span className={styles.dockLabel}>AI Chat</span>
      </a>
      <Dialog
        id={panelId}
        open={open}
        onClose={() => setOpen(false)}
        title={home ? "AI Chat — Ask the desk" : "Ask the desk"}
        description="Grounded in what this desk has published. Where there is no evidence, the answer says so."
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

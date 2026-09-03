"use client";

/**
 * Search overlay on the shared Dialog primitive (SYS-012).
 *
 * The launcher remains a link to `/search` so a reader with JavaScript off
 * still reaches the desk. This overlay is an upgrade path only.
 */

import { Dialog } from "@/components/ui/Dialog";
import { SearchPanel } from "./SearchPanel";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Search"
      description="Published items, briefs, and records on this desk."
      variant="modal"
      size="wide"
    >
      {open ? <SearchPanel variant="overlay" autoFocus onDismiss={onClose} /> : null}
    </Dialog>
  );
}

import React from "react";
import styles from "./keys.module.css";

/**
 * One keyboard key, one shape.
 *
 * Extracted 2026-09-17 from the ask composer's Enter contract and the search
 * footer's key grammar, which carried byte-identical `kbd` rules. A legend is
 * written by the caller; this is only the key itself.
 */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

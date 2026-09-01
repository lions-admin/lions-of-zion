"use client";

import React from "react";
import type { PipelineNode } from "./types";
import styles from "./visualizer.module.css";

interface NodeInspectorDrawerProps {
  node: PipelineNode | null;
  onClose: () => void;
}

const KIND_HEBREW_MAP: Record<string, string> = {
  source: "מקור נתונים",
  table: "טבלת מסד נתונים",
  view: "היטל קריאה מוגן",
  guard: "מחסום אבטחה ואימות",
  trigger: "טריגר SQL אטומי",
  cron: "מתזמן Vercel Cron",
  queue: "תור Vercel Queue",
  connector: "מחבר נתונים וסריקה",
  service: "שירות ליבה עסקי",
  model: "מודל שפה (AI)",
  gateway: "שער קישוריות AI",
  storage: "אחסון קבצים (Blob)",
};

export function NodeInspectorDrawer({ node, onClose }: NodeInspectorDrawerProps) {
  if (!node) return null;

  const heKind = KIND_HEBREW_MAP[node.kind] || node.kind;

  return (
    <div className={styles.inspectorDrawer} dir="rtl">
      <div className={styles.drawerHeader}>
        <div>
          <span className={styles.brandBadge}>[{heKind}]</span>
          <h2 className={styles.headerTitle} style={{ marginTop: "0.4rem" }}>
            {node.nameHe}
          </h2>
          <p className={styles.headerSubtitle} style={{ direction: "ltr", textAlign: "right" }}>
            {node.nameEn}
          </p>
        </div>
        <button
          type="button"
          className={styles.drawerCloseBtn}
          onClick={onClose}
          aria-label="סגור מגירת מידע"
          title="סגור"
        >
          ✕
        </button>
      </div>

      <div className={styles.drawerBody}>
        {/* תפקיד במערכת */}
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>מה המרכיב עושה (תפקיד במערכת)</span>
          <p className={styles.inspectorValueHe}>{node.what}</p>
        </div>

        {/* רציונל הנדסי */}
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>מדוע זה בנוי כך (רציונל הנדסי וארכיטקטוני)</span>
          <p className={styles.inspectorValueHe}>{node.why}</p>
        </div>

        {/* קלט ופלט */}
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>קלט שהרכיב מקבל (Inputs)</span>
          <p className={styles.inspectorValueHe}>{node.input}</p>
        </div>

        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>תוצר ופלט המופק (Outputs)</span>
          <p className={styles.inspectorValueHe}>{node.output}</p>
        </div>

        {/* טיפול בכשלים וחסינות */}
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>טיפול בכשלים ומנגנוני הגנה (Failure Mode)</span>
          <div className={styles.failureAlertBox}>
            <p className={styles.inspectorValueHe}>{node.failureMode}</p>
          </div>
        </div>

        {/* טבלת מסד נתונים */}
        {node.dbTable && (
          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>טבלת מסד נתונים (Database Table)</span>
            <div className={styles.codeBox} dir="ltr">{node.dbTable}</div>
          </div>
        )}

        {/* אילוץ / טריגר SQL */}
        {node.sqlConstraintOrTrigger && (
          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>אילוץ או טריגר SQL מובנה</span>
            <div className={styles.codeBox} dir="ltr">{node.sqlConstraintOrTrigger}</div>
          </div>
        )}

        {/* קובץ קוד במערכת */}
        {node.codePath && (
          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>קובץ קוד במערכת (Source Reference)</span>
            <div className={styles.codeBox} dir="ltr">{node.codePath}</div>
          </div>
        )}

        {/* מונחים מקצועיים */}
        {node.terms.length > 0 && (
          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>מונחים טכניים מקבילים</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {node.terms.map((t, idx) => (
                <span key={idx} className={styles.brandBadge}>
                  {t.he} ({t.en})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

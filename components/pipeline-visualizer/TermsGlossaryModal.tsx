"use client";

import { useState, useMemo } from "react";
import { PIPELINE_GLOSSARY, type GlossaryTerm } from "./data/glossary";
import styles from "./visualizer.module.css";

interface TermsGlossaryModalProps {
  isOpen: boolean;
  initialSearch?: string;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "כל המונחים",
  ingest: "איסוף ומקורות",
  evidence: "ראיות וטענות",
  model: "אימות וחוקים",
  briefing: "בריף יומי",
  search: "חיפוש ו־Outbox",
  ai: "בינה מלאכותית (AI)",
  infra: "תשתית ואבטחה",
};

export function TermsGlossaryModal({
  isOpen,
  initialSearch = "",
  onClose,
}: TermsGlossaryModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredTerms = useMemo(() => {
    return PIPELINE_GLOSSARY.filter((t: GlossaryTerm) => {
      if (selectedCategory !== "all" && t.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.termEn.toLowerCase().includes(q) ||
        t.termHe.toLowerCase().includes(q) ||
        t.shortDescriptionHe.toLowerCase().includes(q) ||
        t.deepExplanationHe.toLowerCase().includes(q) ||
        (t.relatedDbTable && t.relatedDbTable.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose} dir="rtl">
      <div className={styles.glossaryModalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.glossaryModalHeader}>
          <div>
            <h2 className={styles.glossaryModalTitle}>📖 מילון מונחים והסברים מלא (עברית / אנגלית)</h2>
            <p className={styles.glossaryModalSubtitle}>
              הסבר מעמיק, בעברית פשוטה ומדויקת, לכל מושג טכני, מודל או טבלה בארכיטקטורת המערכת.
            </p>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="סגור מילון"
          >
            ✕
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className={styles.glossarySearchRow}>
          <input
            type="text"
            className={styles.glossarySearchInput}
            placeholder="חפש מונח באנגלית או בעברית (למשל: Outbox, RLS, אימות, וקטורים)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          <div className={styles.glossaryCategoryTabs}>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                className={`
                  ${styles.glossaryCatTab}
                  ${selectedCategory === cat ? styles.glossaryCatTabActive : ""}
                `}
                onClick={() => setSelectedCategory(cat)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Term List */}
        <div className={styles.glossaryListContainer}>
          {filteredTerms.length === 0 ? (
            <div className={styles.glossaryEmptyState}>
              לא נמצאו מונחים התואמים את החיפוש &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredTerms.map((term: GlossaryTerm) => (
              <div key={term.termEn} className={styles.glossaryCard}>
                <div className={styles.glossaryCardTop}>
                  <div className={styles.glossaryTitleGroup}>
                    <h3 className={styles.glossaryTermHe}>{term.termHe}</h3>
                    <span className={styles.glossaryTermEn} dir="ltr">({term.termEn})</span>
                  </div>
                  {term.relatedDbTable && (
                    <span className={styles.glossaryTableTag} dir="ltr">
                      טבלה: <code>{term.relatedDbTable}</code>
                    </span>
                  )}
                </div>

                <p className={styles.glossaryShortDesc}>{term.shortDescriptionHe}</p>

                <div className={styles.glossaryDeepSection}>
                  <strong>הסבר הנדסי מעמיק:</strong> {term.deepExplanationHe}
                </div>

                {term.exampleHe && (
                  <div className={styles.glossaryExampleBox}>
                    <strong>💡 דוגמה מהמערכת:</strong> {term.exampleHe}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

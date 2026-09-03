"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PIPELINE_GLOSSARY, type GlossaryTerm } from "./data/glossary";
import { CHROME, GLOSSARY_CATEGORY_LABELS, glossaryTermCopy } from "./copy";
import styles from "./visualizer.module.css";

interface TermsGlossaryModalProps {
  isOpen: boolean;
  initialSearch?: string;
  onClose: () => void;
}

export function TermsGlossaryModal({
  isOpen,
  initialSearch = "",
  onClose,
}: TermsGlossaryModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={CHROME.glossaryTitle}
      description={CHROME.glossarySubtitle}
      variant="modal"
      size="wide"
      closeLabel={CHROME.glossaryClose}
    >
      {isOpen ? (
        <GlossaryBody key={initialSearch} initialSearch={initialSearch} />
      ) : null}
    </Dialog>
  );
}

function GlossaryBody({ initialSearch }: { initialSearch: string }) {
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredTerms = useMemo(() => {
    return PIPELINE_GLOSSARY.filter((t: GlossaryTerm) => {
      if (selectedCategory !== "all" && t.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const english = glossaryTermCopy(t.termEn);
      return (
        t.termEn.toLowerCase().includes(q) ||
        t.termHe.toLowerCase().includes(q) ||
        (english?.short.toLowerCase().includes(q) ?? false) ||
        (english?.deep.toLowerCase().includes(q) ?? false) ||
        (t.relatedDbTable && t.relatedDbTable.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  return (
    <>
      <div className={styles.glossarySearchRow}>
        <input
          type="search"
          className={styles.glossarySearchInput}
          aria-label={CHROME.glossarySearchLabel}
          placeholder={CHROME.glossarySearch}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className={styles.glossaryCategoryTabs}>
          {Object.entries(GLOSSARY_CATEGORY_LABELS).map(([cat, label]) => (
            <Button
              key={cat}
              type="button"
              variant="filter"
              size="xs"
              isActive={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.glossaryListContainer}>
        {filteredTerms.length === 0 ? (
          <div className={styles.glossaryEmptyState}>
            {CHROME.glossaryEmpty(searchQuery)}
          </div>
        ) : (
          filteredTerms.map((term: GlossaryTerm) => {
            const english = glossaryTermCopy(term.termEn);
            return (
              <div key={term.termEn} className={styles.glossaryCard}>
                <div className={styles.glossaryCardTop}>
                  <div className={styles.glossaryTitleGroup}>
                    <h3 className={styles.glossaryTermHe}>{term.termEn}</h3>
                  </div>
                  {term.relatedDbTable && (
                    <span className={styles.glossaryTableTag} dir="ltr">
                      {CHROME.glossaryTable}: <code>{term.relatedDbTable}</code>
                    </span>
                  )}
                </div>

                {english ? (
                  <>
                    <p className={styles.glossaryShortDesc}>{english.short}</p>
                    <div className={styles.glossaryDeepSection}>
                      <strong>{CHROME.glossaryDeep}:</strong> {english.deep}
                    </div>
                    {english.example && (
                      <div className={styles.glossaryExampleBox}>
                        <strong>{CHROME.glossaryExample}:</strong> {english.example}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

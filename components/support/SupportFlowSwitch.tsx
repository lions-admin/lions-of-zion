'use client';

/**
 * The initial choice /support-us opens with (SUPPORT-001).
 *
 * The page used to present four asks at once — a report form, a volunteer
 * form with its own sub-grid, a share control and a PayPal embed — and a
 * reader had to read all four to act on one. This asks once: *how do you want
 * to help?* Then it shows that flow and nothing else.
 *
 * Three constraints shaped the implementation, and each of them ruled out the
 * obvious alternative:
 *
 * **Entered data survives a change of mind.** "Back/change preserves entered
 * data" is the acceptance criterion, so the panels stay mounted and are hidden
 * with the `hidden` attribute — half a filled-in report is not thrown away
 * because someone looked at the volunteer flow. Routing between four
 * sub-pages, or unmounting the inactive panels, would lose it.
 *
 * **Every flow is reachable with scripting off.** The chooser is four
 * `<button>`s, which do nothing without JavaScript, so the no-JS tier gets a
 * different composition: the chooser and the per-panel back controls are
 * removed and all four panels are revealed at once — the page as it was, which
 * is a fine page, just a longer one. `<style>` inside `<noscript>` is the only
 * way a prerendered page can branch on whether scripting ran; the two forms on
 * this page already use it for the same reason. An author rule on
 * `.flow[hidden]` outranks the UA stylesheet's `display: none`, which is the
 * whole of what the `hidden` attribute does.
 *
 * **`/corrections` deep-links to `/support-us#report`.** A reader sent here to
 * report an error must land on the report flow, not on a chooser with the
 * report panel hidden behind it. The hash selects the flow on mount and on
 * every later `hashchange`.
 *
 * The panels themselves are server-rendered and arrive as props: everything
 * this file knows is which one is showing.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import styles from './support-flows.module.css';

export type SupportFlow = {
  /** Also the panel's DOM id, so `/support-us#report` opens it. */
  id: string;
  /** The choice, as a reader would say it: "Report a claim". */
  label: string;
  /** One line under the choice — what this flow actually does. */
  summary: string;
  /** The one gold choice. Exactly one flow may carry it. */
  emphasis?: 'primary' | 'secondary';
  /** The mark on the choice card. */
  icon?: IconName;
  panel: ReactNode;
};

export function SupportFlowSwitch({ flows }: { flows: readonly SupportFlow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const headings = useRef(new Map<string, HTMLHeadingElement | null>());
  const options = useRef(new Map<string, HTMLButtonElement | null>());
  /* Focus follows the reader's own action only. Opening a flow from the URL
     hash must not steal focus from wherever the browser put it. */
  const moveFocus = useRef(false);

  const ids = flows.map((flow) => flow.id).join(',');

  useEffect(() => {
    const valid = new Set(ids.split(','));
    const fromHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (valid.has(hash)) setActive(hash);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [ids]);

  /* Focus lands where the reader's attention has to go: inside the panel that
     just opened, or back on the choice they just left. Without this a screen
     reader is told nothing happened, and a keyboard reader is left tabbing
     from a control that is no longer on the page. */
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (active) headings.current.get(active)?.focus();
  }, [active]);

  const open = useCallback((id: string) => {
    moveFocus.current = true;
    setActive(id);
  }, []);

  const close = useCallback((id: string) => {
    setActive(null);
    /* The chooser is what returns, so focus returns to the choice that was
       taken — not to the top of the page. */
    window.requestAnimationFrame(() => options.current.get(id)?.focus());
  }, []);

  return (
    <div className={styles.switcher}>
      <noscript>
        <style>{`
          .${styles.chooser} { display: none; }
          .${styles.flow}[hidden] { display: block; }
          .${styles.flow} + .${styles.flow} { margin-top: var(--sp-7); }
          .${styles.flowBack} { display: none; }
        `}</style>
      </noscript>

      <ul className={styles.chooser} hidden={active !== null}>
        {flows.map((flow) => (
          <li key={flow.id} className={styles.choice}>
            {/* The whole card is the control: one target, one focus ring, and
                the summary is part of the accessible name. */}
            <button
              ref={(node) => {
                options.current.set(flow.id, node);
              }}
              type="button"
              className={styles.choiceButton}
              data-emphasis={flow.emphasis === 'primary' ? 'primary' : undefined}
              onClick={() => open(flow.id)}
            >
              {flow.icon ? (
                <span className={styles.choiceMark} aria-hidden="true">
                  <Icon name={flow.icon} size={20} strokeWidth={1.5} />
                </span>
              ) : null}
              <span className={styles.choiceLabel}>{flow.label}</span>
              <span className={styles.choiceSummary}>{flow.summary}</span>
              <span className={styles.choiceArrow} aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>

      {flows.map((flow) => (
        <section
          key={flow.id}
          id={flow.id}
          className={styles.flow}
          hidden={active !== flow.id}
          aria-labelledby={`${flow.id}-title`}
        >
          <div className={styles.flowHeader}>
            <h3
              id={`${flow.id}-title`}
              className={styles.flowTitle}
              /* Focus target, not a tab stop: -1 keeps it out of the tab
                 order while letting the panel announce itself when it opens. */
              tabIndex={-1}
              ref={(node) => {
                headings.current.set(flow.id, node);
              }}
            >
              {flow.label}
            </h3>
            {/* Text variant, so the page's gold stays on the one control
                inside the flow that acts. Nothing typed is lost by pressing
                it — the panel is hidden, never unmounted. */}
            <Button
              type="button"
              variant="text"
              size="sm"
              className={styles.flowBack}
              onClick={() => close(flow.id)}
            >
              Choose another way
            </Button>
          </div>
          {flow.panel}
        </section>
      ))}
    </div>
  );
}

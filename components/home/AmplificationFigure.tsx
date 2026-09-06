"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./homepage-journey.module.css";

export function AmplificationFigure() {
  const [traced, setTraced] = useState(false);
  const id = useId();

  return (
    <figure className={styles.amplification} data-traced={traced} aria-labelledby={`${id}-caption`}>
      <figcaption id={`${id}-caption`}>
        <span className={styles.kicker}>Anatomy of an echo</span>
        <span>Fictional example · not a news report</span>
      </figcaption>
      <ol className={styles.echoSequence} id={`${id}-sequence`} aria-label="How one claim becomes three versions">
        <li>
          <header><span className={styles.echoStep}>01</span><span>Original post</span></header>
          <blockquote>“<mark>I think</mark> the crossing is closed.”</blockquote>
          <p className={styles.echoAnnotation}>
            {traced ? "The only original source in this example." : "One person’s impression. No confirmation."}
          </p>
        </li>
        <li>
          <header><span className={styles.echoStep}>02</span><span>The repost</span></header>
          <blockquote>“<mark>Reports say</mark> the crossing is closed.”</blockquote>
          <p className={styles.echoAnnotation}>
            {traced ? "Cites the original post. Adds no new evidence." : "The uncertainty disappears. Nothing new is added."}
          </p>
        </li>
        <li className={styles.echoHeadline}>
          <header><span className={styles.echoStep}>03</span><span>The headline</span></header>
          <blockquote>Crossing closed,<br /><mark>multiple reports</mark> say.</blockquote>
          <p className={styles.echoAnnotation}>
            {traced ? "Cites the repost—which leads back to the original post." : "The copies now sound like independent confirmation."}
          </p>
        </li>
      </ol>
      <div className={styles.echoReading}>
        <div className={styles.echoResult} aria-live="polite" aria-atomic="true">
          <span className={styles.echoNumeral} aria-hidden="true">{traced ? "1" : "3"}</span>
          <h4>{traced ? <>One source.<br />Not three witnesses.</> : <>Three versions.<br />How many sources?</>}</h4>
          <p>{traced
            ? "All three lead back to the same unverified post. The wording became more certain. The evidence did not."
            : "A post, a repost and a headline can look like corroboration. Follow what each one actually cites."}</p>
        </div>
        <button type="button" className={styles.echoTraceButton}
          aria-pressed={traced} aria-controls={`${id}-sequence`}
          onClick={() => setTraced((value) => !value)}>
          <Icon name={traced ? "correction" : "search"} size={20} />
          {traced ? "Show the spread again" : "Trace the sources"}
        </button>
        <p className={styles.echoPrinciple}>Count independent sources.<br />Not repeated claims.</p>
      </div>
    </figure>
  );
}

import Link from "next/link";
import { PIPELINE_STAGES } from "./pipeline-data";
import styles from "../information-war-system.module.css";

export function DailyCycle() {
  return (
    <details className={styles.technicalNote}>
      <summary><span>Under the surface</span><span>Jobs, schedules & publication paths <i aria-hidden="true">+</i></span></summary>
      <div className={styles.technicalBody}>
        <div><h3>The briefing job chain</h3><ol className={styles.jobChain}>{PIPELINE_STAGES.map((stage) => <li key={stage.number}><span>{stage.number}</span>{stage.job}</li>)}</ol><p>This chain exists in the implementation. It is not evidence of a current run, and it is not the route taken by every public record.</p></div>
        <div><h3>Configured, not claimed live</h3><dl className={styles.schedule}><dt>Source ingestion</dt><dd>Every 30 minutes</dd><dt>Search embeddings</dt><dd>At :10 and :40 each hour</dd><dt>Queued follow-up work</dt><dd>Every 15 minutes</dd><dt>Maintenance</dt><dd>03:20 UTC</dd></dl><p>The deployment configuration does not schedule the daily briefing route. Editions can also arrive through external publication and import workflows. Actual execution depends on deployment, configuration and available services.</p></div>
      </div>
    </details>
  );
}

const OUTPUTS = [
  { href: "/geopolitical-brief", title: "News & Analysis", category: "Understand the developments", text: "News, war updates and daily briefing coverage, with the sources and context behind the reporting." },
  { href: "/fact-check", title: "Claims & findings", category: "Examine the assertion", text: "Read the assessment, the available material, and what has or has not been established." },
  { href: "/october-7", title: "The October 7 archive", category: "Return to the record", text: "Explore documented material in a dedicated archive, separate from the daily news cycle." },
  { href: "/search", title: "Search the evidence desk", category: "Follow your own question", text: "Find public material. Use Ask for conversation and available citations, not as a substitute for opening the sources." },
] as const;

export function OutputsFork() {
  return <nav className={styles.outputMap} aria-label="Explore the public work">{OUTPUTS.map((output, index) =>
    <Link key={output.href} href={output.href}><span className={styles.outputNumber}>{String(index + 1).padStart(2, "0")}</span><div><span className={styles.eyebrow}>{output.category}</span><h3>{output.title}</h3><p>{output.text}</p></div><span className={styles.outputArrow} aria-hidden="true">↗</span></Link>,
  )}</nav>;
}

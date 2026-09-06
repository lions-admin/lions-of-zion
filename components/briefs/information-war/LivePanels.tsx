import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { SECTION_LABELS } from "@/components/live/publication-labels";
import styles from "../information-war-system.module.css";

function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

/** Only actual public records. A successful read is not a system-health signal. */
export async function RecentActivity() {
  let rows: Awaited<ReturnType<typeof listBriefingPublications>>;
  try {
    rows = await listBriefingPublications("?limit=4");
  } catch {
    return <div className={styles.emptyRecord}><h4>The record could not be loaded.</h4><p>We cannot show the latest publications right now. No example entries have been substituted.</p><Link href="/information-war#activity">Try again ↗︎</Link></div>;
  }
  if (rows.length === 0) {
    return <div className={styles.emptyRecord}><h4>No publications returned.</h4><p>There are no entries to display for this read. Explore the public sections above.</p></div>;
  }
  return <ol className={styles.activityList}>{rows.map((row) => <li key={row.publicId}>
    <time dateTime={row.publishedAt}>{formatStamp(row.publishedAt)}</time>
    <div><span>{SECTION_LABELS[row.section]}</span><Link href={`/articles/${row.publicId}`}>{row.title}</Link></div>
    <span aria-hidden="true">↗︎</span>
  </li>)}</ol>;
}

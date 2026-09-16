import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { SECTION_LABELS } from "@/components/live/publication-labels";
import { RecordUnavailable } from "./RecordUnavailable";
import styles from "../information-war-system.module.css";
import { Icon } from "@/components/ui/Icon";

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
    return <RecordUnavailable />;
  }
  if (rows.length === 0) {
    return <div className={styles.emptyRecord}><h4>No publications returned.</h4><p>There are no entries to display for this read. Explore the public sections above.</p></div>;
  }
  return <ol className={styles.activityList}>{rows.map((row) => <li key={row.publicId}>
    <time className={styles.activityTime} dateTime={row.publishedAt}>{formatStamp(row.publishedAt)}</time>
    <div><span className={styles.activitySection}>{SECTION_LABELS[row.section]}</span><Link href={`/articles/${row.publicId}`}>{row.title}</Link></div>
    <Icon name="arrow-right" inline className="arrow" />
  </li>)}</ol>;
}

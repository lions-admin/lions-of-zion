import Link from "next/link";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { listBriefingPublications } from "@/lib/publications";
import { getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { COLLECTION_CADENCE } from "./pipeline-data";
import styles from "@/components/briefs/information-war-system.module.css";

/** Small date formatter pinned to the site timezone. */
function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Operational status from public reads only.
 *
 * No per-stage job telemetry exists on any public surface, so this panel
 * reports what the public record proves (latest edition, counts) alongside
 * the collection cadence — and says plainly what it cannot show.
 */
export async function OperationalStatus() {
  let latest: string | null = null;
  let editionCount = 0;
  let checkCount = 0;
  try {
    const [editions, checks] = await Promise.all([
      listBriefingPublications("?limit=5"),
      getNarrativeWatchFeed(),
    ]);
    editionCount = editions.length;
    checkCount = checks.length;
    latest = editions[0]?.publishedAt ?? checks[0]?.publishedAt ?? null;
  } catch {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        eyebrow="SYSTEM STATUS"
        title="The public record could not be read."
        description="This is a fault on our side, not an idle system. Published work is unaffected and returns when the read succeeds."
        actionText="Try again"
        actionHref="/information-war#system"
      />
    );
  }

  return (
    <div className={styles.statusGrid} role="status" aria-label="System status from the public record">
      <div>
        <p className={styles.statusLabel}>System</p>
        <p className={styles.statusValue}>Online — public record readable</p>
      </div>
      <div>
        <p className={styles.statusLabel}>Latest public record</p>
        <p className={styles.statusValue} dir="ltr">
          {latest ? formatStamp(latest) : "No telemetry available"}
        </p>
      </div>
      <div>
        <p className={styles.statusLabel}>Collection cadence</p>
        <p className={styles.statusValue}>{COLLECTION_CADENCE}</p>
      </div>
      <div>
        <p className={styles.statusLabel}>Per-stage job state</p>
        <p className={styles.statusValue}>No telemetry available — internal only</p>
      </div>
      <p className={styles.statusNote}>
        {editionCount > 0 || checkCount > 0 ? (
          <>
            Recent public output is listed below. What the system has produced is public: every entry is in the{" "}
            <Link href="/updates">updates feed</Link>, and every checked claim is on the{" "}
            <Link href="/fact-check">fact-check desk</Link>.
          </>
        ) : (
          <>No public records were returned for this read. Per-stage figures are internal and never invented here.</>
        )}
      </p>
    </div>
  );
}

/**
 * Recent pipeline activity — strictly the public record, newest first.
 *
 * Labelled as such so no reader mistakes publication timestamps for a live
 * job monitor.
 */
export async function RecentActivity() {
  let rows: { publicId: string; title: string; publishedAt: string; section: string }[] = [];
  try {
    const editions = await listBriefingPublications("?limit=8");
    rows = editions.map((row) => ({
      publicId: row.publicId,
      title: row.title,
      publishedAt: row.publishedAt,
      section: row.section,
    }));
  } catch {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        eyebrow="RECENT ACTIVITY"
        title="Recent activity could not be read."
        description="The public record is temporarily unreachable. Nothing below is synthesised to fill the gap."
        actionText="Try again"
        actionHref="/information-war#activity"
      />
    );
  }

  if (rows.length === 0) {
    return (
      <StatusState
        status={absenceStatus("nothing-published")}
        eyebrow="RECENT ACTIVITY"
        title="No public records yet for this window."
        description="An entry appears here only once it has cleared the evidence and quality gates."
        actionText="How publication works"
        actionHref="/information-war#system"
      />
    );
  }

  return (
    <ol className={styles.activityList}>
      {rows.map((row) => (
        <li key={row.publicId}>
          <time dateTime={row.publishedAt} dir="ltr">
            {formatStamp(row.publishedAt)}
          </time>
          <div>
            <Link href={`/articles/${row.publicId}`}>{row.title}</Link>
            <p dir="ltr">{row.section.replace(/_/g, " ")}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

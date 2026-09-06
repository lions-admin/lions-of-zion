import type { Metadata } from "next";
import Link from "next/link";
import { AntisemitismRecord } from "@/components/briefs/AntisemitismRecord";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { getAntisemitismFeed } from "@/lib/content/fake-resistance-watch";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const PAGE_URL = `${SITE_URL}/fake-resistance/antisemitism`;
const description = "Documented antisemitism incidents and trends, with sourced records, context, and limits.";

export const metadata: Metadata = {
  title: "Antisemitism records",
  description,
  alternates: { canonical: PAGE_URL },
};

export default async function Page() {
  let items: Awaited<ReturnType<typeof getAntisemitismFeed>> = [];
  let unavailable = false;
  try { items = await getAntisemitismFeed(); } catch { unavailable = true; }
  return (
    <SectionPage
      id="fake-resistance"
      breadcrumb={[{ href: "/fake-resistance", label: "Narratives & fact checks" }]}
      accent="ember"
      surface="quiet"
      register="silent"
      title="Antisemitism records"
      tagline="Documented incidents, patterns, and risks. Each record distinguishes confirmed facts, context, and what is still unknown."
    >
      <p className={styles.intro}>Use the location or platform field to orient yourself, then open the source record before sharing it. A label does not establish coordination, motive, or scale beyond the evidence shown.</p>
      <p><Link href="/fake-resistance">Return to Narratives & fact checks</Link> · <Link href="/geopolitical-brief">Read the news desk</Link></p>
      {unavailable ? <p className={styles.empty} role="alert">Antisemitism records are temporarily unavailable.</p>
        : items.length ? <SectionBlock heading="Published records">{items.map(item => <AntisemitismRecord key={item.publicId} item={item} />)}</SectionBlock>
          : <p className={styles.empty}>No antisemitism records have been published yet.</p>}
      <aside className={styles.resources} aria-labelledby="resources-heading">
        <h2 id="resources-heading">When a record raises concern</h2>
        <p>Preserve the original source, report imminent danger to local emergency services, and use the article’s cited official resources where they are provided. Do not treat a single post as proof of a wider campaign.</p>
      </aside>
    </SectionPage>
  );
}

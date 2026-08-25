import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";

const TAGLINE =
  "How claims are sourced, labeled, and corrected across every desk.";

export const metadata: Metadata = {
  title: "Methodology",
  description: TAGLINE,
  openGraph: { title: "Methodology — LIONS OF ZION", description: TAGLINE },
};

export default function Page() {
  return (
    <DocPage routeId="methodology" title="Methodology" tagline={TAGLINE}>
      <SectionBlock heading="How claims are labeled">
        <p>
          Every assessed item on this site carries one of nine labels:{" "}
          <strong>verified</strong>, <strong>false</strong>,{" "}
          <strong>misleading</strong>, <strong>manipulated</strong>,{" "}
          <strong>out of context</strong>, <strong>contested</strong>,{" "}
          <strong>unsupported</strong>, <strong>unverified</strong>, or{" "}
          <strong>satire</strong>. The label is shown next to the claim it
          describes and travels with the item wherever it is shared. No
          assessed claim appears without one.
        </p>
      </SectionBlock>

      <SectionBlock heading="Operational reporting">
        <p>
          Reporting on the front draws on official statements cross-checked
          against open sources — footage, flight data, published imagery —
          and states only what that record supports. Where the fog is real,
          the reporting says so. There is no speculation about ongoing
          operations, and nothing that could endanger the people carrying
          them out.
        </p>
      </SectionBlock>

      <SectionBlock heading="Civilian reporting">
        <p>
          The war is also lived far from the line: sirens and shelters,
          evacuated communities, the families of hostages, the slow work of
          rebuilding. Reporting from the home front holds to the same
          standard as reporting from the front — named sources, stated times
          — because the civilian record is the part most often distorted, and
          the part most worth getting right.
        </p>
      </SectionBlock>

      <SectionBlock heading="Corrections">
        <p>
          A network that verifies will still sometimes be wrong. When that
          happens, the correction is made as loud as the original claim: the
          item is amended in place, marked as corrected, and the change is
          announced through the same channels that carried the error.
          Corrected items are never quietly deleted — the record of the
          correction is part of the record. The full policy and public log
          are on the <Link href="/corrections">Corrections</Link> page.
        </p>
      </SectionBlock>
    </DocPage>
  );
}

import { ClaimRecordPair } from 'lions-of-zion';

/**
 * The core rhetorical move of the Fake Resistance page: the claim as it
 * travelled on the left, what the record actually shows on the right. Both
 * cases below are real, from `lib/content/fake-resistance.ts`.
 */

export function ClaimVersusRecord() {
  return (
    <ClaimRecordPair
      claimLabel="As it spread"
      recordLabel="What the record shows"
      claim={
        <p>
          Clips shared widely on TikTok and X in the days after October 7, 2023 — one flagged
          post alone drew more than 3 million views — were captioned as real footage of the
          fighting between Israel and Hamas.
        </p>
      }
      record={
        <p>
          The footage was not war video. It was gameplay recorded from Arma 3, a military
          simulation game released by Bohemia Interactive in 2013 — a decade before the war it
          was being used to illustrate.
        </p>
      }
    />
  );
}

/** Default labels, and a shorter pair. */
export function DefaultLabels() {
  return (
    <ClaimRecordPair
      claim={
        <p>
          A video showing people rushing out of their homes in Haifa was shared with a caption
          claiming it showed Hezbollah militants who had infiltrated northern Israel.
        </p>
      }
      record={<p>The footage predated the claim and showed an unrelated evacuation drill.</p>}
    />
  );
}

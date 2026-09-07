# Duplicate-publication reconciliation — 2026-09-07

This is a read-only production audit. It neither archives nor redirects a
publication. The listed source URLs are the evidence records already attached
to the public record.

## Method

- Live rows: `publication.status IN ('published', 'updated')`.
- Exact canonical IDs: grouped by `canonical_story_id`.
- Source candidates: pairs joined through `publication_evidence`.
- A pair is only called likely duplicate below when the titles and shared
  source set describe the same event. Other source overlap can be a legitimate
  contextual citation and remains a manual-review signal.

Production result at audit time: **0 exact canonical-ID duplicates** and
**53 shared-evidence pairs**. The latter is not a count of duplicates.

## Likely duplicates — manual review required

| Candidate | Public IDs and publication dates | Canonical IDs | Shared sources | Homepage / versions / related links | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Civil-defence data initiative | `israel-s-open-civil-defence-data-initiative-cont-mv6ck` — 2026-09-03 16:17 UTC; `israel-s-open-civil-defence-data-initiative-cont-fgpr4` — 2026-09-03 16:48 UTC | None / none | `data.gov.il/dataset/shelters-verification-check-2026-09-02`; `jpost.com/israel-news/civil-defence-data-transparency-review-2026` | Neither is on the homepage; one version each; no related links | **Archive duplicate or redirect after editorial confirmation.** Titles and both sources are identical. Keep the earlier public ID unless an editor identifies a material distinction. |
| Ali al-Taher tunnels | `idf-clears-hezbollah-tunnels-under-ali-al-taher--ak2iu` — 2026-09-04 01:52 UTC; `idf-clears-ali-al-taher-tunnels-as-gaza-yellow-l-98jch` — 2026-09-04 01:52 UTC | None / none | Reuters ridge report; Times of Israel tunnel report; IDF post `2095569785522360508` | Neither is on the homepage; one version each; the later record has three related links | **Manual review, then merge/redirect if they describe the same development.** Preserve the later record’s additional sources and related links before any archival action. |
| West Bank outposts | `netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx` — 2026-09-06 22:15 UTC; `netanyahu-orders-unauthorized-west-bank-outposts-kb1l1` — 2026-09-07 01:18 UTC | `west-bank-unauthorized-outposts-removal-2026-09-06` / `netanyahu-orders-unauthorized-west-bank-outposts-removed-2026-09-06` | Reuters outpost report; Reuters ambassador/settler-violence report | First is `news/secondary`, two versions; second has no homepage placement, one version; neither has related links | **Manual review, then merge/redirect.** This is the clearest case of two canonical IDs for one event; retain the existing homepage placement and choose one canonical ID before changing public records. |
| BGU oil-remediation aerogel | `ben-gurion-university-team-develops-aerogel-that-0y2we` — 2026-09-06 22:15 UTC; `ben-gurion-university-aerogel-can-absorb-100-tim-cb3o1` — 2026-09-07 01:18 UTC | `bgu-oil-spill-aerogel-2026` / `bgu-oil-biodegrading-aerogel-2026` | `bgu.ac.il/en/news-and-articles/bgu-aerogel-adsorbs-oil-and-supports-biodegradation/`; Times of Israel oil-spill report | First has two versions and no homepage slot; second is `people/secondary`, one version; no related links | **Manual review, then merge/redirect.** Preserve the People hub placement and source stack on the retained record. |

## Contextual overlaps — keep unless an editor finds a duplicate event

The September 3 security/diplomacy briefs share four of five sources:
`israel-security-and-diplomacy-brief-september-3--xgjvx` (17:55 UTC) and
`israel-security-diplomacy-and-anti-boycott-brief-4xspk` (20:33 UTC). Their
titles and related-record sets differ, so this audit recommends **keep both**
until an editor determines that the latter merely republished the former.

The remaining shared-evidence pairs have one or two reused contextual sources.
They are not candidates for automatic action.

## Safe follow-up

1. An editor chooses the retained record for each candidate.
2. Copy unique sources, version context and related links to that record.
3. Use the reversible archival/redirect path; do not delete the historical row.
4. Confirm its canonical ID and homepage placement after the change.

The create boundary now refuses a new record when it finds an existing exact
canonical ID, the same event ID, or a shared evidence record plus a strongly
matching title. The refusal names the existing
public ID and requires an explicit update or a deliberate editorial decision.

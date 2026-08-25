import { PublicationMeta } from 'lions-of-zion';

/** The full meta block, as `app/war-update/page.tsx` renders it. */
export function FullBlock() {
  return (
    <PublicationMeta
      edition="Edition 01 · October 2025 ceasefire"
      publishedAt="25 Aug 2026"
      reviewedBy="Editorial desk"
      sourceCount={9}
    />
  );
}

/** Only the props you pass are rendered — nothing is stubbed in. */
export function Minimal() {
  return <PublicationMeta publishedAt="24 Aug 2026" sourceCount={3} />;
}

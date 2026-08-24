export type BriefStatus = 'Confirmed' | 'Attributed' | 'Unverified' | 'Disputed' | 'Corrected';

export interface BriefSource {
  id: string;
  publisher: string;
  title: string;
  published: string;
  type: 'Official record' | 'Parliamentary record';
  url: string;
}

export const geopoliticalReferenceBrief = {
  edition: 'Reference brief 001',
  title: "Israel's eastern border",
  headline: 'The strategic scope is defined. Delivery remains phased.',
  dek: 'Official records describe a planned multi-layer barrier of roughly 500 kilometres. A June parliamentary review said that 80 kilometres had been funded at that point.',
  status: 'Confirmed' as BriefStatus,
  coverageWindow: '07 Jan — 24 Jun 2026',
  publishedAt: '24 Aug 2026 · 14:00 IDT',
  reviewedBy: 'Editorial reference desk',
  sourceCount: 3,
  summary: [
    'Israel’s Ministry of Defense has described a multi-layer security system planned along approximately 500 kilometres of the eastern border, with an estimated programme cost of NIS 5.5 billion.',
    'Public implementation remains phased. A Knesset committee review on 24 June said that only 80 kilometres had been funded at that stage, while wider security and civilian plans were still being advanced.',
  ],
  figures: [
    { value: '≈500 km', label: 'Announced programme scope' },
    { value: '80 km', label: 'Publicly reported funded by 24 Jun' },
    { value: 'NIS 5.5B', label: 'Ministry programme estimate' },
  ],
  changes: [
    'The June parliamentary record adds a public funding boundary to the earlier ministry announcement.',
    'The programme is broader than a physical barrier: official records also describe security infrastructure and civilian settlement planning.',
    'No public source reviewed for this edition establishes a fully funded completion schedule for the entire announced scope.',
  ],
  developments: [
    {
      date: '07 Jan 2026',
      status: 'Confirmed' as BriefStatus,
      title: 'Ministry defines the full programme',
      body: 'The Ministry of Defense described a multi-layer system along approximately 500 kilometres of the eastern border and estimated the programme at NIS 5.5 billion.',
      sourceIds: ['mod-barrier'],
    },
    {
      date: '07 Jan 2026',
      status: 'Confirmed' as BriefStatus,
      title: 'Enabling works are under way',
      body: 'The same ministry update documented the controlled destruction of roughly 500 legacy anti-tank mines as part of construction-enabling work.',
      sourceIds: ['mod-barrier'],
    },
    {
      date: '24 Jun 2026',
      status: 'Attributed' as BriefStatus,
      title: 'Parliamentary review exposes the funding gap',
      body: 'A Knesset committee press release reported that an IDF representative said only 80 kilometres of the planned barrier had been funded at that point.',
      sourceIds: ['knesset-review', 'knesset-record'],
    },
  ],
  assessment: 'The public record supports a strategic direction, but not a single fully funded 500-kilometre construction event. Until budget authorisations and delivery milestones are published, the programme is best understood as a phased security and regional-development effort.',
  unknowns: [
    'How much additional construction has been funded since the June committee review.',
    'The procurement sequence and completion dates for each segment.',
    'Which civilian-development elements are approved, funded, or still proposed.',
  ],
  changeConditions: [
    'A published appropriation covering additional segments.',
    'Tender awards or ministry milestones with delivery dates.',
    'A later parliamentary review documenting funded and completed kilometres.',
  ],
  sources: [
    {
      id: 'mod-barrier',
      publisher: 'Israel Ministry of Defense',
      title: 'Construction of the Eastern Border Security Barrier Expands',
      published: '07 Jan 2026',
      type: 'Official record',
      url: 'https://mod.gov.il/en/press-releases/press-room/construction-of-the-eastern-border-security-barrier-expands',
    },
    {
      id: 'knesset-review',
      publisher: 'The Knesset',
      title: 'Special Committee: entire eastern-border region is being prioritized',
      published: '24 Jun 2026',
      type: 'Parliamentary record',
      url: 'https://main.knesset.gov.il/EN/News/PressReleases/Pages/press24626u.aspx',
    },
    {
      id: 'knesset-record',
      publisher: 'The Knesset',
      title: 'Committee broadcast and meeting record',
      published: '24 Jun 2026',
      type: 'Parliamentary record',
      url: 'https://main.knesset.gov.il/en/APPS/committees/2236/broadcasts',
    },
  ] satisfies BriefSource[],
  corrections: [
    {
      version: 'v1.0',
      date: '24 Aug 2026',
      note: 'Initial reference edition. No corrections recorded.',
    },
  ],
} as const;

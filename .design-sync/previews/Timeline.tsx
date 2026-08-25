import { Timeline } from 'lions-of-zion';

/**
 * Three variants, three real corpora — the entries are taken verbatim from
 * `lib/content/war-update.ts` and `lib/content/israels-story.ts`. The variant
 * is the primary axis: `feed` for a dated news run, `history` for a historical
 * arc, `spread` for how a false claim propagated.
 *
 * Each entry's `sources` render in the right margin above 1220px — the
 * evidence-beside-the-claim contract. Here they render inline, which is the
 * same markup at a narrower measure.
 */

const ceasefire = [
  {
    id: 'plan-announced',
    datetime: '2025-09-29',
    dateLabel: 'Sept 29, 2025',
    category: 'Diplomacy',
    assessment: 'verified' as const,
    title: 'A 20-point plan for Gaza is presented at the White House',
    body: (
      <p>
        A twenty-point plan is presented, framed as a comprehensive end to the war — the
        roadmap the ceasefire signed eleven days later is built on.
      </p>
    ),
    sources: [
      {
        id: 'toi-full-text',
        label: 'Full text of the Oct. 9 Israel-Hamas deal',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/',
      },
    ],
  },
  {
    id: 'ceasefire-signed',
    datetime: '2025-10-09',
    dateLabel: 'Oct 9, 2025',
    category: 'Diplomacy',
    assessment: 'verified' as const,
    title: 'Israel and Hamas sign a ceasefire-hostage agreement in Sharm el-Sheikh',
    body: (
      <p>
        The agreement covers a phased release of hostages and detainees, a withdrawal from
        parts of Gaza, a surge in humanitarian aid, and the return of displaced Gazans.
      </p>
    ),
    sources: [{ id: 'npr', label: 'What happens next', kind: 'NPR', url: 'https://www.npr.org/' }],
  },
  {
    id: 'ceasefire-effective',
    datetime: '2025-10-10',
    dateLabel: 'Oct 10, 2025',
    category: 'Front · Home front',
    assessment: 'verified' as const,
    title: 'The ceasefire takes effect',
    body: <p>A formal ceasefire begins across Gaza. A peace summit follows on October 13.</p>,
  },
];

export function Feed() {
  return <Timeline entries={ceasefire} />;
}

export function History() {
  return (
    <Timeline
      variant="history"
      entries={[
        {
          id: 'balfour-1917',
          datetime: '1917-11-02',
          dateLabel: 'November 1917',
          title: 'The Balfour Declaration',
          body: (
            <p>
              The British government states its support for the establishment of a national home
              for the Jewish people in Palestine.
            </p>
          ),
        },
        {
          id: 'six-day-1967',
          datetime: '1967-06-05',
          dateLabel: 'June 1967',
          title: 'The Six-Day War',
          body: (
            <p>
              Six days of fighting redraw the map, leaving Israel in control of the Sinai, the
              Golan Heights, the West Bank and Gaza.
            </p>
          ),
        },
      ]}
    />
  );
}

export function Spread() {
  return (
    <Timeline
      variant="spread"
      entries={[
        {
          id: 'arma-posted',
          datetime: '2023-10-08',
          dateLabel: '8 Oct 2023',
          category: 'TikTok · X',
          assessment: 'manipulated' as const,
          title: 'Gameplay footage is captioned as combat video',
          body: (
            <p>
              Clips recorded from Arma 3, a military simulation released in 2013, circulate as
              real footage. One flagged post alone draws more than 3 million views.
            </p>
          ),
        },
        {
          id: 'arma-debunked',
          datetime: '2023-10-10',
          dateLabel: '10 Oct 2023',
          category: 'Fact check',
          assessment: 'false' as const,
          title: 'The footage is identified and the claim collapses',
          body: <p>The source game is named; the clips keep circulating under new captions.</p>,
        },
      ]}
    />
  );
}

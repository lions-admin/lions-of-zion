/**
 * The playbook — the manipulation techniques, treated in full.
 *
 * The section is presented through *how the manipulation works*, not as a
 * network diagram (owner direction; `.ai/DECISIONS.md`). This module is that
 * frame's canonical text: one chapter per technique, and the controlled
 * vocabulary every technique chip on the site resolves against.
 *
 * Three of a chapter's four parts — the move, the psychology, the recognition
 * cues — are editorial writing about influence operations generally. They name
 * techniques, never people, which is what lets this page publish ahead of the
 * case files and their gates.
 *
 * `documented` is the fourth part and the only one tied to this site's
 * evidence. Each entry points at material already published here: the three
 * reference exhibits on `/fake-resistance`, or a case file once it clears the
 * editorial pass. **A technique may not claim an example it cannot show** —
 * that rule is what separates these pages from the accounts they describe, and
 * `tests/fake-resistance-research.test.ts` holds the vocabulary to it.
 *
 * Unlike `home.ts` this module is not in the home route's render path, so its
 * synchronous export is a convenience rather than a constraint.
 */

/** Where a documented example lives on this site. */
export type PlaybookExample = {
  /** Human label for the exhibit or case. */
  label: string;
  /** In-site href. Never an outbound link — provenance travels in sources. */
  href: string;
  /** What this example shows about the technique, in one sentence. */
  note: string;
};

export type PlaybookChapter = {
  /** Anchor id. This is the controlled vocabulary's member. */
  id: string;
  /** Chapter title — sentence case, the name of the move. */
  title: string;
  /** One line for the index and for a chip's tooltip. */
  summary: string;
  /** Part 1 — what the technique is. */
  move: string[];
  /** Part 2 — the cognitive shortcut it exploits. */
  psychology: string[];
  /** Part 3 — where it is documented on this site. May be empty before the
   *  case files clear their gates; the page says so rather than inventing one. */
  documented: PlaybookExample[];
  /** Part 4 — what a reader can check for themselves. */
  cues: string[];
};

const CHAPTERS: PlaybookChapter[] = [
  {
    id: 'verdict-captioning',
    title: 'Verdict captioning',
    summary: 'The clip supplies the feeling of evidence; the caption supplies the conclusion.',
    move: [
      'A short video is published under a caption that states a conclusion the footage does not contain. The clip might show smoke, a crowd, a damaged building, an official speaking. The caption names who did it, why, and what it proves.',
      'The two halves are doing different jobs. The footage is real and carries the authority of something recorded. The caption is an assertion, and it is the part that travels — into quote-posts, into screenshots, into the memory of anyone who scrolled past.',
    ],
    psychology: [
      'Seeing something is the most trusted way people know anything, and that trust does not stay neatly attached to what was actually seen. A viewer who watches real footage while reading a claim experiences both as one act of witnessing.',
      'What survives in memory a day later is the conclusion, not the caveat — and rarely the question of whether the video ever showed it. The clip has done its work by then: it converted an assertion into something that feels remembered rather than read.',
    ],
    documented: [
      {
        label: 'A Haifa evacuation video recaptioned as an infiltration',
        href: '/fake-resistance#haifa-video',
        note: 'Genuine footage of residents moving toward shelter, captioned as militants who had crossed the border — the video is real and shows nothing the caption claims.',
      },
    ],
    cues: [
      'Ask what the video would prove with the sound off and the caption gone. If the answer is "something happened somewhere", the caption is the whole claim.',
      'Look for the gap between what is visible and what is asserted: a name, a motive, a body count, or a location that no frame of the footage establishes.',
      'Check whether the account posting it is the one who recorded it. A caption written by someone who was not there is a claim, not a report.',
    ],
  },
  {
    id: 'authority-laundering',
    title: 'Authority laundering',
    summary: 'Credentialed voices are clipped out of context so their standing transfers to someone else’s claim.',
    move: [
      'A professor, a former official, a veteran correspondent says something in a long interview. Thirty seconds are cut out and published under a caption that pushes past what they said, or applies it to an event they never discussed.',
      'The credential does the work. The account sharing the clip has none of its own, so it borrows: the viewer is not being asked to trust the poster, but the expert on screen. The expert usually has no idea the clip exists.',
    ],
    psychology: [
      'People rationally defer to expertise, because checking everything personally is impossible. That deference attaches to the person speaking and not to the specific sentence, so an expert who is genuinely authoritative on one question lends borrowed weight to a different one.',
      'A clip also removes the hedges. Careful speakers qualify — "in this particular case", "we do not yet know" — and those qualifications are the first thing cut, because they are the least quotable part of the tape.',
    ],
    documented: [],
    cues: [
      'Find the full interview before accepting the clip. If the original is not linked, ask why a clip that supposedly speaks for itself is being kept from its own context.',
      'Notice whether the expert is speaking inside their actual field. A historian of one conflict is not a forensic authority on a video from another.',
      'Watch for the cut. Clips that begin mid-sentence and end before a "but" are usually shaped, not excerpted.',
    ],
  },
  {
    id: 'circular-sourcing',
    title: 'Circular sourcing',
    summary: 'A claim and its "confirmation" come from the same place, and the loop is presented as corroboration.',
    move: [
      'A claim is made by an interested party. Imagery or a second report appears that seems to confirm it. The two are published together as though a claim had been independently checked — but both came from the same source, sometimes republished by the same account within minutes.',
      'The structure imitates verification exactly. What is missing is the only thing verification is: a second party with separate access and a separate interest.',
    ],
    psychology: [
      'Corroboration is a real and reliable test, so the shape of it is persuasive on its own. Two sources agreeing feels like evidence even when the second one is the first one wearing a different name.',
      'Repetition compounds it. A claim encountered twice feels better established than a claim encountered once, and the mind does not reliably tag where each encounter came from.',
    ],
    documented: [],
    cues: [
      'Trace both items to their origin. If the "confirmation" is a state outlet reporting on that same state\'s claim, nothing has been confirmed.',
      'Ask who would know independently, and whether any of them have said anything.',
      'Treat an account that supplies both the claim and its own corroboration as one source, not two.',
    ],
  },
  {
    id: 'manufactured-urgency',
    title: 'Manufactured urgency',
    summary: 'Breaking-news formatting on an industrial cadence, so nothing is ever old enough to check.',
    move: [
      'Identical alert cards — a red dot, a siren, the word BREAKING — are published continuously across unrelated subjects, sometimes at a rate of one every minute or two. Individually each looks like a wire bulletin. Collectively they are a format, not a newsroom.',
      'The urgency is decorative. It is applied uniformly whether the item is a war development or a celebrity rumour, because its function is to trigger sharing, not to grade importance.',
    ],
    psychology: [
      'Urgency suppresses verification. The pause in which someone would check a claim is exactly the pause the format is designed to remove — a reader who feels they are learning something first is a reader who shares before reading twice.',
      'Constant alerting also destroys the signal it imitates. When everything is breaking, the reader loses the ability to tell a genuine bulletin from an ordinary one, which advantages whoever publishes the most.',
    ],
    documented: [],
    cues: [
      'Scroll the account\'s own feed. A real wire has quiet hours; a card factory does not.',
      'Check whether the alert names a source. Bulletins from newsrooms attribute; cards usually do not.',
      'Give it an hour. Almost nothing genuine is lost by waiting, and almost everything manufactured looks different by then.',
    ],
  },
  {
    id: 'arousal-monetization',
    title: 'Outrage as a revenue format',
    summary: 'The content is shaped by what pays, and what pays is high arousal.',
    move: [
      'Accounts in this space carry sponsorships, subscription tiers, and paid access. The commercial layer is often disclosed and entirely legal. What matters is its effect on editorial choice: formats that provoke strong reactions earn, and formats that qualify and contextualise do not.',
      'Over time this selects for a voice. The account that posts the most alarming available framing of each day\'s events outperforms the one that waits, and the incentive operates whether or not anyone involved thinks of themselves as dishonest.',
    ],
    psychology: [
      'High-arousal emotion — anger, disgust, fear — drives sharing far more reliably than sadness or interest does. A reader forwarding something furious is participating in the mechanism that selected it.',
      'The audience reads the intensity as sincerity. An account that is always outraged looks like one that cares most, when it may only be the one best adapted to what the format rewards.',
    ],
    documented: [],
    cues: [
      'Look for the business model — a sponsor, a paywall, a merchandise line, a paid unblocking service. It is not disqualifying, but it tells you what the account is optimising for.',
      'Ask whether this account has ever posted a de-escalating correction. Formats that pay for outrage rarely produce one.',
      'Compare its account of an event with a wire report of the same event, and notice which words were added.',
    ],
  },
  {
    id: 'recycled-media',
    title: 'Recycled media',
    summary: 'Footage from another war, another year, or a video game, recaptioned into today.',
    move: [
      'Real imagery is detached from its origin and reattached to a current event. The source might be an older conflict, an unrelated accident, a film set, or military-simulation gameplay. Nothing is fabricated; the deception is entirely in the attribution.',
      'It is the cheapest technique available, and the most common in the first hours of a crisis, when demand for dramatic footage far exceeds the supply of genuine footage.',
    ],
    psychology: [
      'Source amnesia does most of the work: people retain images far longer than they retain where the images came from. A correction issued days later reaches a fraction of the audience and cannot un-see the picture.',
      'Novelty and drama also outrun provenance. In a fast-moving story, the most striking footage circulates furthest precisely while it is least checkable.',
    ],
    documented: [
      {
        label: 'Video-game footage passed off as combat video',
        href: '/fake-resistance#arma3-footage',
        note: 'Gameplay from a 2013 military simulation, captioned as live combat footage in the days after October 7 — one flagged post alone drew more than three million views.',
      },
      {
        label: 'A 2022 short film mislabeled as staged propaganda',
        href: '/fake-resistance#empty-place-film',
        note: 'Behind-the-scenes footage from a short film released eighteen months before the war, recaptioned as evidence that the war\'s own footage was staged.',
      },
    ],
    cues: [
      'Run a reverse image or video search on a single frame. It takes under a minute and settles most cases outright.',
      'Read the background rather than the subject: signage, licence plates, foliage, weather, and building styles date and place footage more reliably than the action does.',
      'Be most sceptical in the first hours of a story, when recycled material circulates fastest.',
    ],
  },
  {
    id: 'synchronized-amplification',
    title: 'Synchronized amplification',
    summary: 'Coordinated timing that reads to an audience as spontaneous agreement.',
    move: [
      'A claim appears across many accounts inside a narrow window — sometimes minutes, sometimes seconds. The wording varies enough to look independent. Timing patterns, round-second publication, and accounts created in the same batch are what distinguish the pattern from ordinary virality.',
      'None of these signals alone proves coordination; a devoted audience produces some of them naturally. Documented together, and measured, they describe a structure rather than a coincidence.',
    ],
    psychology: [
      'Consensus is a shortcut people use constantly and reasonably: if many independent observers agree, the claim is probably sound. The shortcut fails silently when the observers are not independent.',
      'Volume also reads as legitimacy. A claim carried by fifty accounts feels established even when all fifty are relaying one account, because the reader sees the fifty and not the one.',
    ],
    documented: [],
    cues: [
      'Open the timestamps. Genuine spread has a shape — an origin and a curve; manufactured spread arrives everywhere at once.',
      'Check account ages on the amplifiers. A cluster created in the same few weeks, all posting the same line, is a structure.',
      'Look for the original. If dozens of accounts assert something and none of them is the source, the source may not exist.',
    ],
  },
  {
    id: 'verdict-before-evidence',
    title: 'Verdict before evidence',
    summary: 'The moral conclusion is fixed first, and each new incident is fitted to it.',
    move: [
      'The framing does not follow from the events; the events are selected to illustrate a conclusion already held. A single incident generalises immediately into a categorical statement about a country, a people, or a movement, and the specific facts of the incident stop mattering.',
      'This is the frame the other techniques are usually serving. Recycled footage, clipped experts, and urgency cards are all more useful when the audience has already decided what any given day\'s news must mean.',
    ],
    psychology: [
      'Confirmation bias is the ordinary version of this, and it is not a defect of unusual people. Everyone weighs evidence for a held position more generously than evidence against it.',
      'Categorical framing also relieves the reader of work. A rule that explains every event in advance is far more comfortable than a world in which each event has to be assessed on what is actually known about it.',
    ],
    documented: [],
    cues: [
      'Ask what evidence would change the account\'s mind. If the framing survives every possible fact, it was never resting on facts.',
      'Notice the jump from an incident to a category — from what someone did to what a whole group is.',
      'Look for whether the account has ever reported an inconvenient fact about its own side.',
    ],
  },
  {
    id: 'identity-games',
    title: 'Identity games',
    summary: 'Backup accounts, renamed handles and lookalikes — audience continuity without accountability.',
    move: [
      'An account is suspended, renamed, or quietly retired, and an adjacent one carries the audience forward. Lookalike handles differing by a character sit alongside the original. A history of claims stays attached to a name that no longer exists.',
      'The effect, whether or not it is the intent, is that the record does not follow the reach. Someone can be repeatedly wrong under one handle and start clean under the next while keeping the same followers.',
    ],
    psychology: [
      'People track sources by name and picture, not by identity, so a familiar-looking handle inherits trust that was earned by a different account.',
      'Accountability requires a stable target. When the name changes faster than a correction can circulate, being wrong stops carrying a cost — and a source that cannot be held to its record is not a source.',
    ],
    documented: [],
    cues: [
      'Check the join date against the follower count. A weeks-old account with a large audience acquired it from somewhere.',
      'Read the handle character by character when a post seems out of character for a known name.',
      'Look for what the account has deleted or renamed away from, not only what it currently says.',
    ],
  },
];

/** The controlled vocabulary. A technique chip must name one of these. */
export const TECHNIQUE_IDS = CHAPTERS.map((chapter) => chapter.id);

export type TechniqueId = (typeof TECHNIQUE_IDS)[number];

const BY_ID = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]));

export function getPlaybook(): PlaybookChapter[] {
  return CHAPTERS;
}

export function getTechnique(id: string): PlaybookChapter | undefined {
  return BY_ID.get(id);
}

/** True when `id` is a member of the controlled vocabulary. */
export function isTechniqueId(id: string): boolean {
  return BY_ID.has(id);
}

export const PLAYBOOK_PATH = '/fake-resistance/playbook';

/** The canonical in-site link for a technique. */
export function techniqueHref(id: string): string {
  return `${PLAYBOOK_PATH}#${id}`;
}

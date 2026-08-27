# The psychology of this design

This is not generic UX-psychology trivia. It is the specific psychological
argument this site's design makes, and the principles that keep it honest.
Consult it when a judgment call arises about hierarchy, emphasis, emotional
register, or persuasion — the checklist catches craft defects; this catches
*direction* defects, which are worse.

## 1. Trust is decided pre-consciously, from craft

Readers form a credibility judgment in under a second, before reading a
word, and typography carries most of it (the aesthetic-usability effect and
every "looks like a real newspaper" heuristic). This site's entire claim is
*we verify*. Therefore:

- Alignment, consistent rhythm, and a disciplined type scale are not polish
  — they are the visible half of the verification claim. A drifting margin
  says "nobody checked this" about a page whose content says "we checked
  everything."
- Metadata (dates, reviewer, source counts) is the credibility apparatus.
  It must be *legible* — the old design's 8px mono meta was the least
  readable thing on the page carrying the most trust-critical content.
  Small, yes; strained, never.
- Provenance always renders. Credits and citations are trust signals, not
  clutter; stripping them to "clean up" a layout inverts the site's purpose.

## 2. Restraint is the emotional register

Much of this site is memorial and evidentiary: testimony from October 7,
documentation of real deaths, names of real people. The psychology of
gravity is subtractive — solemnity is produced by what the design refuses
to do:

- **No decoration on testimony.** No ornamental flourishes, no expressive
  animation, no "engaging" treatments on records of atrocity. The black
  ground, the measured serif, the quiet mono data — the restraint *is* the
  respect, and readers feel it as seriousness even if they never name it.
- **The October 7 pages run muted** (`register="muted"`) — the right call
  for memorial content. Do not "liven them up"; if their design needs work,
  the direction is more dignity, not more energy.
- **Emphasis is spent like money.** Gold marks the one thing per viewport
  that deserves it. The Von Restorff effect only works when the isolated
  element is actually isolated; three highlights are zero highlights.
- Emotional pacing on long documents: dense testimony needs breathing room
  — whitespace between records is recovery time, not wasted space.

## 3. The anti-manipulation rule

The site's Fake Resistance section documents manipulation techniques by
name. That makes the design's own persuasion ethics load-bearing: any
technique the playbook would condemn is disqualified here, whatever its
conversion metrics.

Concretely, never ship: artificial urgency or scarcity; guilt-framed CTAs;
confirmshaming; attention-hijacking motion; ambiguous buttons whose action
differs from their label; visual tricks that make one option look like the
only option. The Support Us page may *ask* — plainly, once, with a button
that says what it does. Persuade with clarity and evidence, which is the
site's actual argument, not with pressure, which is its adversary's.

One inherited call worth defending on its merits: research grades render as
plain text labels rather than through `VerificationBadge` — dressing a
"possible" in badge-shaped certainty would be exactly the epistemic
laundering the section documents. Restyle the labels freely; don't upgrade
their claim.

## 4. Hierarchy is the argument

Visual hierarchy is not decoration on the content; it *is* the reader's
model of what matters. The eye's order — first, second, third — should
reproduce the editorial order of importance.

- Squint test: at any viewport, the blurred page should still show one
  dominant element (the headline or the key evidence), a clear second
  level, and a quiet field of body. Two competing dominants means the page
  hasn't decided what it's about.
- Gestalt does the unspoken work: proximity groups a citation with its
  claim (the evidence margin exists for this — the source travels *beside*
  the claim, shortening the trust-verification loop to a glance);
  similarity makes all dates read as one system; continuity carries the
  reading line down one centered measure without lateral jumps.
- Cognitive load: a reader on a 9,000px document is spending effort on the
  content; the interface may not tax them further. Every distinct visual
  voice on screen is a small parallel task — the old design hit ~9 voices
  per screen. The budget is roughly: one display voice, one body voice, one
  data voice, one accent. When adding an element, ask which existing voice
  it speaks in; "a new voice" is almost always the wrong answer.

## 5. The dark ground

The black ground with light ink is an identity choice with psychological
consequences to respect, not fight:

- Dark surfaces read as: archive, operations room, night, vigil. That is
  the register of this site — a desk that works while it's dark. It also
  makes the gold read as illumination rather than decoration.
- Light-on-dark reading fatigues faster at low contrast; that is why
  `--ink` sits high and the floor for `--ink-lo` is enforced. Resist any
  "elegant" lowering of text contrast — elegance that costs legibility is
  self-defeating on a reading site.
- Halation: bright text on black blooms for astigmatic readers (a large
  minority). The ink ramp tops at `#eeeeee`, not `#ffffff`, for this
  reason; pure white body text is a regression.

## 6. Serving two audiences at once

Every page serves a sympathetic reader seeking depth and a skeptical
reader auditing the claims. The design must not choose between them:

- The skeptic's path — metadata, sources, methodology links — must be
  *findable* without dominating; visible apparatus at a glance, detail on
  approach.
- The sympathetic reader's path — the narrative measure — must flow without
  the apparatus interrupting mid-paragraph. Margins and footers exist so
  the apparatus can be adjacent instead of inline.
- Neither reader may ever feel handled. Both must leave feeling the site
  showed its work and let them judge. That feeling is the conversion.

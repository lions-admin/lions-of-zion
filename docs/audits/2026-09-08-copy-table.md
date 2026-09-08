# Copy table — UI/UX upgrade round, 8 September 2026

The decided words for `docs/audits/2026-09-08-ux-upgrade-todos.md` UX-01,
UX-02, UX-04, UX-05. Every workstream applies these verbatim in the files it
owns. Register: second person, one verb the reader performs, one thing they
get. No "the desk" outside the Ask product name and the machine-authorship
disclosure. No "corpus", "record" as a self-description, or "living record".

## UX-01 — identity lines

| Place | Old | New |
| --- | --- | --- |
| Cover standfirst (`app/page.tsx`) | Powered by evidence, not narratives. | **Truth has a signal. Find it, check it, share it.** |
| Brand role under the wordmark (header, footer) | Evidence desk | **Evidence, not narratives** |
| Journey head (`components/home/HomepageJourney.tsx`) | One desk. A wider record. | **What happened. What is being said about it. How to check.** |
| Site description (`lib/site-config.ts`, meta) | An independent evidence network: verified developments, documented sources, and the record behind them. | **Open-source evidence on the information war against Israel — sourced so you can check it, trace it and share it.** |
| Page title suffix / home title | Truth Has a Signal — LIONS OF ZION | unchanged — it now matches the cover |

## UX-02 — hub kickers and ledes

| Route | Kicker | Lede |
| --- | --- | --- |
| `/geopolitical-brief` | What is happening | **What happened today in Israel and the region — every line with its source, so you can check it before you repeat it.** |
| `/fake-resistance` | What is being said about it | **See the claim. See what it was built from. Take the sourced version with you.** |
| `/people-of-israel` | Who Israel is | **The people the narrative leaves out — with the sources, so you can show them.** |
| `/october-7` | The record | **What happened, from the people it happened to. Documented, sourced, and yours to share.** |
| `/information-war` | unchanged | unchanged |
| `/search` | — | **Search everything published here — stories, investigations, claims and the sources behind them.** |
| `/ask` | — | **Ask about a claim, a video, a source. Every answer shows what it was built from — or says it found nothing.** |
| `/support-us` | — | **Three ways to act: report a claim, lend a skill, fund the work.** (four cards stay; "Share what is verified" is the fourth) |

Navigation descriptions (`lib/site-navigation.ts`):

| Section | New description |
| --- | --- |
| News & Analysis | What happened, with the sources behind every line. |
| Fake Resistance | The claims in circulation, what they were built from, and the sourced version to carry back. |
| October 7 | Testimony and documentation, with their original context, ready to share. |
| The People of Israel | Courage, invention and history — the people the narrative leaves out, with sources. |
| We Are | Who checks what, and the rules that bind them. |
| Support Us | Report a claim, lend a skill, or fund the work. |

## UX-04 — system language → reader language

| Where | Old | New |
| --- | --- | --- |
| `components/search/http.ts` generic | The request failed (HTTP {status}). | **Something went wrong on our side. Try again in a moment.** |
| search 429 (`SearchPanel.tsx` `limited`) | title + HTTP line | title **Too many searches, too fast.** body **Wait a few seconds and search again.** — no status code |
| `PublicSessionProvider.tsx` | The session check failed (HTTP …). | **We could not check whether you are signed in. Reload to try again.** |
| `SearchPanel.tsx:215` | Searching the index… | **Searching…** |
| `vocabulary.ts` matching notes | Matching on words and names. / …and meaning. | remove from the pending state; keep only in the empty state as **No matches for "{q}". Try a name, a place or a claim.** |
| Ask composer placeholder | What does the desk hold on… | **Ask about a claim, a video, a source…** (follow-up: **Ask a follow-up…** unchanged) |
| Article dossier labels | Source stack / Primary actor / Arena / Authorship | **Sources / Who / Where / Written by** |
| Article authorship value | Researched, written and published by the Lions of Zion editorial system | unchanged (honest disclosure) |
| Corrections block | operator `note` verbatim, `v4` | see UX-04 in the audit: substantive corrections only; media/metadata versions collapse to one line **Illustration attached · {date}** |
| October 7 share explainer | Where original media is held here, X can prepare… | **Graphic media stays covered in previews. Share the record — the original is one click behind the warning.** |
| October 7 rotation hint | A new selection every 12 seconds… | removed with the rotation; arrows keep **More testimony →** / **More records →** |
| Support prose | Four ways to act, and one of them is enough… | **Pick one. Nothing you type is lost if you change your mind.** |

## UX-05 — verb table (card actions)

| Destination | Verb |
| --- | --- |
| News / Israel-update article | Read the story |
| Narrative-watch / fact-check record | See the evidence |
| Investigation case | Open the investigation |
| Testimony | Read the testimony |
| Documented record behind a warning | Open with a content warning |
| Person profile | Read their story |
| Hub "everything" link | All of *Section* → |
| Daily briefing | Read the briefing |

## UX-06 — activation band (article + hubs)

Heading **Check it yourself.** Three actions, in this order, no more:
**Trace the sources** (anchor to the page's source list) ·
**Share the sourced record** (existing share text/URL helpers) ·
**Report a claim** (`/support-us#report`).
One sentence under the heading: *Everything here is sourced. Take the sources
with you, not just the headline.*

## UX-24 — Ask suggested questions

1. Is this video really from Gaza?
2. Who first posted this claim?
3. What does the record say about the Nova festival?

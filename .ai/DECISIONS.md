# Decisions

Append-only. Newest first. One entry per decision that a later reader would
otherwise re-litigate or accidentally undo.

Record the **why**, not the what — `git log` and `git diff` already hold the
what, and duplicating them here just creates something to fall out of date.
A decision that was reversed keeps its entry, with the reversal appended: the
record of a bad idea is what stops it being had twice.

---

## 2026-08-23 — Backend lives at `server/`, not `src/server/`

The brief specifies `src/app/api/**` and `src/server/**`. Next.js allows `app/`
**or** `src/app/`, never both, and this repo has `app/` at the root. Moving it to
`src/` would touch the frontend the brief forbids touching, so routes go to
`app/api/**` alongside the existing page and domain code to `server/**` at root.

`tsconfig.json` already maps `@/*` → `./*` and includes `**/*.ts`, so this needed
no config change at all.

## 2026-08-23 — PGlite has no pgvector; the test strategy is dual

Confirmed by spike, not assumed. PGlite 0.5.6 bundles `pg_trgm`, `citext`,
`pgcrypto`, `unaccent` and 30 others, but **not** pgvector, and no package
publishes it separately (`@electric-sql/pglite-vector` does not exist).

So: PGlite for Phases 1–4, which need constraints, triggers, roles and lexical
search — all of which it does faithfully, being real Postgres 18 in WASM.
Semantic-search tests from Phase 5 need a real Postgres via `TEST_DATABASE_URL`
and skip when it is absent (`hasVectorDatabase()`).

Finding this in Phase 1 rather than Phase 5 is the entire reason the spike was
scheduled first.

## 2026-08-23 — Generated hashes use md5; sha256 is application-written

The design called for `content_hash` as a generated stored column computed with
`encode(sha256(convert_to(text,'UTF8')),'hex')`. Postgres rejects it:

    ERROR 42P17: generation expression is not immutable

`convert_to(text, name)` is **STABLE**, not IMMUTABLE — encoding conversion
depends on server settings — and a generated column requires immutability.
`sha256(bytea)` itself is fine; there is simply no immutable text→bytea path.

So the split is by purpose:

- **Change detection** (does this text differ from what we indexed?) uses a
  generated `md5()` column. Immutable, free, and collision resistance is not
  what the column is for.
- **Integrity and provenance** (this blob is the bytes we fetched) stays sha256,
  written by the application, with a CHECK on the hex format.

Verified in the same spike: `to_tsvector('simple'|'english', col)` **is**
immutable and works in a generated column, and Hebrew tokenises and matches
under the `simple` configuration.

## 2026-08-23 — Constraint tests assert the constraint name, not the message

Drizzle wraps driver errors as `Failed query: …` and hangs the real Postgres
error off `cause`. The first version of the suite asserted on error text and
nine tests failed while the schema was entirely correct.

The tempting fix — a bare `.rejects.toThrow()` — is the trap: it passes when the
*wrong* constraint fires. That is the same class of false green as an
authorization suite that silently runs as the table owner.

So `violation()` in `server/db/testing.ts` walks to the deepest `cause` and
returns `{code, constraint, message}`. CHECK violations are asserted by
`constraint` name; trigger `RAISE EXCEPTION`s, which carry no constraint, by
SQLSTATE plus message. The suite was mutation-tested: removing the `audit_log`
append-only trigger turns exactly two tests red, and restoring it turns them
green.

## 2026-08-23 — Deviations from the backend brief, and why

Recorded so they are not re-litigated. Full reasoning in the plan file.

- **Added `source_family`.** The brief has no way to tell five outlets
  republishing one wire report from five independent corroborations. That is the
  most common way a verification process fools itself.
- **Added a transactional `outbox`.** Enqueueing to a Vercel Queue after commit
  is not atomic; the gap loses reindex and AI jobs silently.
- **Ten confidence dimensions, no single number**; the item carries a derived
  `high|medium|limited` summary so `0.94` cannot be stored.
- **No numeric probability on scenarios** — bands only. A fabricated `0.62` gets
  screenshotted, and the caveats do not travel with the screenshot.
- **Collapsed `undetermined` into `unverified`**; **added `unsupported` and
  `satire`**; **dropped `inconclusive`** from evidence relations.
- **`reports` means user-submitted reports** (§44), not generated deliverables.
  The design agent read it the other way; the brief is unambiguous.

## 2026-08-23 — The photographic lion will be replaced by the Signal Field

The `/design` brief's §19 end state is a Live Signal Field behind a header. The
photographic blue lion (`components/LionExperience.tsx`) does not appear in it,
and §8 says the *particle* lion becomes the field.

Confirmed with the user rather than assumed, because it discards a component
merged and deployed the same day. **Not yet acted on** — `LionExperience` is
still the homepage. When it goes, the code stays in git history.

## 2026-08-23 — Intro shortened by cutting words only, not timing

Reverted first attempt, then redone narrowly.

The first attempt rewrote the sequencer to show one statement at a time and
reduced `lionRelocation` from 1.0 to 0.34, reasoning from brief §1 that the
lion should stay the centrepiece. It typechecked, linted and built clean — and
put "OCTOBER 7, 2023" across the lion's eyes and nose. The lion vacates a lane
precisely so the copy has somewhere to go; shrinking the relocation closed it.

Reverted whole. The redo changed only the words inside the existing 12 beats:
24 desktop lines → 14, ~44.5s → ~39s. The rolling four-line window, the beat
timings and the relocation are all untouched.

Two lessons, both now enforced:
- Composition changes must be screenshotted before moving on. Static gates
  cannot see them. Hence the `verify-intro` skill and `intro-frame-reviewer`.
- The beat **count** is load-bearing (`STORY_PARAGRAPHS` indexes `[0..11]` by
  hand, `STORY_BEAT_STARTS` is a parallel literal). Hence the
  `check-story-timeline` hook.

## 2026-08-23 — Deploys run from the CLI, not from git

`vercel git connect` fails because the Vercel account cannot see private repos
under `lions-admin`. Rather than make the repo public to unblock it, deploys
stay manual (`vercel --prod`) until the Vercel GitHub App is authorised for
that account. The repo being private was a deliberate choice; convenience does
not override it.

Consequence worth remembering: **pushing to GitHub deploys nothing.**

## 2026-08-23 — `reactStrictMode` stays off

`lions3d`, where the intro came from, had it on and `lion-scene.tsx` was
written to survive the double mount. `LionExperience.tsx` was not — it still
carries a debug harness whose cleanup does not remove its window listeners.
Turning strict mode on would double-register them in dev.

`devIndicators: false` was kept from lions3d: the badge sits in the corner the
intro plays in.

## 2026-08-23 — The intro plays over the homepage, not before it

The obvious merge is two screens that swap. This is not that.

The homepage renders from the first frame and the intro plays on top of it: the
intro's renderer is `alpha: true` with a zero clear colour, so the black is its
own veil, which fades over 2.8s at the outro. By the time it lifts, the
homepage lion has been waking underneath for the whole intro.

`LionScene` was already built for this — `mode="handoff"`, `onComplete`,
`onFailure` and the transparent clear colour all pre-existed.

The payoff is that every escape is free: Skip, a WebGL failure, or
`prefers-reduced-motion` just unmounts the intro onto a page that is already
finished. That is why `Experience.tsx` reads reduced-motion during render via
`useSyncExternalStore` and not in an effect — an effect would show such a
reader one frame of the thing they asked not to see.

Cost: `LionExperience`'s wrapper needed `isolation: isolate`. It is `fixed`
with `z-index: auto`, so its own z-indexed typography was escaping into the
root stacking context and painting through the intro.

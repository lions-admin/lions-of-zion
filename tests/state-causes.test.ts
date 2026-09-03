/**
 * STATE-003, STATE-005 and A11Y-007 — the three properties that fail silently.
 *
 * All three break without an exception, without a red build, and without
 * anything a screenshot would show:
 *
 *  - **STATE-005.** An outage rendered as an empty record is a working page
 *    that tells a lie. `/corrections` says "no corrections recorded" when the
 *    ledger fetch failed; `/geopolitical-brief` says "no brief was published"
 *    when the projection is down. Both are claims about this desk's published
 *    body of work, made by a broken read, and the visual difference between
 *    the two states is a border colour.
 *  - **STATE-003.** A retry that clears what was typed is indistinguishable
 *    from one that does not until a real person loses a real paragraph.
 *  - **A11Y-007.** An `aria-describedby` pointing at an id that is not in the
 *    document announces nothing at all. There is no error, no warning, and no
 *    visible difference.
 *
 * The renders here go through `renderToReadableStream` in a node environment,
 * the same way `tests/live-surfaces.test.ts` does. Client components are
 * ordinary functions on the server, so their first paint — labels, ids, ARIA
 * wiring, and the state a component is in before any effect runs — is exactly
 * what this can assert. What it cannot assert is anything that needs a DOM or
 * a user event; those are pinned as source assertions and are named as such.
 */
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ABSENCE_STATUS,
  StatusState,
  absenceStatus,
  type AbsenceCause,
} from "@/components/ui/StatusState";
import { AskComposer } from "@/components/ask/AskComposer";
import { ReportClaimForm } from "@/components/support/ReportClaimForm";
import { VolunteerInterestForm } from "@/components/support/VolunteerInterestForm";
import { UpdateFeed } from "@/components/live";
import type { PublicPublication } from "@/server/contracts/publication";

const listBriefingPublications = vi.fn();

vi.mock("@/lib/publications", () => ({
  listBriefingPublications: (...args: unknown[]) => listBriefingPublications(...args),
  getPublicPublication: vi.fn(),
  isMissingPublication: () => false,
}));

const { LiveBriefHub } = await import("@/components/briefs/LiveBriefHub");

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

async function render(node: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

/** React splits interpolated text with an empty comment; sentences are read
 *  as a person sees them, not as the stream writes them. */
const prose = (markup: string) => markup.replaceAll("<!-- -->", "");

/* ── STATE-005: the cause is named, and the kind follows from it ─────────── */

describe("the absence taxonomy (STATE-005)", () => {
  it("never lets an unavailable service render as an empty record", () => {
    /* The load-bearing row. `empty` puts the panel on `role="status"` and the
       neutral ramp — the voice of "we published nothing" — and a failed read
       must never borrow it. */
    expect(ABSENCE_STATUS.unavailable).toBe("error");
    expect(ABSENCE_STATUS.unavailable).not.toBe("empty");
    expect(ABSENCE_STATUS["auth-required"]).not.toBe("empty");
  });

  it("keeps the three real absences in the empty voice", () => {
    for (const cause of ["empty-record", "no-matches", "nothing-published"] as const) {
      expect(ABSENCE_STATUS[cause], cause).toBe("empty");
    }
  });

  it("covers every cause with a kind", () => {
    const causes: AbsenceCause[] = [
      "empty-record",
      "no-matches",
      "nothing-published",
      "unavailable",
      "auth-required",
    ];
    for (const cause of causes) expect(absenceStatus(cause), cause).toBeTruthy();
    expect(Object.keys(ABSENCE_STATUS).sort()).toEqual([...causes].sort());
  });

  it("carries the cause into the rendered role, not just the colour", async () => {
    const outage = await render(
      createElement(StatusState, {
        status: absenceStatus("unavailable"),
        title: "The read failed",
      }),
    );
    expect(outage).toContain('role="alert"');
    expect(outage).toContain('data-status="error"');

    const absence = await render(
      createElement(StatusState, {
        status: absenceStatus("no-matches"),
        title: "Nothing matches",
      }),
    );
    expect(absence).toContain('role="status"');
    expect(absence).toContain('data-status="empty"');
    expect(absence).not.toContain('role="alert"');
  });
});

/* ── STATE-005 on the feed: three absences, three recoveries ─────────────── */

const entry = {
  publicId: "entry-1",
  kind: "brief",
  section: "daily_brief",
  title: "Daily Brief",
  summary: "The regional picture.",
  body: "Body.",
  language: "en",
  publishedAt: "2026-09-02T05:00:00.000Z",
  updatedAt: "2026-09-02T05:00:00.000Z",
  autoPublishedAt: null,
  editorialTopic: null,
  primaryActor: null,
  arena: null,
  featuredIsraelStory: false,
  narrativeWatchDetails: null,
} as unknown as PublicPublication;

const feed = (props: Partial<Parameters<typeof UpdateFeed>[0]> = {}) =>
  render(
    UpdateFeed({
      entries: [entry],
      paged: false,
      unavailable: false,
      ...props,
    }) as React.ReactElement,
  );

describe("/updates absences (STATE-005)", () => {
  it("says the read failed, and does not say the archive is empty", async () => {
    const markup = prose(await feed({ entries: [], unavailable: true }));
    expect(markup).toContain("could not be read");
    expect(markup).toContain('role="alert"');
    expect(markup).not.toMatch(/Nothing has been published/);
  });

  it("does not tell a reader past the last page that nothing was published", async () => {
    /* The old copy made a false claim about the archive the reader had just
       walked through, on the one screen where they could see it was false. */
    const markup = prose(await feed({ entries: [], paged: true }));
    expect(markup).toContain("end of the record");
    expect(markup).not.toMatch(/Nothing has been published/);
    expect(markup).not.toContain('role="alert"');
  });

  it("offers the way back out of a filter that matched nothing", async () => {
    const markup = prose(await feed({ entries: [], section: "narrative_watch" }));
    expect(markup).toContain("Show every section");
    expect(markup).not.toContain('role="alert"');
  });

  it("only says nothing has been published when that is the actual fact", async () => {
    const markup = prose(await feed({ entries: [] }));
    expect(markup).toContain("Nothing has been published yet");
  });
});

/* ── STATE-003: a recoverable error never costs what was typed ───────────── */

describe("retry preserves what was typed (STATE-003)", () => {
  it("refills the Ask composer from a seed, without a paint of empty box", async () => {
    const markup = await render(
      createElement(AskComposer, {
        onAsk: () => {},
        disabled: false,
        seed: { text: "What does the desk hold on the northern border?", nonce: 1 },
      }),
    );
    /* Applied during render rather than in an effect, so it is present in the
       very first paint — which is what this SSR assertion proves. */
    expect(markup).toContain("What does the desk hold on the northern border?");
  });

  it("hands a failed Ask turn back rather than asking for it again", () => {
    const hook = read("components/ask/useAskThread.ts");
    /* `retry` re-sends `pending` — the only surviving copy of the question,
       because the composer clears on submit. */
    expect(hook).toMatch(/const retry = useCallback\(\(\) => \{[\s\S]*?void ask\(pending\)/);
    /* `recall` clears the error and returns the text, for the edit path. */
    expect(hook).toMatch(/const recall = useCallback\(\(\) => \{[\s\S]*?return question;/);

    const desk = read("components/ask/AskDesk.tsx");
    expect(desk).toContain("onRetry={retry}");
    expect(desk).toContain("onEdit={recallIntoComposer}");
    expect(desk).toContain("seed={seed}");
  });

  it("keeps every field of a failed report submission on screen", async () => {
    /* The report form is controlled state that the failure path does not
       touch: `setState({ status: 'error' })` writes nothing else, so a retry
       is the same button over the same values. Pinned as a source assertion
       because proving it by rendering would need a DOM and a fetch. */
    const form = read("components/support/ReportClaimForm.tsx");
    const failure = form.slice(form.indexOf("catch (cause)"), form.indexOf("if (state.status === 'sent')"));
    for (const setter of ["setUrl(", "setBody(", "setReporterEmail(", "setReporterNote("]) {
      expect(failure, `the failure path must not call ${setter}`).not.toContain(setter);
    }
    const markup = prose(await render(createElement(ReportClaimForm)));
    expect(markup).toContain("Send report");
  });

  it("prefers the re-fetching recovery at both error boundaries", () => {
    /* `reset` only re-renders the tree that already failed. For a read that
       did not come back, that is a button which visibly does nothing. */
    for (const boundary of ["app/error.tsx", "app/articles/[publicId]/error.tsx"]) {
      const source = read(boundary);
      expect(source, boundary).toContain("retry ?? reset");
      expect(source, boundary).toContain("recover()");
    }
  });
});

/* ── A11Y-007: names, groups, and references that resolve ────────────────── */

/** Every id an `aria-describedby` / `aria-labelledby` names, in order. */
function referencedIds(markup: string): string[] {
  return [...markup.matchAll(/aria-(?:describedby|labelledby|errormessage)="([^"]+)"/g)]
    .flatMap((match) => match[1]!.split(/\s+/))
    .filter(Boolean);
}

function presentIds(markup: string): Set<string> {
  return new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!));
}

/** Controls that must carry a programmatic name, with the name they resolve. */
function controls(markup: string): Array<{ tag: string; attrs: string }> {
  return [...markup.matchAll(/<(input|textarea|select)\b([^>]*)>/g)].map((match) => ({
    tag: match[1]!,
    attrs: match[2]!,
  }));
}

const namedForms: Array<[string, () => Promise<string>]> = [
  ["report a claim", () => render(createElement(ReportClaimForm))],
  ["volunteer interest", () => render(createElement(VolunteerInterestForm))],
  [
    "Ask composer",
    () => render(createElement(AskComposer, { onAsk: () => {}, disabled: false })),
  ],
];

describe("form semantics (A11Y-007)", () => {
  it.each(namedForms)("every reference in %s resolves to an element", async (_name, build) => {
    /* An `aria-describedby` naming an id that is not in the document is worse
       than no description: it announces nothing and looks correct in review.
       The one legitimate exception is a `<noscript>` id, which is genuinely in
       this markup — SSR emits the element — and genuinely absent once
       scripting parses it away. */
    const markup = await build();
    const present = presentIds(markup);
    for (const id of referencedIds(markup)) {
      expect(present.has(id), `aria reference "${id}" resolves to nothing`).toBe(true);
    }
  });

  it.each(namedForms)("every control in %s has a programmatic name", async (_name, build) => {
    const markup = await build();
    const labelled = new Set(
      [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((match) => match[1]!),
    );
    for (const control of controls(markup)) {
      if (/type="(hidden|submit|button)"/.test(control.attrs)) continue;
      const id = /\bid="([^"]+)"/.exec(control.attrs)?.[1];
      const named =
        (id !== undefined && labelled.has(id)) ||
        /aria-label(?:ledby)?="/.test(control.attrs);
      expect(named, `<${control.tag}${control.attrs}> has no accessible name`).toBe(true);
    }
  });

  it("marks a required field required for the API as well as the browser", async () => {
    const markup = await render(createElement(VolunteerInterestForm));
    const email = controls(markup).find((control) => /id="volunteer-email"/.test(control.attrs));
    expect(email, "the volunteer email field must render").toBeDefined();
    expect(email!.attrs).toContain('aria-required="true"');
    expect(email!.attrs).toContain("required");
  });

  it("announces the three skill checkboxes as one named group", async () => {
    /* Loose checkboxes are read as three unrelated booleans; a fieldset with a
       legend is read as one question with three answers. */
    const markup = await render(createElement(VolunteerInterestForm));
    expect(markup).toMatch(/<fieldset[^>]*>\s*<legend/);
    expect(prose(markup)).toContain("Skill areas");
    expect((markup.match(/type="checkbox"/g) ?? []).length).toBe(3);
  });

  it("keeps the composer hint inside the field's description", async () => {
    /* The hint carries the Enter / Shift+Enter contract when idle and the
       reason the box is disabled when it is not. Neither reaches a
       screen-reader user unless it is referenced. */
    const markup = await render(
      createElement(AskComposer, { onAsk: () => {}, disabled: true, hint: "Waiting for the current answer." }),
    );
    const described = /<textarea\b[^>]*aria-describedby="([^"]+)"/.exec(markup)?.[1];
    expect(described, "the composer textarea must be described").toBeTruthy();
    const hintId = described!.split(/\s+/)[0]!;
    expect(markup).toContain(`id="${hintId}"`);
    expect(prose(markup)).toContain("Waiting for the current answer.");
  });

  it("wires each field's error to the control that owns it", async () => {
    /* The shared primitives are where this is enforced for every consumer:
       `describedBy()` builds the reference and `aria-invalid` marks the
       control, so a form that uses `Field` cannot forget either. */
    const field = read("components/ui/Field.tsx");
    expect(field).toContain('"aria-invalid": error ? true : undefined');
    expect(field).toContain('"aria-describedby": describedBy(fieldId, description, error)');
    expect(field).toMatch(/id=\{`\$\{fieldId\}-err`\}/);
    for (const primitive of ["CheckboxField.tsx", "SelectField.tsx", "FieldGroup.tsx"]) {
      const source = read(`components/ui/${primitive}`);
      expect(source, primitive).toContain("describedBy(");
      expect(source, primitive).toMatch(/aria-invalid=\{error \? true : undefined\}/);
    }
  });

  it("points the admin editor and both sign-in surfaces at their summary", () => {
    /* A save the API refuses is reported in one console notice, not on a
       field — so the form has to name it, or an operator inside the form is
       told nothing. */
    const manager = read("app/admin/PublicationManager.tsx");
    expect(manager).toContain("aria-describedby={noticeId}");
    expect(manager).toContain('id="console-error"');

    const login = read("app/admin/login/AdminLogin.tsx");
    expect(login).toContain("aria-describedby={[message ? errorId : null");
    expect(login).toContain("id={errorId}");
  });
});

/* ── STATE-005 on the Daily Brief: the three absences that were one ──────── */

describe("/geopolitical-brief absences (STATE-005)", () => {
  const hub = async (filters: Record<string, string> = {}) => {
    const element = await LiveBriefHub({ filters });
    return prose(await render(element as React.ReactElement));
  };

  it("renders a failed projection read as a failure, not as an empty desk", async () => {
    listBriefingPublications.mockRejectedValue(new Error("projection unavailable"));
    const markup = await hub();

    /* The whole point of the fix. Before it, this panel carried no `status` at
       all and defaulted to `empty` — an outage in the voice of "no brief was
       published today". */
    expect(markup).toContain('data-status="error"');
    expect(markup).not.toContain('data-status="empty"');
    expect(markup).toContain("could not be read");

    /* And the section-level empties are silent during an outage: `narratives`
       is empty because the read failed, so "no narrative record was published"
       would be a statement about the desk made by a broken fetch. */
    expect(markup).not.toContain("No narrative record was published in this edition");
  });

  it("tells a filter that matched nothing from a desk that has published nothing", async () => {
    listBriefingPublications.mockResolvedValue([]);

    const filtered = await hub({ actor: "Someone" });
    expect(filtered).toContain("No Daily Brief matches this selection");
    expect(filtered).toContain("Clear all filters");
    expect(filtered).toContain("No narrative record matches this selection");

    const unfiltered = await hub();
    expect(unfiltered).toContain("No Daily Brief has been published yet");
    /* Clearing filters that were never set is a control that changes nothing. */
    expect(unfiltered).not.toContain("Clear all filters");
    expect(unfiltered).toContain("No narrative record was published in this edition");
  });
});

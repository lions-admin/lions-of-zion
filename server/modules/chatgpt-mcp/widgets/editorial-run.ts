import "server-only";

/**
 * One run, with the distinction the v2 contract exists to make.
 *
 * Three things a run produces, and they are three different kinds of fact:
 *
 *   **Published** — what is now live.
 *   **Vetoed** — what the editor decided not to publish, and why.
 *   **Failed** — what broke.
 *
 * Until `whole-site-update-v2` the second and third were the same silence: a
 * run that declined three stories on judgement and a run whose image fetch
 * 404'd both arrived as "nothing published". This view is where that
 * distinction becomes visible, so the styling carries it — a veto is never
 * given the alert tone, and its heading says "editorial decision" in words,
 * because colour alone is not a signal.
 *
 * A v1 run reports `research` and `vetoes` as null rather than empty, and the
 * view says "this contract could not represent them" instead of showing an
 * empty list that would read as "the editor refused nothing".
 */

export const EDITORIAL_RUN_BODY = `
const OUTCOME_TONE = { published: "ok", updated: "ok", vetoed: "warn", no_action: "" };

const publishedBlock = data => {
  const results = (data.operations || []).filter(op => op.status === "completed" && op.result);
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: "Published (" + results.length + ")" }),
  ]);
  if (!results.length) {
    section.appendChild(el("p", { class: "loz-state", text: "This run published nothing." }));
    return section;
  }
  const list = el("ul", { class: "loz-list" });
  for (const op of results) {
    const result = op.result || {};
    const item = el("li", { class: "loz-item" });
    const title = el("h3", { style: "font-size:15px" });
    if (result.url) {
      title.appendChild(el("a", { href: "https://lionsofzion.io" + esc(result.url), target: "_blank", rel: "noreferrer", text: result.title || result.publicId }));
    } else {
      title.appendChild(el("span", { text: result.title || op.key }));
    }
    item.appendChild(title);
    const meta = el("p", { class: "loz-meta" });
    meta.append(el("span", { text: result.action === "update" ? "updated" : "new" }));
    if (result.section) meta.append(el("span", { text: " · " + result.section }));
    if (result.sources) meta.append(el("span", { text: " · " + result.sources + " sources" }));
    if (result.hasMedia === false) meta.append(el("span", { text: " · " }), pill("no hero image", "warn"));
    item.appendChild(meta);
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
};

const researchBlock = research => {
  const section = el("section", { class: "loz-section" }, [el("h2", { text: "Researched" })]);
  if (research === null) {
    section.appendChild(el("p", { class: "loz-state", text: "Not represented: this run was delivered on whole-site-update-v1, which had no research ledger." }));
    return section;
  }
  if (!research.length) {
    section.appendChild(el("p", { class: "loz-state", text: "The package recorded no research entries." }));
    return section;
  }
  const list = el("ul", { class: "loz-list" });
  for (const entry of research) {
    const item = el("li", { class: "loz-item" });
    const head = el("p", { class: "loz-meta" });
    head.append(
      el("span", { style: "font-weight:500; color:var(--loz-ink-hi)", text: entry.topic }),
      el("span", { text: " · " }), pill(String(entry.outcome || "").replace("_", " "), OUTCOME_TONE[entry.outcome] || ""),
    );
    item.appendChild(head);
    if (entry.focus) item.appendChild(el("p", { class: "loz-meta", style: "margin-top:2px", text: entry.focus }));
    if (entry.conclusion) item.appendChild(el("p", { class: "loz-body", style: "margin-top:6px", text: entry.conclusion }));
    for (const url of entry.sourcesReviewed || []) {
      item.appendChild(el("p", { class: "loz-meta", style: "margin-top:2px" }, [
        el("a", { href: esc(url), target: "_blank", rel: "noreferrer", text: url }),
      ]));
    }
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
};

const vetoBlock = vetoes => {
  /* The heading says what kind of thing this is, in words. A reader who cannot
     see the difference between the tones must still get the difference. */
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: "Vetoed — editorial decisions, not faults" }),
  ]);
  if (vetoes === null) {
    section.appendChild(el("p", { class: "loz-state", text: "Not represented: this run was delivered on whole-site-update-v1, which could not distinguish an editorial refusal from a technical failure." }));
    return section;
  }
  if (!vetoes.length) {
    section.appendChild(el("p", { class: "loz-state", text: "The editor vetoed nothing in this run." }));
    return section;
  }
  const list = el("ul", { class: "loz-list" });
  for (const veto of vetoes) {
    const item = el("li", { class: "loz-item" });
    item.appendChild(el("h3", { style: "font-size:15px", text: veto.candidate || veto.key }));
    const meta = el("p", { class: "loz-meta" });
    if (veto.section) meta.append(el("span", { text: veto.section }), el("span", { text: " · " }));
    meta.append(pill("editorial veto"));
    if (veto.ownerDecisionRequested) meta.append(el("span", { text: " · " }), pill("your decision requested", "warn"));
    item.appendChild(meta);
    item.appendChild(el("p", { class: "loz-body", style: "margin-top:6px", text: veto.reason }));
    if (veto.replacement) item.appendChild(el("p", { class: "loz-meta", style: "margin-top:4px", text: "Instead: " + veto.replacement }));
    for (const url of veto.sources || []) {
      item.appendChild(el("p", { class: "loz-meta", style: "margin-top:2px" }, [
        el("a", { href: esc(url), target: "_blank", rel: "noreferrer", text: url }),
      ]));
    }
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
};

const mediaWarningBlock = warnings => {
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: "Media warnings — publication continued" }),
  ]);
  if (!warnings.length) {
    section.appendChild(el("p", { class: "loz-state", text: "No media enrichment failed." }));
    return section;
  }
  const list = el("ul", { class: "loz-list" });
  for (const warning of warnings) {
    list.appendChild(el("li", { class: "loz-item" }, [
      el("p", { class: "loz-meta" }, [pill(warning.operationKey || "media", "warn")]),
      el("p", { class: "loz-body", style: "margin-top:6px", text: warning.message }),
      el("p", { class: "loz-meta", style: "margin-top:4px", text: warning.publicationProceededWithoutNewMedia
        ? "Publication proceeded without new media."
        : "The publication did not complete for another reason." }),
    ]));
  }
  section.appendChild(list);
  return section;
};

const failureBlock = data => {
  const errors = Array.isArray(data.errors) ? data.errors : [];
  const failed = (data.operations || []).filter(op => op.status === "failed");
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: "Failed — technical faults" }),
  ]);
  if (!errors.length && !failed.length && !data.failure) {
    section.appendChild(el("p", { class: "loz-state", text: "Nothing failed." }));
    return section;
  }
  const list = el("ul", { class: "loz-list" });
  if (data.failure) {
    list.appendChild(el("li", { class: "loz-item" }, [
      el("p", { class: "loz-meta" }, [pill("run-level", "alert")]),
      el("p", { class: "loz-body", style: "margin-top:6px", text: data.failure.message || "no message recorded" }),
      data.failure.cause ? el("p", { class: "loz-meta", style: "margin-top:4px", text: data.failure.cause }) : null,
      data.failure.recovery ? el("p", { class: "loz-meta", style: "margin-top:4px", text: data.failure.recovery }) : null,
    ]));
  }
  for (const op of failed) {
    list.appendChild(el("li", { class: "loz-item" }, [
      el("p", { class: "loz-meta" }, [pill(op.key, "alert"), el("span", { text: " · " + (op.stage || "") })]),
      el("p", { class: "loz-body", style: "margin-top:6px", text: (op.failure && op.failure.message) || "no message recorded" }),
    ]));
  }
  for (const error of errors) {
    list.appendChild(el("li", { class: "loz-item" }, [
      el("p", { class: "loz-meta" }, [pill(error.stage || "error", "alert")]),
      el("p", { class: "loz-body", style: "margin-top:6px", text: error.message }),
    ]));
  }
  section.appendChild(list);
  return section;
};

mount((root, data) => {
  root.replaceChildren();
  if (!data) {
    root.appendChild(el("div", { class: "loz-head" }, [el("h1", { text: "No such run" })]));
    return;
  }

  const tone = data.status === "completed" ? "ok" : data.status === "failed" ? "alert" : "warn";
  const head = el("div", { class: "loz-head" }, [el("h1", { text: data.runKey })]);
  const meta = el("p", { class: "loz-meta" });
  meta.append(
    pill(data.status, tone), el("span", { text: " · at " + (data.stage || "?") }),
    el("span", { text: " · " + (data.contractVersion || "contract not recorded") }),
    el("span", { text: " · " }), el("span", { title: esc(data.finishedAt || data.createdAt || ""), text: when(data.finishedAt || data.createdAt) }),
  );
  head.appendChild(meta);
  root.appendChild(head);

  const counts = data.publications || {};
  const stats = el("dl", { class: "loz-grid" });
  const stat = (label, value) => stats.appendChild(
    el("div", { class: "loz-stat" }, [el("dt", { text: label }), el("dd", { text: String(value ?? 0) })]),
  );
  stat("Requested", counts.requested);
  stat("Created", counts.created);
  stat("Updated", counts.updated);
  stat("Failed", counts.failed);
  root.appendChild(stats);

  root.appendChild(publishedBlock(data));
  root.appendChild(researchBlock(data.research === undefined ? null : data.research));
  root.appendChild(vetoBlock(data.vetoes === undefined ? null : data.vetoes));
  root.appendChild(mediaWarningBlock(Array.isArray(data.mediaWarnings) ? data.mediaWarnings : []));
  root.appendChild(failureBlock(data));

  const recommendations = Array.isArray(data.siteRecommendations) ? data.siteRecommendations : [];
  if (recommendations.length) {
    const section = el("section", { class: "loz-section" }, [el("h2", { text: "Recommendations" })]);
    const list = el("ul", { style: "margin:0; padding-left:18px" });
    for (const entry of recommendations) list.appendChild(el("li", { class: "loz-body", text: entry }));
    section.appendChild(list);
    root.appendChild(section);
  }
});
`;

import "server-only";

/**
 * The editorial overview — what a run looks at before it decides anything.
 *
 * Progressive disclosure: the edition and its counts first, then the warnings
 * (because they are the reason to look), then the records grouped by hub with
 * a bounded list per group. Forty records is the tool's default and this shows
 * eight per hub with the rest behind a disclosure, so the first paint stays
 * fast and nothing is hidden.
 */

export const EDITORIAL_OVERVIEW_BODY = `
const HUBS = ["News & Analysis", "Fake Resistance", "The People of Israel"];

const record = item => {
  const line = el("p", { class: "loz-meta" });
  line.append(
    el("span", { text: item.hub || item.section || "Unrouted" }),
    el("span", { text: " · " }),
    el("span", { title: esc(item.publishedAt || ""), text: when(item.publishedAt) }),
  );
  if (item.homepagePlacement) {
    line.append(el("span", { text: " · " }), pill(item.homepagePlacement.area + " " + item.homepagePlacement.position));
  }
  /* Media and sources are stated, not implied: a record with no hero cannot
     take a homepage slot's image, and a record citing nothing is a different
     editorial object from one citing five. */
  if (!item.hasMedia) line.append(el("span", { text: " · " }), pill("no hero image", "warn"));
  line.append(el("span", { text: " · " }), el("span", { text: (item.sourceCount || 0) + " sources" }));

  const heading = el("h3");
  heading.appendChild(el("a", {
    href: "https://lionsofzion.io" + esc(item.url || ""), target: "_blank", rel: "noreferrer",
    text: item.title || item.publicId,
  }));

  const node = el("li", { class: "loz-item" }, [heading, line]);
  if (item.summary) node.appendChild(el("p", { class: "loz-body", style: "margin-top:6px", text: item.summary }));
  if (item.canonicalStoryId) {
    node.appendChild(el("p", { class: "loz-meta", style: "margin-top:4px", text: "Developing story: " + item.canonicalStoryId }));
  }
  return node;
};

const group = (title, items) => {
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: title + " (" + items.length + ")" }),
  ]);
  const list = el("ul", { class: "loz-list" });
  const shown = items.slice(0, 8);
  for (const item of shown) list.appendChild(record(item));
  section.appendChild(list);
  if (items.length > shown.length) {
    const more = el("details", { style: "margin-top:8px" });
    more.appendChild(el("summary", { class: "loz-meta", text: "Show " + (items.length - shown.length) + " more" }));
    const rest = el("ul", { class: "loz-list" });
    for (const item of items.slice(8)) rest.appendChild(record(item));
    more.appendChild(rest);
    section.appendChild(more);
  }
  return section;
};

mount((root, data) => {
  root.replaceChildren();

  const head = el("div", { class: "loz-head" }, [
    el("h1", { text: "Edition " + esc(data.editionDate) }),
  ]);
  const stamp = el("p", { class: "loz-meta" });
  stamp.append(el("span", { text: "read " + when(data.generatedAt) }));
  if (data.homepage) {
    stamp.append(el("span", { text: " · homepage revision " + data.homepage.revision }));
    /* An edition dated before today is the single most useful thing on this
       screen, so it is said in the header rather than only in the warnings. */
    if (data.homepage.editionDate !== data.editionDate) {
      stamp.append(el("span", { text: " · " }), pill("edition " + data.homepage.editionDate, "warn"));
    }
  } else {
    stamp.append(el("span", { text: " · " }), pill("no homepage edition", "warn"));
  }
  head.appendChild(stamp);
  root.appendChild(head);

  const publications = Array.isArray(data.publications) ? data.publications : [];
  const stats = el("dl", { class: "loz-grid" });
  const stat = (label, value) => stats.appendChild(
    el("div", { class: "loz-stat" }, [el("dt", { text: label }), el("dd", { text: String(value) })]),
  );
  stat("Live records", publications.length);
  stat("Developing", (data.canonicalStories || []).length);
  stat("Placements", data.homepage ? (data.homepage.placements || []).length : 0);
  stat("Without a hero", publications.filter(item => !item.hasMedia).length);
  root.appendChild(stats);

  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  if (warnings.length) {
    const note = el("div", { class: "loz-note", "data-tone": "alert", role: "note" });
    note.appendChild(el("p", { class: "loz-kicker", text: "Needs attention" }));
    const list = el("ul", { style: "margin:6px 0 0; padding-left:18px" });
    for (const warning of warnings) list.appendChild(el("li", { text: warning }));
    note.appendChild(list);
    root.appendChild(note);
  }

  if (!publications.length) {
    root.appendChild(el("p", { class: "loz-state", text: "No live records were returned. The desk reads as empty." }));
  } else {
    for (const hub of HUBS) {
      const items = publications.filter(item => item.hub === hub);
      if (items.length) root.appendChild(group(hub, items));
    }
    const other = publications.filter(item => !HUBS.includes(item.hub));
    if (other.length) root.appendChild(group("Unrouted", other));
  }

  const runs = Array.isArray(data.runs) ? data.runs.slice(0, 5) : [];
  if (runs.length) {
    const section = el("section", { class: "loz-section" }, [el("h2", { text: "Recent runs" })]);
    const list = el("ul", { class: "loz-list" });
    for (const run of runs) {
      const tone = run.status === "completed" ? "ok" : run.status === "failed" ? "alert" : "warn";
      const row = el("li", { class: "loz-item" });
      const line = el("p", { class: "loz-meta" });
      line.append(
        el("span", { style: "font-weight:500", text: run.runKey }), el("span", { text: " · " }),
        pill(run.status, tone), el("span", { text: " · " }),
        el("span", { text: run.created + " new, " + run.updated + " updated, " + run.failed + " failed" }),
        el("span", { text: " · " }), el("span", { text: when(run.finishedAt || run.createdAt) }),
      );
      row.appendChild(line);
      list.appendChild(row);
    }
    section.appendChild(list);
    root.appendChild(section);
  }
});
`;

import "server-only";

/**
 * One operational view, rendered generically.
 *
 * Deliberately not nine bespoke layouts. The console's nine views have nine
 * different shapes, and hand-drawing each would be nine things to keep in step
 * with a schema that changes; this reads the shape it was given — scalars as
 * counts, arrays as rows — and renders that. What it adds over raw JSON is
 * exactly what a person needs: the numbers up front, the rows that carry a
 * failure or an error surfaced first, and never a wall of unlabelled text.
 */

export const OPS_DASHBOARD_BODY = `
const TROUBLE = /error|fail|stuck|quarantin|undelivered|disabled|alert/i;

const scalarRow = (key, value) =>
  el("div", { class: "loz-stat" }, [
    el("dt", { text: key.replace(/([a-z])([A-Z])/g, "$1 $2") }),
    el("dd", { text: typeof value === "boolean" ? (value ? "yes" : "no") : String(value) }),
  ]);

const rowLine = entry => {
  if (entry === null || typeof entry !== "object") return el("li", { class: "loz-item", text: String(entry) });
  const item = el("li", { class: "loz-item" });
  const name = entry.name || entry.title || entry.slug || entry.id || entry.stage || entry.topic || entry.jobKey;
  if (name) item.appendChild(el("h3", { style: "font-size:15px", text: String(name) }));
  const meta = el("p", { class: "loz-meta" });
  let first = true;
  for (const [key, value] of Object.entries(entry)) {
    if (value === null || value === undefined || typeof value === "object") continue;
    if (["name", "title", "slug", "id"].includes(key)) continue;
    if (!first) meta.append(el("span", { text: " · " }));
    first = false;
    const tone = TROUBLE.test(key) && value && value !== 0 ? "alert" : "";
    meta.append(tone ? pill(key + ": " + value, tone) : el("span", { text: key + ": " + value }));
  }
  if (!first) item.appendChild(meta);
  return item;
};

mount((root, data) => {
  root.replaceChildren();
  root.appendChild(el("div", { class: "loz-head" }, [
    el("h1", { text: "Operations" }),
    el("p", { class: "loz-meta", text: data && data.generatedAt ? "read " + when(data.generatedAt) : "" }),
  ]));

  if (!data || typeof data !== "object") {
    root.appendChild(el("p", { class: "loz-state", text: "This view returned nothing to render." }));
    return;
  }

  const scalars = el("dl", { class: "loz-grid" });
  let scalarCount = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key === "generatedAt") continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (innerValue !== null && typeof innerValue !== "object") { scalars.appendChild(scalarRow(inner, innerValue)); scalarCount++; }
      }
      continue;
    }
    if (Array.isArray(value)) { scalars.appendChild(scalarRow(key, value.length)); scalarCount++; continue; }
    scalars.appendChild(scalarRow(key, value)); scalarCount++;
  }
  if (scalarCount) root.appendChild(scalars);

  /* Arrays that mean trouble come first — that is what an operations screen
     is for — and each list is bounded so one bad day cannot produce a
     thousand-row widget. */
  const arrays = Object.entries(data).filter(([, value]) => Array.isArray(value) && value.length);
  arrays.sort((a, b) => Number(TROUBLE.test(b[0])) - Number(TROUBLE.test(a[0])));
  for (const [key, value] of arrays) {
    const section = el("section", { class: "loz-section" }, [
      el("h2", { text: key.replace(/([a-z])([A-Z])/g, "$1 $2") + " (" + value.length + ")" }),
    ]);
    const list = el("ul", { class: "loz-list" });
    for (const entry of value.slice(0, 10)) list.appendChild(rowLine(entry));
    section.appendChild(list);
    if (value.length > 10) section.appendChild(el("p", { class: "loz-meta", style: "margin-top:8px", text: "and " + (value.length - 10) + " more" }));
    root.appendChild(section);
  }

  if (!scalarCount && !arrays.length) {
    root.appendChild(el("p", { class: "loz-state", text: "Nothing to report in this view." }));
  }
});
`;

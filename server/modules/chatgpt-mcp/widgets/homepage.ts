import "server-only";

/**
 * The six homepage slots, and which are on automatic selection.
 *
 * An empty slot is the interesting one: it does not mean "nothing is there",
 * it means the composer chose nothing and `selectHomepage()` is picking. The
 * board therefore renders all six positions always, and names the empty ones,
 * rather than listing only what happens to be pinned.
 */

export const HOMEPAGE_BODY = `
const AREAS = [
  { key: "news", label: "News & Analysis" },
  { key: "fakeResistance", label: "Fake Resistance" },
  { key: "people", label: "The People of Israel" },
];
const POSITIONS = ["lead", "secondary"];

const slot = (area, position, placement) => {
  const cell = el("div", { class: "loz-stat", style: "display:flex; flex-direction:column; gap:6px" });
  cell.appendChild(el("p", { class: "loz-kicker", text: position }));
  if (!placement) {
    cell.appendChild(el("p", { class: "loz-meta", text: "Automatic selection — no explicit placement." }));
    return cell;
  }
  const title = el("h3", { style: "font-size:15px" });
  title.appendChild(el("a", {
    href: "https://lionsofzion.io" + esc(placement.url || ""), target: "_blank", rel: "noreferrer",
    text: placement.title || placement.publicId,
  }));
  cell.appendChild(title);
  const meta = el("p", { class: "loz-meta" });
  meta.append(el("span", { title: esc(placement.publishedAt || ""), text: when(placement.publishedAt) }));
  if (!placement.hasMedia) meta.append(el("span", { text: " · " }), pill("no hero image", "warn"));
  cell.appendChild(meta);
  return cell;
};

mount((root, data) => {
  root.replaceChildren();
  const edition = data.edition;
  const head = el("div", { class: "loz-head" }, [el("h1", { text: "Homepage" })]);
  head.appendChild(el("p", { class: "loz-meta", text: edition
    ? "Edition " + edition.editionDate + " · revision " + edition.revision + " · composed " + when(edition.generatedAt)
    : "No edition has been composed; every band is on automatic selection." }));
  root.appendChild(head);

  const placements = Array.isArray(data.placements) ? data.placements : [];
  const find = (area, position) => placements.find(entry => entry.area === area && entry.position === position);

  for (const area of AREAS) {
    const section = el("section", { class: "loz-section" }, [el("h2", { text: area.label })]);
    const grid = el("div", { class: "loz-grid" });
    for (const position of POSITIONS) grid.appendChild(slot(area.key, position, find(area.key, position)));
    section.appendChild(grid);
    root.appendChild(section);
  }

  root.appendChild(el("p", { class: "loz-meta", style: "margin-top:14px",
    text: "October 7 rotates from the archive on its own and is never placed by a run." }));
});
`;

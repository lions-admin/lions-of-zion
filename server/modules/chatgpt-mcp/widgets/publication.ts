import "server-only";

/**
 * One record: its identity, its sources, its media, and what may be done to it.
 *
 * This covers three of the surfaces the brief lists separately — publication,
 * sources/evidence, media — because they arrive in one projection and
 * splitting them would mean three reads to draw one card.
 *
 * Two honesty rules are enforced in the markup, not left to the copy:
 *
 * **A source is not an interpretation.** The cited pages sit under their own
 * heading with publisher and date, and nothing generated is mixed into that
 * list. What this system does *not* have is per-source independence or an
 * evidence stance — no service exposes either — so the widget shows the count
 * and the origins and stops, rather than inventing a confidence signal.
 *
 * **A generated image is never presented as documentation.** The media block
 * leads with the role and the rights state, and an editorial illustration says
 * so before anything else about it.
 */

export const PUBLICATION_BODY = `
const ROLE_WORDS = {
  "documentation": "Documentary image",
  "portrait": "Portrait",
  "archival-context": "Archival context",
  "editorial-illustration": "Editorial illustration — not evidence",
  "safe-cover": "Safe cover — not the original material",
};

/* Reversible in this system, and the labels say which. Deletion is absent on
   purpose: through this identity it archives, and offering a "Delete" button
   that archives would be the one lie this whole design avoids. */
const ACTIONS = [
  { tool: "archive_publication", label: "Archive", note: "Reversible — the record can be restored to draft." },
  { tool: "unpublish_publication", label: "Take off the site", note: "Reversible — archives the record." },
  { tool: "publish_publication", label: "Publish", note: "Makes the record public immediately." },
];

const mediaBlock = media => {
  const section = el("section", { class: "loz-section" }, [el("h2", { text: "Image" })]);
  if (!media) {
    section.appendChild(el("p", { class: "loz-state", text: "No hero image. The record publishes and routes normally, but cannot carry a homepage slot's picture." }));
    return section;
  }
  const rights = media.rights || {};
  const cleared = rights.status === "cleared";
  const line = el("p", { class: "loz-meta" });
  line.append(
    pill(ROLE_WORDS[media.role] || media.role || "image", media.role === "editorial-illustration" || media.role === "safe-cover" ? "warn" : ""),
    el("span", { text: " · " }),
    pill("rights " + (rights.status || "unknown"), cleared ? "ok" : "alert"),
    el("span", { text: " · " }),
    pill(media.sensitivity === "safe" ? "safe" : "sensitivity " + (media.sensitivity || "unknown"), media.sensitivity === "safe" ? "ok" : "warn"),
  );
  section.appendChild(line);
  if (Array.isArray(rights.surfaces) && rights.surfaces.length) {
    section.appendChild(el("p", { class: "loz-meta", style: "margin-top:4px", text: "Cleared for: " + rights.surfaces.join(", ") }));
  }
  if (media.credit) section.appendChild(el("p", { class: "loz-meta", style: "margin-top:4px", text: "Credit: " + media.credit }));
  if (media.alt) section.appendChild(el("p", { class: "loz-body", style: "margin-top:6px", text: media.alt }));
  return section;
};

const sourcesBlock = sources => {
  const section = el("section", { class: "loz-section" }, [
    el("h2", { text: "Cited sources (" + sources.length + ")" }),
  ]);
  if (!sources.length) {
    section.appendChild(el("p", { class: "loz-state", text: "This record cites nothing. For a Narrative Watch analysis that is deliberate and disclosed; anywhere else it is worth checking." }));
    return section;
  }
  const list = el("ol", { class: "loz-list" });
  for (const source of sources.slice(0, 12)) {
    const item = el("li", { class: "loz-item" });
    const title = el("h3");
    if (source.url) {
      title.appendChild(el("a", { href: esc(source.url), target: "_blank", rel: "noreferrer", text: source.title || source.url }));
    } else {
      title.appendChild(el("span", { text: source.title || "Untitled source" }));
    }
    item.appendChild(title);
    const meta = el("p", { class: "loz-meta" });
    meta.append(el("span", { text: source.publisher || "Unattributed" }));
    if (source.publishedAt) meta.append(el("span", { text: " · " + String(source.publishedAt).slice(0, 10) }));
    item.appendChild(meta);
    list.appendChild(item);
  }
  section.appendChild(list);
  if (sources.length > 12) {
    section.appendChild(el("p", { class: "loz-meta", style: "margin-top:8px", text: "and " + (sources.length - 12) + " more" }));
  }
  return section;
};

mount((root, data) => {
  root.replaceChildren();

  if (!data) {
    /* The miss that matters: this is the duplicate check, and "not found" has
       to read as a fact rather than as an empty screen. */
    root.appendChild(el("div", { class: "loz-head" }, [el("h1", { text: "No such record" })]));
    root.appendChild(el("p", { class: "loz-body", text: "Nothing matches that public id or canonical story id. The story does not exist yet." }));
    return;
  }

  const head = el("div", { class: "loz-head" }, [el("h1", { text: data.title || data.publicId })]);
  const meta = el("p", { class: "loz-meta" });
  meta.append(
    el("span", { text: data.hub || data.section }), el("span", { text: " · " }),
    pill(data.status || "unknown", data.status === "published" || data.status === "updated" ? "ok" : "warn"),
  );
  if (data.publishedAt) meta.append(el("span", { text: " · " }), el("span", { title: esc(data.publishedAt), text: "published " + when(data.publishedAt) }));
  if (data.updatedAt && data.updatedAt !== data.publishedAt) {
    meta.append(el("span", { text: " · " }), el("span", { title: esc(data.updatedAt), text: "updated " + when(data.updatedAt) }));
  }
  head.appendChild(meta);
  root.appendChild(head);

  const ids = el("p", { class: "loz-meta" });
  ids.append(el("span", { text: data.publicId }));
  if (data.canonicalStoryId) ids.append(el("span", { text: " · developing story: " + data.canonicalStoryId }));
  root.appendChild(ids);

  const detail = data.detail || null;
  if (detail && detail.summary) {
    root.appendChild(el("p", { class: "loz-body", style: "margin-top:10px", text: detail.summary }));
  }
  root.appendChild(el("p", { class: "loz-actions" }, [
    el("a", { class: "loz-btn", href: "https://lionsofzion.io" + esc(data.url || ""), target: "_blank", rel: "noreferrer", text: "Open the article" }),
  ]));

  if (!detail) {
    root.appendChild(el("p", { class: "loz-note", text: "This record is not live, so its public detail — sources, image, corrections — is not available." }));
  } else {
    root.appendChild(sourcesBlock(Array.isArray(detail.sources) ? detail.sources : []));
    root.appendChild(mediaBlock(detail.media));
    const corrections = Array.isArray(detail.corrections) ? detail.corrections : [];
    if (corrections.length) {
      const section = el("section", { class: "loz-section" }, [el("h2", { text: "Update log" })]);
      const list = el("ul", { class: "loz-list" });
      for (const entry of corrections) {
        list.appendChild(el("li", { class: "loz-item" }, [
          el("p", { class: "loz-meta", text: "v" + entry.version + " · " + String(entry.changedAt).slice(0, 10) }),
          el("p", { class: "loz-body", text: entry.summary }),
        ]));
      }
      section.appendChild(list);
      root.appendChild(section);
    }
  }

  /* Actions last, each stating its consequence before it is pressed, and the
     result read back from the server rather than assumed. */
  const actions = el("section", { class: "loz-section" }, [el("h2", { text: "Actions" })]);
  const row = el("div", { class: "loz-actions" });
  for (const action of ACTIONS) {
    const button = el("button", { class: "loz-btn", type: "button", text: action.label, title: action.note });
    button.addEventListener("click", async () => {
      const confirmed = el("p", { class: "loz-note", role: "status", text: action.note + " Running\\u2026" });
      actions.appendChild(confirmed);
      button.setAttribute("disabled", "true");
      const result = await callTool(action.tool, { id: data.detail && data.detail.id ? data.detail.id : undefined }, root, null);
      button.removeAttribute("disabled");
      confirmed.textContent = result
        ? "Done. Ask for this record again to see the server's own account of its state."
        : "That action did not complete.";
    });
    row.appendChild(button);
  }
  actions.appendChild(row);
  actions.appendChild(el("p", { class: "loz-meta", style: "margin-top:8px", text: "Deletion is not offered: through this connector it performs an archive, which is reversible." }));
  root.appendChild(actions);
});
`;

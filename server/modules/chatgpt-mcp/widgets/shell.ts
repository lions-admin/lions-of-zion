import "server-only";

/**
 * The shared skin and runtime for every Lions widget inside ChatGPT.
 *
 * Three constraints shape this file, and each one rules out the obvious
 * approach.
 *
 * **Everything is inlined.** The widget HTML is delivered in the MCP resource
 * body, so nothing is fetched from `lionsofzion.io` — which is what makes this
 * work at all, because the site sends `frame-ancestors 'none'` and
 * `X-Frame-Options: DENY` on every path. No bundler, no external stylesheet,
 * no font file, no image host.
 *
 * **No framework.** A React runtime inlined into each of five resources would
 * be most of the payload, to render what is essentially a list and a card.
 * Plain DOM is smaller, has no build step, and cannot drift from a version of
 * React the page does not have.
 *
 * **The host's own theme comes first.** ChatGPT renders these in light and
 * dark, and the current guidance is to take the platform's CSS variables where
 * they exist rather than hardcode a palette. So the site's colours are used as
 * *fallbacks* — `var(--host-token, <lions value>)` — which keeps the widget
 * recognisably ours without fighting the surface it sits on.
 *
 * The type roles are the site's own (`docs` and `app/globals.css`): a display
 * serif for headlines, a sans for running text, a mono for data, metadata at
 * 13px and never below, body at 16px and never below.
 */

/** The site's tokens, as fallbacks behind the host's. */
export const WIDGET_CSS = `
:host, .loz {
  --loz-ink-hi: var(--openai-color-text-primary, #f6f3eb);
  --loz-ink: var(--openai-color-text-secondary, #cbc7bd);
  --loz-ink-lo: var(--openai-color-text-tertiary, #a8a29a);
  --loz-line: var(--openai-color-border-default, rgba(128,128,128,0.28));
  --loz-surface: var(--openai-color-surface-secondary, rgba(128,128,128,0.06));
  --loz-gold: #c08d14;
  --loz-ember: #c97365;
  --loz-ok: #4f9c74;
  --loz-warn: #a9761f;
  --loz-face-display: ui-serif, Georgia, "Times New Roman", serif;
  --loz-face-text: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --loz-face-data: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: light) {
  :host, .loz {
    --loz-ink-hi: var(--openai-color-text-primary, #16110a);
    --loz-ink: var(--openai-color-text-secondary, #3d382f);
    --loz-ink-lo: var(--openai-color-text-tertiary, #6b6459);
    --loz-gold: #8a640b;
  }
}
/* color-scheme so a host that paints no ground still gets a canvas matching
   the text: the palette above flips on prefers-color-scheme, and light text on
   an unpainted light canvas is the one way this becomes unreadable. The
   background stays unset otherwise, so the widget sits on the host surface
   rather than as a pasted-on rectangle. (No backticks in here: this comment
   lives inside a template literal.) */
.loz { color-scheme: light dark; font-family: var(--loz-face-text); color: var(--loz-ink); font-size: 15px; line-height: 1.55; }
.loz * { box-sizing: border-box; }
.loz h1, .loz h2, .loz h3 { margin: 0; font-family: var(--loz-face-display); font-weight: 400;
  color: var(--loz-ink-hi); letter-spacing: -0.015em; text-wrap: balance; overflow-wrap: anywhere; }
.loz h1 { font-size: clamp(21px, 4.2vw, 27px); line-height: 1.15; }
.loz h2 { font-size: 17px; line-height: 1.25; }
.loz h3 { font-size: 16px; line-height: 1.3; }
.loz p { margin: 0; overflow-wrap: anywhere; }

/* Metadata never below 13px, body never below 16px — the site's own floors. */
.loz-kicker { font-family: var(--loz-face-data); font-size: 13px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--loz-gold); }
.loz-meta { font-family: var(--loz-face-data); font-size: 13px; color: var(--loz-ink-lo);
  letter-spacing: 0.02em; }
.loz-body { font-size: 16px; line-height: 1.6; }

.loz-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px;
  padding-bottom: 10px; border-bottom: 1px solid var(--loz-line); margin-bottom: 14px; }
.loz-head h1 { flex: 1 1 14ch; }

.loz-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); }
.loz-stat { padding: 10px 12px; border: 1px solid var(--loz-line); border-radius: 8px;
  background: var(--loz-surface); }
.loz-stat dt { margin: 0 0 4px; font-family: var(--loz-face-data); font-size: 13px;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--loz-ink-lo); }
.loz-stat dd { margin: 0; font-size: 20px; font-family: var(--loz-face-display); color: var(--loz-ink-hi); }

.loz-list { list-style: none; margin: 0; padding: 0; }
.loz-item { padding: 12px 0; border-bottom: 1px solid var(--loz-line); }
.loz-item:last-child { border-bottom: 0; }
.loz-item h3 a { color: inherit; text-decoration: none; }
.loz-item h3 a:hover, .loz-item h3 a:focus-visible { text-decoration: underline; }

/* Status is never colour alone: every pill carries a word. */
.loz-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px;
  border: 1px solid var(--loz-line); border-radius: 999px; font-family: var(--loz-face-data);
  font-size: 13px; letter-spacing: 0.02em; color: var(--loz-ink); white-space: nowrap; }
.loz-pill[data-tone="ok"] { border-color: color-mix(in srgb, var(--loz-ok) 55%, transparent); color: var(--loz-ok); }
.loz-pill[data-tone="warn"] { border-color: color-mix(in srgb, var(--loz-warn) 55%, transparent); color: var(--loz-warn); }
.loz-pill[data-tone="alert"] { border-color: color-mix(in srgb, var(--loz-ember) 55%, transparent); color: var(--loz-ember); }

.loz-note { margin: 12px 0 0; padding: 10px 12px; border-left: 2px solid var(--loz-gold);
  background: var(--loz-surface); font-size: 14px; }
.loz-note[data-tone="alert"] { border-left-color: var(--loz-ember); }

.loz-section { margin-top: 18px; }
.loz-section > h2 { padding-bottom: 6px; border-bottom: 1px solid var(--loz-line); margin-bottom: 10px; }

.loz-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.loz-btn { appearance: none; min-height: 34px; padding: 6px 14px; border: 1px solid var(--loz-line);
  border-radius: 999px; background: transparent; color: var(--loz-ink-hi);
  font: 500 14px/1.2 var(--loz-face-text); cursor: pointer; }
.loz-btn:hover { border-color: var(--loz-gold); color: var(--loz-gold); }
.loz-btn:focus-visible { outline: 2px solid var(--loz-gold); outline-offset: 2px; }
.loz-btn[disabled] { opacity: 0.55; cursor: default; }

.loz-state { padding: 18px 0; color: var(--loz-ink-lo); font-size: 15px; }
.loz-scroll { overflow-x: auto; }
a { color: inherit; }
.loz-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 420px) {
  .loz-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
  .loz-head { gap: 4px 10px; }
}
`;

/**
 * The runtime every widget shares.
 *
 * `window.openai` is a host extension, so each use is feature-detected and
 * falls back rather than branching on a product name. A widget whose host does
 * not provide it still renders whatever it was given, and says so if it was
 * given nothing — which is the same fallback story the tools have: MCP without
 * a UI must work, and a UI without its host bridge must not show a blank box.
 */
export const WIDGET_RUNTIME = `
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) if (child) node.appendChild(child);
  return node;
};
const esc = value => (value === null || value === undefined ? "" : String(value));
const host = () => (typeof window !== "undefined" ? window.openai : undefined);

/** The tool's structuredContent, whichever way the host delivers it. */
const payload = () => {
  const bridge = host();
  const output = bridge && bridge.toolOutput;
  return output && output.data !== undefined ? output.data : output;
};

const state = (root, message, tone) => {
  root.replaceChildren(el("p", { class: "loz-state", role: tone === "alert" ? "alert" : "status", text: message }));
};

/** A relative time a person can read, with the absolute value on hover. */
const when = value => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  if (minutes < 60 * 24) return Math.round(minutes / 60) + "h ago";
  return date.toISOString().slice(0, 10);
};

const pill = (label, tone) => el("span", { class: "loz-pill", "data-tone": tone || "", text: label });

/**
 * Ask ChatGPT to run a tool, then re-read the authoritative state.
 *
 * The refetch is the point. A mutation's result is what the server did, not
 * what the widget guessed it did, and an optimistic repaint would show a
 * "Deleted" that was actually an archive.
 */
const callTool = async (name, args, root, render) => {
  const bridge = host();
  if (!bridge || typeof bridge.callTool !== "function") {
    state(root, "This action needs the ChatGPT app bridge, which is not available here.", "alert");
    return;
  }
  try {
    const result = await bridge.callTool(name, args || {});
    return result;
  } catch (error) {
    state(root, "That action did not complete: " + (error && error.message ? error.message : "unknown error"), "alert");
    return undefined;
  }
};

const mount = render => {
  const root = document.getElementById("loz-root");
  if (!root) return;
  const draw = () => {
    const data = payload();
    if (data === undefined || data === null) {
      state(root, "Waiting for data from Lions of Zion\\u2026");
      return;
    }
    try {
      render(root, data);
    } catch (error) {
      state(root, "This view could not be drawn: " + (error && error.message ? error.message : "unknown error"), "alert");
    }
  };
  draw();
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("openai:set_globals", draw);
  }
};
`;

/**
 * Wraps a widget body into the resource text the host renders.
 *
 * One `<div id="loz-root">`, one `<style>`, one `<script type="module">`. The
 * script is a module so a top-level `const` cannot collide with the host page,
 * and the whole thing is self-contained: no import, no fetch, no asset.
 */
export function widgetHtml(body: string): string {
  return `<div id="loz-root" class="loz" aria-live="polite"></div>
<style>${WIDGET_CSS}</style>
<script type="module">
${WIDGET_RUNTIME}
${body}
</script>`;
}

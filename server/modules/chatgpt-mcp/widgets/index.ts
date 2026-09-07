import "server-only";

/**
 * The widget surfaces, and which tool result each one draws.
 *
 * Five resources cover the surfaces the brief names, because several of them
 * are views of one record rather than separate reads: a publication's sources,
 * its evidence and its media all arrive in the same detail projection, so
 * splitting them into three widgets would mean three round trips to render one
 * card. The run inspector likewise carries the research ledger and the vetoes,
 * which is the whole reason those fields exist on a v2 report.
 *
 * A `ui://` URI is a cache key: the host caches the template against it, so a
 * breaking change to a widget's markup bumps the version segment rather than
 * editing in place.
 */

import { widgetHtml } from "./shell";
import { EDITORIAL_OVERVIEW_BODY } from "./editorial-overview";
import { PUBLICATION_BODY } from "./publication";
import { HOMEPAGE_BODY } from "./homepage";
import { EDITORIAL_RUN_BODY } from "./editorial-run";
import { OPS_DASHBOARD_BODY } from "./ops-dashboard";

export type WidgetDefinition = {
  /** Stable id for `registerResource`. */
  name: string;
  /** The cache key. Bump the version on a breaking markup change. */
  uri: string;
  title: string;
  /** Shown to the model when the component loads. */
  description: string;
  html: string;
  /** The tool whose result this draws. */
  tool: string;
};

export const WIDGETS: readonly WidgetDefinition[] = [
  {
    name: "editorial-overview",
    uri: "ui://lions-of-zion/editorial-overview/v1.html",
    title: "Editorial overview",
    description:
      "The current edition: homepage revision and placements, live records by hub, developing" +
      " stories, recent runs, and the warnings the desk should act on.",
    html: widgetHtml(EDITORIAL_OVERVIEW_BODY),
    tool: "get_editorial_context",
  },
  {
    name: "publication",
    uri: "ui://lions-of-zion/publication/v1.html",
    title: "Publication",
    description:
      "One record with its identity, status, homepage placement, cited sources, media state" +
      " and correction history, and the reversible actions available on it.",
    html: widgetHtml(PUBLICATION_BODY),
    tool: "find_publication",
  },
  {
    name: "homepage",
    uri: "ui://lions-of-zion/homepage/v1.html",
    title: "Homepage board",
    description: "The six homepage slots, what occupies each, and which are on automatic selection.",
    html: widgetHtml(HOMEPAGE_BODY),
    tool: "get_homepage",
  },
  {
    name: "editorial-run",
    uri: "ui://lions-of-zion/editorial-run/v1.html",
    title: "Editorial run",
    description:
      "One run: what published, what the research ledger recorded, which candidates were" +
      " vetoed and why, and separately what failed technically.",
    html: widgetHtml(EDITORIAL_RUN_BODY),
    tool: "get_editorial_run",
  },
  {
    name: "ops-dashboard",
    uri: "ui://lions-of-zion/ops-dashboard/v1.html",
    title: "Operations",
    description: "One operational view, rendered as counts and the rows that need a person.",
    html: widgetHtml(OPS_DASHBOARD_BODY),
    tool: "get_ops_view",
  },
];

/** Tool name → widget URI, for `_meta.ui.resourceUri` on the tool definition. */
export const WIDGET_BY_TOOL: ReadonlyMap<string, WidgetDefinition> =
  new Map(WIDGETS.map(widget => [widget.tool, widget]));

/**
 * The resource mimetype for an MCP Apps template.
 *
 * Written out rather than imported from `@modelcontextprotocol/ext-apps`:
 * that package peers on SDK v1 while this server is v2, and the constant is
 * one string from a ratified specification. If the two ever agree on a
 * version, import it instead.
 */
export const APP_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

import * as React from "react";
import { RECORD_TRANSITION_TYPE } from "@/lib/record-view-names";

/**
 * The two wrappers that put React's `<ViewTransition>` around a page's
 * content and around a record's shared elements.
 *
 * **The verified API (2026-09-16, Next 16.3.4 / React canary vendored by
 * Next):** the export is `ViewTransition`, stable, from `"react"` — see
 * `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`
 * ("View transitions work in the App Router with no configuration"; the
 * `experimental.viewTransition` flag of older Next releases is gone). Next
 * bundles that canary at `next/dist/compiled/react`, which is what the app
 * resolves `"react"` to in both the client and the react-server build. The
 * root `react` package in `node_modules` (19.2.8) does not export the name,
 * and that is what vitest resolves when a test renders a route directly —
 * so the property is read defensively and a missing export degrades the
 * wrapper to a pass-through, which is also exactly the behaviour a browser
 * without the View Transitions API gets.
 *
 * `typecheck` sees the type through the `react/canary` reference in
 * `types/react-canary.d.ts`.
 */

type ViewTransitionProps = React.ComponentProps<
  NonNullable<typeof React.ViewTransition>
>;

type TransitionComponent =
  | React.ExoticComponent<ViewTransitionProps>
  | undefined;

const ViewTransition: TransitionComponent = React.ViewTransition;

/**
 * The shared record elements — headline, kicker, plate — on every list
 * surface and on the record page. `default="none"` keeps the pair out of
 * every navigation that is not a list → record one; `share="morph"` names
 * the shared animation so `::view-transition-group(.morph)` in
 * `app/globals.css` can set its duration and curve.
 */
export function RecordShare({
  name,
  children,
}: {
  name: string | null | undefined;
  children: React.ReactNode;
}) {
  if (!ViewTransition || !name) return <>{children}</>;
  return (
    <ViewTransition name={name} default="none" share="morph">
      {children}
    </ViewTransition>
  );
}

/**
 * The page content itself, wrapping `<main>` in `EditorialShell` so the
 * chrome (masthead, footer) is never part of a transition. The name is
 * per-route (`page-<routeId>`) so a list → record navigation forms no pair
 * on the page level: the old page leaves with the `page-exit` class and the
 * new one arrives with `page-enter`, both declared for the `to-record` type
 * that `Link transitionTypes` sets on record links. Every untagged
 * navigation — hub ↔ hub, record → hub, the browser's back button —
 * deactivates the name entirely and the page falls back to the root
 * crossfade.
 */
export function PageTransition({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition
      name={name}
      default="none"
      enter={{ [RECORD_TRANSITION_TYPE]: "page-enter", default: "none" }}
      exit={{ [RECORD_TRANSITION_TYPE]: "page-exit", default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}

import * as React from "react";

/**
 * The page-transition wrapper, and the one place the round resolves React's
 * `<ViewTransition>`.
 *
 * Next's App Router compiles against its own React (a 19.3 canary, which has
 * the component); the `react` this repository installs is 19.2.8 stable,
 * which does not export it. So `import { ViewTransition } from "react"` is
 * correct inside the Next build and `undefined` anywhere else — and "anywhere
 * else" is every Vitest render in `tests/`, where it took out thirteen
 * server-render assertions at once with "Element type is invalid".
 *
 * Resolving it here keeps that difference in one file. Where the component
 * exists, this is exactly it, with exactly its props. Where it does not, the
 * children render unwrapped — which is the same thing the browser does
 * without View Transitions support, so the fallback is the design rather than
 * a stub: the navigation is plain and nothing is missing from the page.
 *
 * Every rule that reads these names lives in `app/globals.css` behind
 * `@supports (view-transition-name: x)`, and both stillness switches there
 * reset `::view-transition-*`, so reduced motion and the reader's own pause
 * navigate plainly too.
 */
type TransitionValue = string | Record<string, string>;

export interface ViewTransitionProps {
  children: React.ReactNode;
  /** The identity a shared element carries on both surfaces. */
  name?: string;
  /** The class React assigns to a matched pair; `"morph"` here. */
  share?: TransitionValue;
  enter?: TransitionValue;
  exit?: TransitionValue;
  update?: TransitionValue;
  /** Keeps a named element out of every unrelated transition on the page. */
  default?: TransitionValue;
}

const Impl = (React as unknown as {
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
}).ViewTransition;

export function ViewTransition({ children, ...props }: ViewTransitionProps) {
  if (!Impl) return <>{children}</>;
  return <Impl {...props}>{children}</Impl>;
}

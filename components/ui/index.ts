/**
 * The chrome primitives.
 *
 * Import from this barrel. `package.json` declares
 * `sideEffects: ["*.css", "**\/*.css"]`, which is what makes that safe: every
 * module here imports a CSS Module, and without that declaration a bundler
 * must assume the barrel needs every stylesheet in the directory.
 *
 * `Dialog` and anything built on it are client components. They carry
 * `"use client"` themselves, so importing the barrel from a server component
 * is fine; *rendering* one is what pulls in a client boundary, and none of
 * them may reach the home route.
 *
 * `Tabs` and `Tooltip` were removed on 2026-09-14: both had zero importers
 * anywhere in the repository, and the tooltip actually in use is the Radix
 * one at `components/shadcn/tooltip.tsx`. Two tooltip implementations, one
 * of them dead, is how a component library stops being believable.
 * (That registry was deleted on 2026-09-16 with the rest of the vendored
 * stack; there is no tooltip on the site now, which is the right number —
 * nothing that carries meaning may live in one.)
 */
/* The editorial primitives (2026-09-16, J8). `Section`, `Prose` and
   `Heading` exist so a route stylesheet stops being the system: a band, a
   passage and a heading step are decisions the library makes once. */
export * from "./Section";
export * from "./Prose";
export * from "./Heading";
export * from "./Button";
export * from "./Card";
export * from "./Badge";
export * from "./StatusState";
export * from "./Icon";
export * from "./Skeleton";
export * from "./Dialog";
export * from "./Pagination";
export * from "./Field";
export * from "./FieldGroup";
export * from "./CheckboxField";
export * from "./SelectField";
export * from "./live-region";
/* The grade/verdict key: the explanations that used to live in `title`
   tooltips, where a touch reader could not reach them at all. */
export * from "./Explainer";

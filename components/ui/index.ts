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
 * anywhere in the repository, and the tooltip actually in use was the Radix
 * one at `components/shadcn/tooltip.tsx`. Two tooltip implementations, one
 * of them dead, is how a component library stops being believable.
 *
 * The vendored registry that made the second tooltip went with it on
 * 2026-09-17 (Midnight Signal, workstream F): `components/shadcn/**` and the
 * Tailwind pipeline are deleted, the ask desk is rebuilt on these primitives,
 * and there is one chrome system again. `Kbd` and `SuggestionChips` join on
 * the same day, extracted from the ask and search trees.
 */
export * from "./Button";
export * from "./Card";
export * from "./Badge";
export * from "./Explainer";
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
export * from "./Kbd";
export * from "./SuggestionChips";

/**
 * The chrome primitives.
 *
 * Import from this barrel. `package.json` declares
 * `sideEffects: ["*.css", "**\/*.css"]`, which is what makes that safe: every
 * module here imports a CSS Module, and without that declaration a bundler
 * must assume the barrel needs every stylesheet in the directory.
 *
 * Four of these are client components — `Dialog`, `Tabs`, `Tooltip` and
 * anything built on them. They carry `"use client"` themselves, so importing
 * the barrel from a server component is fine; *rendering* one of the four is
 * what pulls in a client boundary, and none of them may reach the home route.
 */
export * from "./Button";
export * from "./Card";
export * from "./Badge";
export * from "./StatusState";
export * from "./Skeleton";
export * from "./Dialog";
export * from "./Tabs";
export * from "./Tooltip";
export * from "./Pagination";
export * from "./Field";
export * from "./FieldGroup";
export * from "./CheckboxField";
export * from "./SelectField";
export * from "./live-region";

/**
 * `cn()` — the class merger every shadcn-registry component imports from
 * `@/lib/utils`.
 *
 * Its whole job is conflict resolution *inside one className string*: `twMerge`
 * drops earlier Tailwind classes that later ones would fight, so `px-6` followed
 * by `px-2` yields `px-2` rather than a specificity coin-toss.
 *
 * What it cannot do, and must not be asked to do: reconcile a Tailwind class
 * against a CSS Module class. `twMerge` only parses Tailwind's own grammar, and
 * the two never meet in the cascade anyway — CSS Modules are emitted unlayered
 * and therefore outrank `@layer utilities` unconditionally, at any specificity.
 * The rule that follows from that is in the cascade note at the top of
 * `app/globals.css`: put the module class on a wrapper that owns layout, and let
 * the registry component own its own interior. Never merge the two.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

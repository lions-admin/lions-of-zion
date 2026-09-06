import type { GooglePublicIdentity, XPublicIdentity } from "@/server/contracts/public-session";

/**
 * Derives a human-readable display name for public session identities without
 * importing Zod or runtime contracts into client bundles.
 */
export function publicDisplayName(
  identity: GooglePublicIdentity | XPublicIdentity | null,
): string | null {
  if (!identity) return null;
  if ("username" in identity) return identity.name?.trim() || `@${identity.username}`;
  return identity.name.trim() || identity.email;
}

/**
 * Derives one or two initials for the avatar without runtime contracts.
 */
export function publicInitials(
  identity: GooglePublicIdentity | XPublicIdentity | null,
): string {
  const name = publicDisplayName(identity);
  if (!name) return "";
  const words = name.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? "");
  const initials = letters.join("");
  return (initials || Array.from(name)[0] || "").toUpperCase();
}

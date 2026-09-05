/**
 * The public reader's session — what `/api/public-auth/session` answers.
 *
 * Zod only, so this file loads from a Server Component, from the client
 * bundle, and from a test with no database.
 *
 * Two providers, deliberately kept apart. Google Identity Services and X
 * OAuth are separate sign-ins with separate cookies and separate sign-outs,
 * and this shape does not pretend otherwise: there is no merged "current
 * user". Linking two provider identities into one account is a decision about
 * who someone *is*, and it is not made by noticing that two cookies arrived in
 * the same request.
 *
 * `user` is the Google identity under its original key. The endpoint answered
 * `{ user }` and nothing else before X was wired in, and callers that only
 * ever wanted Google keep working untouched — the X identity arrives beside
 * it rather than inside it.
 */

import { z } from "zod";

/**
 * Whether a provider can actually be used on this deployment.
 *
 * `unconfigured` is not an error. It is a deployment without that provider's
 * credentials, and the honest thing to render for it is a sentence, not a
 * button that leads to a 500.
 *
 * `production-only` is X. Its OAuth callback is registered to
 * `https://lionsofzion.io/auth/x/callback`, and its cookies are `__Host-`
 * prefixed with `secure: true`, which a browser will not write over plain
 * http. A local sign-in would therefore land back on production carrying no
 * state cookie and fail on arrival, so the local surface says where the
 * working one is instead of starting a flow that cannot finish.
 */
export const providerAvailabilitySchema = z.enum(["ready", "unconfigured", "production-only"]);
export type ProviderAvailability = z.infer<typeof providerAvailabilitySchema>;

/** The Google identity, exactly as `readGoogleSession` has always returned it. */
export const googlePublicIdentitySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});
export type GooglePublicIdentity = z.infer<typeof googlePublicIdentitySchema>;

/**
 * The X identity, narrowed on the way out.
 *
 * The server holds `profile_image_url` from `/2/users/me`, and it is dropped
 * here rather than forwarded. Two reasons, both load-bearing: the site's
 * `img-src` does not include `pbs.twimg.com`, so the image would be blocked by
 * the CSP anyway; and allowing it would mean every page with a signed-in
 * header issues a request to X, telling X where this reader is. The avatar is
 * drawn from initials instead. The access token was never persisted and never
 * appears here.
 */
export const xPublicIdentitySchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().optional(),
});
export type XPublicIdentity = z.infer<typeof xPublicIdentitySchema>;

export const publicSessionResponseSchema = z.object({
  /** Google. The original key, unchanged, for the callers that predate X. */
  user: googlePublicIdentitySchema.nullable(),
  /** X. Null when signed out, unconfigured, or outside production. */
  x: xPublicIdentitySchema.nullable(),
  availability: z.object({
    google: providerAvailabilitySchema,
    x: providerAvailabilitySchema,
  }),
});
export type PublicSessionResponse = z.infer<typeof publicSessionResponseSchema>;

/** The name to show, and the initials to draw when there is no picture. */
export function publicDisplayName(
  identity: GooglePublicIdentity | XPublicIdentity | null,
): string | null {
  if (!identity) return null;
  if ("username" in identity) return identity.name?.trim() || `@${identity.username}`;
  return identity.name.trim() || identity.email;
}

/**
 * One or two letters for the avatar.
 *
 * Word-initials where there are words to take them from, otherwise the first
 * character. `Array.from` rather than `charAt`, so a name outside the BMP —
 * or one starting with an emoji, which X permits — does not get cut in half
 * into a replacement glyph.
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

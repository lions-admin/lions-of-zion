import type { NextRequest } from "next/server";
import type { PublicSessionResponse } from "@/server/contracts/public-session";
import {
  googlePublicAuthAvailability,
  readGoogleSession,
} from "@/server/core/auth/google-session";
import {
  X_PUBLIC_SESSION_COOKIE,
  publicXAvailability,
  readPublicSession,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two providers, side by side, plus whether either can be used at all.
 *
 * `user` is Google and keeps the key and the shape it has always had: this
 * endpoint answered `{ user }` before X existed, and the header control still
 * reads exactly that. The X identity arrives beside it, never inside it.
 *
 * The X branch is gated on availability rather than on the cookie. A
 * deployment without X credentials cannot verify a signature — `readPublicSession`
 * would throw reaching for the missing secret — and a local deployment can
 * hold a session cookie copied from production that it has no business
 * honouring. Not `ready` means `null`, whatever arrived in the request.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const availability = {
    google: googlePublicAuthAvailability(),
    x: publicXAvailability(request.headers),
  };

  const user = await readGoogleSession(request);
  // The platform cookie parser, so a signed value survives whatever ordering
  // or spacing the browser chose.
  const profile =
    availability.x === "ready"
      ? readPublicSession(request.cookies.get(X_PUBLIC_SESSION_COOKIE)?.value)
      : null;

  /* `profile_image_url` stops here. The site's `img-src` does not include
     `pbs.twimg.com`, and forwarding the URL would have every signed-in page
     load announce this reader to X. Initials are drawn instead. */
  const body: PublicSessionResponse = {
    user,
    x: profile ? { id: profile.id, username: profile.username, ...(profile.name ? { name: profile.name } : {}) } : null,
    availability,
  };

  return Response.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

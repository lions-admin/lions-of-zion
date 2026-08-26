import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { neonAuthBaseUrl, neonAuthCookieSecret } from "@/server/core/config";

let auth: NeonAuth | undefined;

/** Lazy so static pages, tests and builds do not require cloud credentials. */
export function neonAuth(): NeonAuth {
  return (auth ??= createNeonAuth({
    baseUrl: neonAuthBaseUrl(),
    cookies: {
      secret: neonAuthCookieSecret(),
      sessionDataTtl: 300,
      sameSite: "lax",
    },
    logLevel: "warn",
  }));
}

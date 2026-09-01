import { NextResponse, type NextRequest } from "next/server";
import { neonAuth } from "@/server/core/auth/neon";
import { readGoogleSession } from "@/server/core/auth/google-session";
import { adminEmail } from "@/server/core/config";

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "www.lionsofzion.io") {
    const destination = request.nextUrl.clone();
    destination.hostname = "lionsofzion.io";
    destination.protocol = "https:";
    destination.port = "";
    return NextResponse.redirect(destination, 308);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin/login") {
    const googleUser = await readGoogleSession(request);
    if (googleUser?.email === adminEmail()) return NextResponse.next();
    return neonAuth().middleware({ loginUrl: "/admin/login" })(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};

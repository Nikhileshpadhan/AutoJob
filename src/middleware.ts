import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to /api/* routes
  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    const isMutating = ["POST", "PATCH", "DELETE", "PUT"].includes(method);

    if (isMutating) {
      // 1. CSRF Protection: Verify Origin / Host header matching (SEC-001)
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");

      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          // Compare hostnames/ports (allow standard localhost / 127.0.0.1 or exact host)
          if (originUrl.host !== host && !originUrl.host.includes("localhost") && !originUrl.host.includes("127.0.0.1")) {
            return NextResponse.json(
              { error: "Forbidden: Cross-origin mutating requests are rejected (CSRF Protection)." },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json({ error: "Invalid Origin header." }, { status: 403 });
        }
      }

      // 2. Optional Admin Secret enforcement
      const adminSecret = process.env.AUTOJOB_ADMIN_SECRET;
      if (adminSecret) {
        const authHeader = request.headers.get("authorization");
        const customHeader = request.headers.get("x-autojob-key");
        const cookieSecret = request.cookies.get("autojob_token")?.value;

        const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
        const provided = bearerToken || customHeader || cookieSecret;

        if (provided !== adminSecret) {
          return NextResponse.json(
            { error: "Unauthorized: Invalid or missing administrative credentials." },
            { status: 401 }
          );
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

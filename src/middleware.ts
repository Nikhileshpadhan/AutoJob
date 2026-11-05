import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt, AUTH_COOKIE_NAME } from "./lib/jwt";

// Public pages that require no authentication
const PUBLIC_PATHS = ["/", "/login", "/register"];

// API routes that are strictly public
const PUBLIC_API_PREFIXES = ["/api/auth/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow Next.js internals, static files, and icons
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Extract token from cookie or Authorization header
  let token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  // 3. Verify JWT
  const user = token ? await verifyJwt(token) : null;

  // 4. If logged in and attempting to visit /login or /register, redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 5. If visiting public pages (landing, login, register), allow through
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // 6. If visiting public API routes (auth register/login), allow through
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 7. Protected API routes: return JSON 401 if unauthenticated
  if (pathname.startsWith("/api/")) {
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // Pass user context via request header to downstream route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.userId);
    requestHeaders.set("x-user-email", user.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 8. Protected Web App pages: redirect to /login if unauthenticated
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forward authenticated user
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.userId);
  requestHeaders.set("x-user-email", user.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

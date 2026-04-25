import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const MFA_COOKIE = "mfa_verified";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/confirm-signin") ||
    path.startsWith("/verify-email") ||
    path.startsWith("/callback");

  const isOnboarding = path.startsWith("/onboarding");
  const isMfa = path.startsWith("/mfa");

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user && isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user && isMfa) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/dashboard")) {
    const jwt = request.cookies.get(MFA_COOKIE)?.value;
    if (!jwt) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      return NextResponse.redirect(url);
    }

    try {
      const secret = process.env.MFA_COOKIE_SIGNING_SECRET;
      if (!secret) throw new Error("Missing MFA cookie signing secret.");
      const { payload } = await jwtVerify(jwt, new TextEncoder().encode(secret));
      if (!payload?.sub) throw new Error("Invalid MFA session.");
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      return NextResponse.redirect(url);
    }
  }

  // Allow /callback to complete OAuth/email exchange even if a session already exists.
  if (user && isAuthPage && !isOnboarding && !path.startsWith("/callback")) {
    // Don't redirect away from auth pages until MFA is satisfied; otherwise users clicking
    // "Back to sign in" get bounced to /dashboard -> /mfa.
    const jwt = request.cookies.get(MFA_COOKIE)?.value;
    if (jwt) {
      try {
        const secret = process.env.MFA_COOKIE_SIGNING_SECRET;
        if (!secret) throw new Error("Missing MFA cookie signing secret.");
        const { payload } = await jwtVerify(jwt, new TextEncoder().encode(secret));
        if (payload?.sub) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      } catch {
        // ignore; allow auth page
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/confirm-signin",
    "/verify-email",
    "/onboarding/:path*",
    "/callback",
    "/mfa/:path*",
  ],
};

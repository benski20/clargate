import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const MFA_COOKIE = "mfa_verified";

function getIssuer(region: string, userPoolId: string) {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) return new NextResponse("Missing idToken", { status: 400 });

    const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const signingSecret = process.env.MFA_COOKIE_SIGNING_SECRET;

    if (!region || !userPoolId || !clientId || !signingSecret) {
      return new NextResponse("Server not configured for MFA", { status: 500 });
    }

    const issuer = getIssuer(region, userPoolId);
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
    });

    const sub = payload.sub;
    if (!sub) return new NextResponse("Invalid token", { status: 401 });

    const ttlSeconds = 60 * 60 * 12; // 12h
    const now = Math.floor(Date.now() / 1000);

    const cookieJwt = await new SignJWT({ sub })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .sign(new TextEncoder().encode(signingSecret));

    const res = NextResponse.json({ ok: true });
    res.cookies.set(MFA_COOKIE, cookieJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    return new NextResponse(msg, { status: 401 });
  }
}


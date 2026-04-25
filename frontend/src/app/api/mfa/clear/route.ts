import { NextResponse } from "next/server";

const MFA_COOKIE = "mfa_verified";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MFA_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}


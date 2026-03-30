"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { createClient, getAppOrigin } from "@/lib/supabase";
import { db } from "@/lib/database";
import { clearPendingSignupCode, setPendingSignupCode } from "@/lib/pending-signup-code";

const CODE_ERROR: Record<string, string> = {
  invalid_code: "That code is not valid.",
  expired: "This code has expired.",
  exhausted: "This code has reached its use limit.",
  missing_code: "Enter your institution code.",
};

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("code");
    if (q) setSignupCode(q.trim().toUpperCase());
  }, []);

  async function validateCode() {
    const trimmed = signupCode.trim();
    if (!trimmed) {
      setCodePreview(null);
      return;
    }
    setValidatingCode(true);
    setError(null);
    try {
      const res = await db.validateSignupCode(trimmed);
      if (res.valid && res.institution_name) {
        setCodePreview(`${res.institution_name} · ${formatRole(res.role)}`);
      } else {
        setCodePreview(null);
        setError(CODE_ERROR[res.error ?? "invalid_code"] ?? "Invalid code.");
      }
    } catch {
      setCodePreview(null);
      setError("Could not verify code. Try again.");
    } finally {
      setValidatingCode(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const code = signupCode.trim().toUpperCase();
    if (!code) {
      setError("Enter the institution code your admin shared with you.");
      setLoading(false);
      return;
    }

    const check = await db.validateSignupCode(code);
    if (!check.valid) {
      setError(CODE_ERROR[check.error ?? "invalid_code"] ?? "Invalid code.");
      setLoading(false);
      return;
    }

    const { error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${getAppOrigin()}/callback?next=/onboarding/redeem`,
      },
    });

    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }

    setPendingSignupCode(code);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const redeemed = await db.redeemSignupCode(code, fullName);
        if (redeemed.ok) {
          clearPendingSignupCode();
        }
      } catch {
        /* email confirmation may be required; user finishes on /onboarding/redeem */
      }
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <AuthShell>
        <Card className={`${authCardClassName} text-center`}>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" strokeWidth={2.5} aria-hidden />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
              After you confirm, sign in — you may be asked to confirm your institution code once if
              your account is not linked yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="h-11 w-full cursor-pointer rounded-full" render={<Link href="/login" />}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Create your account</CardTitle>
          <CardDescription className="text-base">
            Use the institution code from your IRB office or Clargate administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-code">Institution code</Label>
              <div className="flex gap-2">
                <Input
                  id="signup-code"
                  placeholder="e.g. CLG-AB12CD34"
                  value={signupCode}
                  onChange={(e) => {
                    setSignupCode(e.target.value.toUpperCase());
                    setCodePreview(null);
                  }}
                  className="h-11 rounded-xl font-mono text-sm tracking-wide"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 cursor-pointer rounded-xl"
                  disabled={validatingCode || !signupCode.trim()}
                  onClick={() => void validateCode()}
                >
                  {validatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </div>
              {codePreview ? (
                <p className="text-xs text-muted-foreground">{codePreview}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Dr. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                minLength={8}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="h-11 w-full cursor-pointer rounded-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary transition-colors hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

function formatRole(role?: string) {
  if (role === "pi") return "Researcher";
  if (role === "reviewer") return "Reviewer";
  if (role === "admin") return "Administrator";
  return role ?? "Member";
}

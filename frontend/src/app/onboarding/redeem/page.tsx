"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { createClient } from "@/lib/supabase";
import { db } from "@/lib/database";
import { clearPendingSignupCode, peekPendingSignupCode } from "@/lib/pending-signup-code";

const ERR: Record<string, string> = {
  invalid_code: "That code is not valid.",
  expired: "This code has expired.",
  exhausted: "This code has reached its use limit.",
  email_in_use: "This email already belongs to another account in that institution.",
  already_registered: "Your account is already registered.",
  unauthenticated: "Sign in again, then try the code.",
};

export default function RedeemSignupCodePage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      const existing = await db.getCurrentAppUser();
      if (cancelled) return;
      if (existing) {
        router.replace("/dashboard");
        return;
      }
      const pending = peekPendingSignupCode();
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;
      if (pending) setCode(pending);
      else if (q) setCode(q.trim().toUpperCase());
      const metaName = user.user_metadata?.full_name as string | undefined;
      if (metaName) setFullName(metaName);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await db.redeemSignupCode(code, fullName);
      if (res.ok) {
        clearPendingSignupCode();
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setError(ERR[res.error ?? ""] ?? "Could not redeem this code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Institution code</CardTitle>
          <CardDescription className="text-base">
            Enter the code your administrator gave you to join your organization in Clargate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CLG-XXXXXXXX"
                className="h-11 rounded-xl font-mono text-sm tracking-wide"
                required
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="h-11 rounded-xl"
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full cursor-pointer rounded-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join workspace
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

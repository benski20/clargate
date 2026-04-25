"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import { confirmSignIn, fetchAuthSession, fetchMFAPreference } from "aws-amplify/auth";

export default function ConfirmSignInPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // purely informational for the user; doesn't affect logic
    const step = sessionStorage.getItem("cognito_confirm_signin_step");
    if (!step) sessionStorage.setItem("cognito_confirm_signin_step", "CONFIRM_SIGN_IN_WITH_EMAIL_CODE");
  }, []);

  async function mintMfaCookie() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error("Missing Cognito session. Please sign in again.");
    const res = await fetch("/api/mfa/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Could not finalize MFA session.");
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      ensureAmplifyConfigured();
      const out = await confirmSignIn({ challengeResponse: code });

      if (out.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        router.replace("/mfa");
        router.refresh();
        return;
      }

      if (out.nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
        const setupUri = out.nextStep.totpSetupDetails.getSetupUri("Arbiter").toString();
        sessionStorage.setItem("cognito_totp_setup_uri", setupUri);
        sessionStorage.setItem("cognito_totp_flow", "signInSetup");
        router.replace("/mfa/enroll");
        router.refresh();
        return;
      }

      if (out.nextStep.signInStep === "DONE") {
        const { enabled, preferred } = await fetchMFAPreference();
        const totpEnabled =
          enabled?.includes("TOTP" as never) ||
          enabled?.includes("totp" as never) ||
          (preferred as unknown) === "TOTP" ||
          (preferred as unknown) === "totp";

        if (!totpEnabled) {
          sessionStorage.setItem("cognito_totp_flow", "postSignIn");
          router.replace("/mfa/enroll");
          router.refresh();
          return;
        }

        await mintMfaCookie();
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      throw new Error(`Unsupported sign-in step: ${out.nextStep.signInStep}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm sign-in.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" strokeWidth={1.75} aria-hidden />
          </div>
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Confirm sign in</CardTitle>
          <CardDescription className="text-base">
            Enter the 6-digit code Amazon sent you to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.4em]"
                required
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-9 w-full cursor-pointer rounded-md shadow-sm" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Wrong account?{" "}
            <Link href="/login" className="font-medium text-primary transition-colors hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import { cognitoUsernameForEmail } from "@/lib/cognito-username";
import { confirmSignUp, resendSignUpCode, signIn } from "aws-amplify/auth";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("cognito_verify_email");
    if (storedEmail) setEmail(storedEmail);
  }, []);

  async function resolveCognitoUsername() {
    // Prefer stored username; fall back to deterministic derivation.
    const storedUsername = sessionStorage.getItem("cognito_verify_username");
    if (storedUsername) return storedUsername;
    if (!email.trim()) throw new Error("Missing email.");
    const u = await cognitoUsernameForEmail(email);
    sessionStorage.setItem("cognito_verify_username", u);
    return u;
  }

  async function handleResend() {
    setSending(true);
    setError(null);
    try {
      ensureAmplifyConfigured();
      const username = await resolveCognitoUsername();
      await resendSignUpCode({ username });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      ensureAmplifyConfigured();
      const username = await resolveCognitoUsername();
      await confirmSignUp({ username, confirmationCode: code });

      const password = sessionStorage.getItem("cognito_verify_password") ?? "";
      if (!password) {
        // No stored password available (e.g. refresh); send them back to login.
        router.replace("/login");
        router.refresh();
        return;
      }

      // Now that the user is confirmed, sign in and proceed into MFA enrollment.
      let out;
      try {
        out = await signIn({ username: email, password });
      } catch {
        out = await signIn({ username, password });
      }

      sessionStorage.removeItem("cognito_verify_email");
      sessionStorage.removeItem("cognito_verify_username");
      sessionStorage.removeItem("cognito_verify_password");

      if (out.nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
        const setupUri = out.nextStep.totpSetupDetails.getSetupUri("Arbiter").toString();
        sessionStorage.setItem("cognito_totp_setup_uri", setupUri);
        sessionStorage.setItem("cognito_totp_flow", "signInSetup");
        router.replace("/mfa/enroll");
        router.refresh();
        return;
      }

      if (out.nextStep.signInStep === "DONE") {
        sessionStorage.setItem("cognito_totp_flow", "postSignIn");
        router.replace("/mfa/enroll");
        router.refresh();
        return;
      }

      if (out.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        router.replace("/mfa");
        router.refresh();
        return;
      }

      if (out.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE" || out.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_SMS_CODE") {
        sessionStorage.setItem("cognito_confirm_signin_step", out.nextStep.signInStep);
        router.replace("/confirm-signin");
        router.refresh();
        return;
      }

      throw new Error(`Unsupported sign-in step: ${out.nextStep.signInStep}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email.");
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
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Verify your email</CardTitle>
          <CardDescription className="text-base">
            Enter the code we emailed you to finish setting up your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                sessionStorage.setItem("cognito_verify_email", e.target.value);
              }}
              className="h-11 rounded-xl"
              required
            />
          </div>

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
              Verify email
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="h-9 w-full cursor-pointer rounded-md shadow-sm"
            onClick={() => void handleResend()}
            disabled={sending || !email.trim()}
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Resend code
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="font-medium text-primary transition-colors hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}


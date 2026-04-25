"use client";

import { useState } from "react";
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
import { createClient, getAppOrigin } from "@/lib/supabase";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import { fetchAuthSession, fetchMFAPreference, signIn, signUp } from "aws-amplify/auth";
import { cognitoUsernameForEmail } from "@/lib/cognito-username";

function guessNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "User";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: "User", familyName: "User", fullName: "User" };
  const givenName = parts[0][0]?.toUpperCase() + parts[0].slice(1);
  const familyName = (parts[1] ?? parts[0])[0]?.toUpperCase() + (parts[1] ?? parts[0]).slice(1);
  return { givenName, familyName, fullName: `${givenName} ${familyName}`.trim() };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "azure" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: sbError } = await supabase.auth.signInWithPassword({ email, password });
    if (sbError) {
      setError(sbError.message);
      setLoading(false);
      return;
    }

    try {
      ensureAmplifyConfigured();
      let out;
      try {
        out = await signIn({ username: email, password });
      } catch (cognitoErr) {
        const name = (cognitoErr as { name?: string })?.name;
        if (name === "UserNotFoundException") {
          const guessed = guessNameFromEmail(email);
          await signUp({
            username: await cognitoUsernameForEmail(email),
            password,
            options: {
              userAttributes: {
                email,
                name: guessed.fullName,
                given_name: guessed.givenName,
                family_name: guessed.familyName,
              },
            },
          });
          out = await signIn({ username: email, password });
        } else if (name === "NotAuthorizedException") {
          // If the pool uses email alias but doesn't accept email in this sign-in flow,
          // retry with the generated Cognito username.
          out = await signIn({ username: await cognitoUsernameForEmail(email), password });
        } else if (name === "UserNotConfirmedException") {
          sessionStorage.setItem("cognito_verify_email", email);
          sessionStorage.setItem("cognito_verify_username", await cognitoUsernameForEmail(email));
          router.replace("/verify-email");
          router.refresh();
          setLoading(false);
          return;
        } else {
          throw cognitoErr;
        }
      }

      switch (out.nextStep.signInStep) {
        case "CONFIRM_SIGN_IN_WITH_EMAIL_CODE":
        case "CONFIRM_SIGN_IN_WITH_SMS_CODE": {
          sessionStorage.setItem("cognito_confirm_signin_step", out.nextStep.signInStep);
          router.replace("/confirm-signin");
          router.refresh();
          break;
        }
        case "DONE": {
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
            break;
          }

          await mintMfaCookie();
          router.replace("/dashboard");
          router.refresh();
          break;
        }
        case "CONFIRM_SIGN_IN_WITH_TOTP_CODE": {
          router.replace("/mfa");
          router.refresh();
          break;
        }
        case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP": {
          const setupUri = out.nextStep.totpSetupDetails.getSetupUri("Arbiter").toString();
          sessionStorage.setItem("cognito_totp_setup_uri", setupUri);
          sessionStorage.setItem("cognito_totp_flow", "signInSetup");
          router.replace("/mfa/enroll");
          router.refresh();
          break;
        }
        default: {
          throw new Error(`Unsupported sign-in step: ${out.nextStep.signInStep}`);
        }
      }
    } catch (err) {
      await supabase.auth.signOut({ scope: "local" });
      setError(err instanceof Error ? err.message : "Could not complete sign-in.");
      setLoading(false);
      return;
    }
  }

  async function handleSSOLogin(provider: "google" | "azure") {
    setOauthProvider(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${getAppOrigin()}/callback` },
    });
    if (error) {
      setError(error.message);
      setOauthProvider(null);
    }
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
          <CardDescription className="text-base">Sign in to continue to your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="cursor-pointer text-sm font-medium text-primary transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="h-9 w-full cursor-pointer rounded-md shadow-sm" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              <span className="bg-card px-3">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              type="button"
              className="h-9 cursor-pointer rounded-md shadow-sm"
              disabled={!!oauthProvider || loading}
              onClick={() => handleSSOLogin("google")}
            >
              {oauthProvider === "google" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Google
            </Button>
            <Button
              variant="outline"
              type="button"
              className="h-9 cursor-pointer rounded-md shadow-sm"
              disabled={!!oauthProvider || loading}
              onClick={() => handleSSOLogin("azure")}
            >
              {oauthProvider === "azure" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Microsoft
            </Button>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary transition-colors hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

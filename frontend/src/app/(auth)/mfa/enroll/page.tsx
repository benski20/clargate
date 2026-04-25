"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import { confirmSignIn, fetchAuthSession, setUpTOTP, updateMFAPreference, verifyTOTPSetup } from "aws-amplify/auth";
import QRCode from "qrcode";

function parseSharedSecret(setupUri: string | null) {
  if (!setupUri) return null;
  const m = /[?&]secret=([^&]+)/.exec(setupUri);
  return m?.[1] ?? null;
}

export default function EnrollMfaPage() {
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const sharedSecret = useMemo(() => parseSharedSecret(setupUri), [setupUri]);

  useEffect(() => {
    let cancelled = false;
    if (!setupUri) {
      setQrDataUrl(null);
      return;
    }
    void (async () => {
      try {
        const url = await QRCode.toDataURL(setupUri, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setupUri]);

  useEffect(() => {
    const existing = sessionStorage.getItem("cognito_totp_setup_uri");
    if (existing) {
      setSetupUri(existing);
      return;
    }

    // Fallback: allow enabling TOTP after a user is already signed in to Cognito.
    void (async () => {
      try {
        ensureAmplifyConfigured();
        const details = await setUpTOTP();
        const uri = details.getSetupUri("Arbiter").toString();
        sessionStorage.setItem("cognito_totp_setup_uri", uri);
        sessionStorage.setItem("cognito_totp_flow", "postSignIn");
        setSetupUri(uri);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start TOTP enrollment.");
      }
    })();
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      ensureAmplifyConfigured();
      const flow = sessionStorage.getItem("cognito_totp_flow");

      if (flow === "signInSetup") {
        await confirmSignIn({ challengeResponse: code });
      } else {
        await verifyTOTPSetup({ code });
        await updateMFAPreference({ totp: "PREFERRED", sms: "DISABLED", email: "DISABLED" });
      }

      await mintMfaCookie();

      sessionStorage.removeItem("cognito_totp_setup_uri");
      sessionStorage.removeItem("cognito_totp_flow");

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete enrollment.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <QrCode className="h-6 w-6 text-primary" strokeWidth={1.75} aria-hidden />
          </div>
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Set up two-factor authentication</CardTitle>
          <CardDescription className="text-base">
            Add an authenticator app, then enter a 6-digit code to finish setup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupUri ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <KeyRound className="h-4 w-4" aria-hidden />
                Enrollment details
              </div>
              <div className="mt-3 space-y-3 text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, etc.).</li>
                  <li>
                    Choose <span className="font-medium text-foreground">Add account</span> →{" "}
                    <span className="font-medium text-foreground">Scan QR code</span>.
                  </li>
                  <li>
                    If you can’t scan, choose <span className="font-medium text-foreground">Enter a setup key</span> and paste
                    the key below.
                  </li>
                  <li>Then enter the 6-digit code from the app to finish.</li>
                </ol>

                {qrDataUrl ? (
                  <div className="mx-auto flex w-full justify-center">
                    <div className="rounded-xl bg-white p-3">
                      <img src={qrDataUrl} alt="Authenticator setup QR code" className="h-[220px] w-[220px]" />
                    </div>
                  </div>
                ) : null}

                {sharedSecret ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground">Setup key</div>
                    <div className="rounded-lg bg-background/60 p-3 font-mono text-xs text-foreground break-all">
                      {sharedSecret}
                    </div>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full cursor-pointer rounded-md shadow-sm"
                  onClick={() => window.open(setupUri, "_blank", "noopener,noreferrer")}
                >
                  Open in authenticator app
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading setup details" />
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
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
                disabled={!setupUri || loading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-9 w-full cursor-pointer rounded-md shadow-sm" disabled={!setupUri || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}


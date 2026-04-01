"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { authCardClassName } from "@/components/auth/auth-styles";
import { createClient, getAppOrigin } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}/callback`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="text-center">
          <AuthBrand />
          <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Reset password</CardTitle>
          <CardDescription className="text-base">
            {sent
              ? `We sent a link to ${email}`
              : "We’ll email you a link to choose a new password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-9 w-full cursor-pointer rounded-md shadow-sm" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
            </form>
          ) : (
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Check your inbox and follow the link to reset your password.
            </p>
          )}
          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary transition-colors hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

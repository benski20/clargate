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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "azure" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
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

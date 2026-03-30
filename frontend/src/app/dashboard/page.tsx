"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, MessageSquare, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  dashboardCardClass,
  DashboardWelcome,
} from "@/components/dashboard/dashboard-ui";
import { createClient } from "@/lib/supabase";
import { db } from "@/lib/database";
import type { Proposal, UserRole } from "@/lib/types";

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcomeName, setWelcomeName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (appUser?.role) setRole(appUser.role);
      if (appUser?.full_name?.trim()) {
        setWelcomeName(appUser.full_name.trim());
        return;
      }
      const { data } = await createClient().auth.getUser();
      const n =
        String(data.user?.user_metadata?.full_name ?? "").trim() ||
        data.user?.email?.split("@")[0] ||
        "";
      setWelcomeName(n);
    })();
  }, []);

  useEffect(() => {
    db
      .getProposals({ pageSize: 5 })
      .then(setProposals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: proposals.length,
    active: proposals.filter((p) =>
      ["submitted", "initial_review", "under_committee_review", "resubmitted"].includes(p.status)
    ).length,
    needsAction: proposals.filter((p) =>
      ["draft", "revisions_requested"].includes(p.status)
    ).length,
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {welcomeName ? (
          <DashboardWelcome
            name={welcomeName}
            subtitle="Here is a concise view of your proposals."
          />
        ) : (
          <div className="h-24 w-full max-w-md animate-pulse rounded-2xl bg-muted/60" aria-hidden />
        )}
        {role === "pi" && (
          <Button
            className="h-11 w-full shrink-0 cursor-pointer gap-2 rounded-full bg-foreground px-8 text-background hover:bg-foreground/90 lg:w-auto"
            render={<Link href="/dashboard/proposals/new" />}
          >
            <Plus className="h-4 w-4" />
            New proposal
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted">
              <FileText className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-medium tabular-nums tracking-tight">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Under review
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted">
              <Clock className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-medium tabular-nums tracking-tight">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Needs action
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-medium tabular-nums tracking-tight">
              {stats.needsAction}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={dashboardCardClass}>
        <CardHeader>
          <CardTitle className="font-[var(--font-heading)] text-lg font-medium">Recent proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No proposals yet. Create your first proposal to get started.
              </p>
              {role === "pi" && (
                <Button
                  className="mt-5 cursor-pointer gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  render={<Link href="/dashboard/proposals/new" />}
                >
                  <Plus className="h-4 w-4" />
                  New proposal
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {proposals.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/proposals/${p.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-transparent px-4 py-3 transition-colors duration-200 hover:border-border hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

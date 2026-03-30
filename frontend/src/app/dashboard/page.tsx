"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { db } from "@/lib/database";
import type { Proposal } from "@/lib/types";

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getProposals({ pageSize: 5 }).then(setProposals)
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
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
            Welcome back. Here&apos;s a concise view of your proposals.
          </p>
        </div>
        <Button
          className="h-11 shrink-0 cursor-pointer gap-2 rounded-full px-6 shadow-md shadow-primary/10"
          render={<Link href="/dashboard/proposals/new" />}
        >
          <Plus className="h-4 w-4" />
          New proposal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/80 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-semibold tabular-nums tracking-tight">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Under review
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-semibold tabular-nums tracking-tight">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Needs action
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <MessageSquare className="h-4 w-4 text-amber-700 dark:text-amber-400" strokeWidth={1.75} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
              {stats.needsAction}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-[var(--font-heading)] text-lg font-semibold">Recent proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : proposals.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No proposals yet. Create your first proposal to get started.
              </p>
              <Button
                className="mt-4 gap-2 cursor-pointer rounded-full"
                render={<Link href="/dashboard/proposals/new" />}
              >
                <Plus className="h-4 w-4" />
                New proposal
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/proposals/${p.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border/80 p-4 transition-colors duration-200 hover:border-primary/20 hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{p.title}</p>
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

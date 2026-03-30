"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import type { Proposal } from "@/lib/types";

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Proposal[]>("/proposals?page_size=5")
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back. Here&apos;s an overview of your proposals.
          </p>
        </div>
        <Button className="gap-2 cursor-pointer" render={<Link href="/dashboard/proposals/new" />}>
          <Plus className="h-4 w-4" />
          New Proposal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Proposals
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Under Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Your Action
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.needsAction}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Proposals</CardTitle>
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
                className="mt-4 gap-2 cursor-pointer"
                render={<Link href="/dashboard/proposals/new" />}
              >
                <Plus className="h-4 w-4" />
                New Proposal
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/proposals/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors duration-150 hover:bg-accent cursor-pointer"
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  dashboardCardClass,
  DashboardWelcome,
} from "@/components/dashboard/dashboard-ui";
import { createClient } from "@/lib/supabase";
import { db } from "@/lib/database";
import type { ReviewAssignment } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "bg-muted text-muted-foreground" },
  in_progress: {
    label: "In progress",
    color: "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  },
  submitted: {
    label: "Submitted",
    color: "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900",
  },
};

export default function ReviewerDashboard() {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcomeName, setWelcomeName] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const n =
          data.user?.user_metadata?.full_name ||
          data.user?.email?.split("@")[0] ||
          "";
        setWelcomeName(n);
      });
  }, []);

  useEffect(() => {
    db
      .getMyAssignments()
      .then(setAssignments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = assignments.filter((a) => a.status !== "submitted");
  const completed = assignments.filter((a) => a.status === "submitted");

  return (
    <div className="space-y-8 md:space-y-10">
      {welcomeName ? (
        <DashboardWelcome
          name={welcomeName}
          subtitle="Proposals assigned to you for review."
        />
      ) : (
        <div className="h-24 max-w-md animate-pulse rounded-2xl bg-muted/60" aria-hidden />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted">
              <Clock className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-medium tabular-nums tracking-tight">
              {pending.length}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Completed
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted">
              <CheckCircle2 className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-[var(--font-heading)] text-3xl font-medium tabular-nums tracking-tight">
              {completed.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className={dashboardCardClass}>
          <CardContent className="flex flex-col items-center py-14">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No review assignments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const statusInfo = STATUS_MAP[a.status];
            const daysSince = Math.floor(
              (Date.now() - new Date(a.assigned_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            return (
              <Link key={a.id} href={`/dashboard/reviewer/proposals/${a.proposal_id}`}>
                <Card
                  className={`${dashboardCardClass} cursor-pointer transition-colors duration-200 hover:bg-muted/40`}
                >
                  <CardContent className="flex items-center justify-between py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                        <ClipboardList className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Proposal {a.proposal_id.slice(0, 8)}…
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigned {daysSince} day{daysSince !== 1 ? "s" : ""} ago
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`${statusInfo.color} rounded-full border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

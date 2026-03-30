"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/database";
import type { ReviewAssignment } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-slate-100 text-slate-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  submitted: { label: "Submitted", color: "bg-emerald-100 text-emerald-700" },
};

export default function ReviewerDashboard() {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getMyAssignments().then(setAssignments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = assignments.filter((a) => a.status !== "submitted");
  const completed = assignments.filter((a) => a.status === "submitted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-bold">My Reviews</h1>
        <p className="mt-1 text-muted-foreground">
          Proposals assigned to you for review.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed.length}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No review assignments yet.
            </p>
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
                <Card className="cursor-pointer transition-colors duration-150 hover:bg-accent">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Proposal {a.proposal_id.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">
                          Assigned {daysSince} day{daysSince !== 1 ? "s" : ""} ago
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`${statusInfo.color} border-0`}>
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

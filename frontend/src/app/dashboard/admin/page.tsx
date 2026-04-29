"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  dashboardCardClass,
  dashboardInputClass,
  DashboardPageHeader,
  DashboardSearchInput,
} from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import type { Proposal, UserRole } from "@/lib/types";

const STATUS_FILTER_LABEL: Record<string, string> = {
  all: "All statuses",
  submitted: "Submitted",
  initial_review: "Initial review",
  revisions_requested: "Revisions requested",
  under_committee_review: "Committee review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdminDashboardPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const u = await db.getCurrentAppUser();
      if (!cancelled) setRole(u?.role ?? null);
      try {
        const list = await db.getProposals({ status: statusFilter, search, pageSize: 50 });
        if (!cancelled) setProposals(list);
      } catch {
        if (!cancelled) setProposals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter]);

  function proposalHref(proposalId: string) {
    return role === "reviewer"
      ? `/dashboard/admin/proposals/${proposalId}?tab=messages`
      : `/dashboard/admin/proposals/${proposalId}`;
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Submissions"
        description="Review and manage all proposals for your institution."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <DashboardSearchInput
            placeholder="Search by title or PI name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            aria-label="Search proposals"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger
            size="default"
            className={cn(
              "w-full min-w-0 gap-2 rounded-md sm:w-56",
              dashboardInputClass,
              "h-9 px-3 py-0 text-sm shadow-sm"
            )}
          >
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <SelectValue placeholder="Filter by status">
              {(value) => STATUS_FILTER_LABEL[String(value)] ?? String(value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="initial_review">Initial Review</SelectItem>
            <SelectItem value="revisions_requested">Revisions Requested</SelectItem>
            <SelectItem value="under_committee_review">Committee Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>PI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
                  </TableCell>
                </TableRow>
              ) : proposals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No proposals found.
                  </TableCell>
                </TableRow>
              ) : (
                proposals.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link
                        href={proposalHref(p.id)}
                        className="font-medium text-foreground hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.pi_name || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {p.review_type?.replace(/_/g, " ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.submitted_at
                        ? new Date(p.submitted_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        render={<Link href={proposalHref(p.id)} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

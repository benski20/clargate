"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  dashboardCardClass,
  dashboardInputClass,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import {
  auditActionLabel,
  auditEventSummary,
  formatAuditDetails,
  formatRelativeTime,
} from "@/lib/audit-display";
import type { AuditLogEntry } from "@/lib/types";

function entityTypeLabel(t: string): string {
  const map: Record<string, string> = {
    proposal: "Proposal",
    review_assignment: "Review assignment",
    proposal_document: "Document",
    user: "User",
    letter: "Letter",
    ai_summary: "AI summary",
    review: "Review",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function AuditLogPage() {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (appUser?.role !== "admin") {
        router.replace("/dashboard");
        setAccess("denied");
        return;
      }
      setAccess("allowed");
    })();
  }, [router]);

  useEffect(() => {
    if (access !== "allowed") return;
    db
      .getAuditLog({ entityType: entityFilter, action: actionFilter, pageSize: 150 })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [access, entityFilter, actionFilter]);

  if (access === "loading" || access === "denied") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  function exportCSV() {
    const headers = [
      "When (UTC)",
      "Relative",
      "Event",
      "Action code",
      "Actor name",
      "Actor email",
      "Entity type",
      "Entity ID",
      "Details",
    ];
    const rows = entries.map((e) => {
      const meta = e.metadata_ ?? {};
      const iso = new Date(e.created_at).toISOString();
      const details = formatAuditDetails(e.action, e.metadata_, e.created_at).replace(/\n/g, " | ");
      return [
        iso,
        formatRelativeTime(e.created_at),
        auditEventSummary(e.action, e.metadata_),
        e.action,
        e.actor?.full_name ?? "",
        e.actor?.email ?? "",
        e.entity_type,
        e.entity_id ?? "",
        details,
      ].map((c) => escapeCsvCell(String(c)));
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-8">
        <DashboardPageHeader
          eyebrow="Administration"
          title="Audit log"
          description="Who did what, on which record, and when—including proposal submission times when recorded in metadata."
          actions={
            <Button
              variant="outline"
              className="h-9 cursor-pointer gap-2 rounded-md border-border shadow-sm"
              onClick={exportCSV}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v ?? "all")}>
            <SelectTrigger className={`w-full sm:w-48 ${dashboardInputClass}`}>
              <SelectValue placeholder="Entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="proposal_document">Document</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter by action (e.g. submitted, upload)…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className={`max-w-md ${dashboardInputClass}`}
          />
        </div>

        <Card className={dashboardCardClass}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">When</TableHead>
                  <TableHead className="min-w-[200px]">Event</TableHead>
                  <TableHead className="min-w-[160px]">Actor</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[120px]">Record</TableHead>
                  <TableHead className="min-w-[280px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Loader2
                        className="mx-auto h-8 w-8 animate-spin text-muted-foreground"
                        aria-label="Loading"
                      />
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">No audit entries found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((e) => {
                    const meta = e.metadata_;
                    const summary = auditEventSummary(e.action, meta);
                    const details = formatAuditDetails(e.action, meta, e.created_at);
                    const proposalLink =
                      e.entity_type === "proposal" && e.entity_id
                        ? `/dashboard/admin/proposals/${e.entity_id}`
                        : null;

                    return (
                      <TableRow key={e.id}>
                        <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger className="cursor-default border-b border-dotted border-muted-foreground/40 text-left">
                              <span className="text-foreground">{formatRelativeTime(e.created_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-xs">
                              <p className="font-medium">Server time</p>
                              <p className="font-mono text-[11px] opacity-90">
                                {new Date(e.created_at).toLocaleString(undefined, {
                                  dateStyle: "full",
                                  timeStyle: "long",
                                })}
                              </p>
                              <p className="mt-1 font-mono text-[10px] opacity-75">
                                {new Date(e.created_at).toISOString()}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-sm font-medium leading-snug">{summary}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {auditActionLabel(e.action)}
                          </p>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {e.actor ? (
                            <>
                              <p className="leading-tight">{e.actor.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{e.actor.email}</p>
                            </>
                          ) : e.user_id ? (
                            <span className="font-mono text-xs text-muted-foreground">{e.user_id}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm capitalize text-muted-foreground">
                          {entityTypeLabel(e.entity_type)}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs">
                          {proposalLink ? (
                            <Link
                              href={proposalLink}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {e.entity_id?.slice(0, 8)}…
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{e.entity_id?.slice(0, 8) ?? "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top max-w-md">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {details}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

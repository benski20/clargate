"use client";

import { useEffect, useState } from "react";
import { ScrollText, Download } from "lucide-react";
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
import { db } from "@/lib/database";
import type { AuditLogEntry } from "@/lib/types";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    db
      .getAuditLog({ entityType: entityFilter, action: actionFilter, pageSize: 100 })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityFilter, actionFilter]);

  function exportCSV() {
    const headers = ["Timestamp", "Action", "Entity Type", "Entity ID", "User ID"];
    const rows = entries.map((e) => [
      new Date(e.created_at).toISOString(),
      e.action,
      e.entity_type,
      e.entity_id || "",
      e.user_id || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl font-bold">Audit Log</h1>
          <p className="mt-1 text-muted-foreground">
            Complete, tamper-evident log of all platform actions.
          </p>
        </div>
        <Button variant="outline" className="gap-2 cursor-pointer" onClick={exportCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="letter">Letter</SelectItem>
            <SelectItem value="proposal_document">Document</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No audit entries found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{e.action}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{e.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {e.entity_id || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {e.metadata_ ? JSON.stringify(e.metadata_) : "—"}
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

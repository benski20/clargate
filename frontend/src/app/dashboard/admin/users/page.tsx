"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, KeyRound, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type { SignupCodeRow, User, UserRole } from "@/lib/types";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  reviewer: "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  pi: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<SignupCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codesLoadError, setCodesLoadError] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "pi" as UserRole,
  });
  const [codeForm, setCodeForm] = useState({
    role: "pi" as UserRole,
    max_uses: "",
    label: "",
    expires_at: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await db.getInstitutionUsers();
        if (!cancelled) setUsers(u);
      } catch {
        if (!cancelled) setUsers([]);
      }
      try {
        const c = await db.listSignupCodes();
        if (!cancelled) {
          setCodes(Array.isArray(c) ? c : []);
          setCodesLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCodesLoadError(err instanceof Error ? err.message : "Could not load signup codes.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateCode(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCode(true);
    setCodeError(null);
    try {
      const row = await db.createSignupCode({
        role: codeForm.role,
        label: codeForm.label || null,
        max_uses: codeForm.max_uses.trim() ? Number(codeForm.max_uses) : null,
        expires_at: codeForm.expires_at ? new Date(codeForm.expires_at).toISOString() : null,
      });
      setCodes((prev) => [row, ...prev]);
      setCodeDialogOpen(false);
      setCodeForm({ role: "pi", max_uses: "", label: "", expires_at: "" });
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Could not create signup code.");
    } finally {
      setCreatingCode(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const newUser = await invokeEdgeFunction<User>("invite-user", inviteForm);
      setUsers((prev) => [newUser, ...prev]);
      setInviteOpen(false);
      setInviteForm({ email: "", full_name: "", role: "pi" });
    } catch {
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, role: UserRole) {
    setRoleUpdatingId(userId);
    try {
      const updated = await invokeEdgeFunction<User>("update-role", { user_id: userId, role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch {
    } finally {
      setRoleUpdatingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Users"
        description="Manage users and roles for your institution."
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={codeDialogOpen}
              onOpenChange={(open) => {
                setCodeDialogOpen(open);
                if (!open) setCodeError(null);
              }}
            >
              <DialogTrigger render={<Button variant="outline" className="h-11 cursor-pointer gap-2 rounded-full" />}>
                <KeyRound className="h-4 w-4" />
                New signup code
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create signup code</DialogTitle>
                  <DialogDescription>
                    Share this code with people who should self-serve register for your institution. Each redemption
                    consumes one use (if limited).
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCode} className="space-y-5">
                  {codeError ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {codeError}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Role for new accounts</Label>
                    <Select
                      value={codeForm.role}
                      onValueChange={(v) => setCodeForm((f) => ({ ...f, role: v as UserRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pi">Researcher (PI)</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Label (optional)</Label>
                    <Input
                      value={codeForm.label}
                      onChange={(e) => setCodeForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Spring 2026 cohort"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max uses (optional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={codeForm.max_uses}
                      onChange={(e) => setCodeForm((f) => ({ ...f, max_uses: e.target.value }))}
                      placeholder="Unlimited if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={codeForm.expires_at}
                      onChange={(e) => setCodeForm((f) => ({ ...f, expires_at: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-full cursor-pointer" disabled={creatingCode}>
                    {creatingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate code
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger render={<Button className="h-11 cursor-pointer gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90" />}>
              <UserPlus className="h-4 w-4" />
              Invite user
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>Send an invitation to join your institution on Arbiter.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-5">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Dr. Jane Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@institution.edu"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v as UserRole }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pi">Researcher (PI)</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </form>
          </DialogContent>
          </Dialog>
          </div>
        }
      />

      <Card className={dashboardCardClass}>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-[var(--font-heading)] text-lg font-medium tracking-tight">Signup codes</h2>
              <p className="text-sm text-muted-foreground">
                Codes tie new accounts to your institution and role. Share with users who sign up at{" "}
                <span className="font-mono text-xs">/signup</span>.
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : codesLoadError ? (
            <p className="text-sm text-destructive">{codesLoadError}</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes yet. Create one to enable self-serve registration.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[4rem]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm tracking-wide">{c.code}</TableCell>
                    <TableCell className="capitalize">{c.role === "pi" ? "Researcher" : c.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.max_uses == null ? `${c.uses_count} / ∞` : `${c.uses_count} / ${c.max_uses}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.expires_at ? new Date(c.expires_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        aria-label="Copy code"
                        onClick={() => void navigator.clipboard.writeText(c.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className={dashboardCardClass}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {roleUpdatingId === u.id ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                        ) : null}
                        <Select
                          value={u.role}
                          onValueChange={(v) => changeRole(u.id, v as UserRole)}
                          disabled={!!roleUpdatingId}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <Badge variant="secondary" className={`${ROLE_COLORS[u.role]} border-0`}>
                              {u.role === "pi" ? "Researcher" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                            </Badge>
                          </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pi">Researcher (PI)</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          u.is_active
                            ? "rounded-full border-0 bg-foreground text-background"
                            : "rounded-full border-0 bg-muted text-muted-foreground"
                        }
                      >
                        {u.is_active ? "Active" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
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

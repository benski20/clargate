"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
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
import type { User, UserRole } from "@/lib/types";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  reviewer: "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  pi: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "pi" as UserRole,
  });

  useEffect(() => {
    db.getInstitutionUsers().then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger render={<Button className="h-11 cursor-pointer gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90" />}>
              <UserPlus className="h-4 w-4" />
              Invite user
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>Send an invitation to join your institution on Clargate.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
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
        }
      />

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

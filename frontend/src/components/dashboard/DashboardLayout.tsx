"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Inbox,
  Users,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Menu,
  ScrollText,
  Loader2,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase";
import { db } from "@/lib/database";
import type { User, UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "reviewer", "pi"] },
  { label: "My Proposals", href: "/dashboard/proposals", icon: FileText, roles: ["pi"] },
  { label: "Submissions", href: "/dashboard/admin", icon: ClipboardList, roles: ["admin"] },
  { label: "Inbox", href: "/dashboard/admin/inbox", icon: Inbox, roles: ["admin"] },
  { label: "Users", href: "/dashboard/admin/users", icon: Users, roles: ["admin"] },
  { label: "Audit Log", href: "/dashboard/admin/audit", icon: ScrollText, roles: ["admin"] },
  { label: "Configure", href: "/dashboard/admin/configure", icon: BookMarked, roles: ["admin"] },
  { label: "My Reviews", href: "/dashboard/reviewer", icon: ClipboardList, roles: ["reviewer"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [appUser, setAppUser] = useState<User | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        if (!cancelled) setAppUser(null);
        return;
      }
      const row = await db.getCurrentAppUser();
      if (cancelled) return;
      if (!row) {
        router.replace("/onboarding/redeem");
        setAppUser(null);
        return;
      }
      setAppUser(row as User);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    // `scope: "local"` signs out this browser session only; default `global` revokes all sessions and is slower.
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  const filteredNav = navItems.filter((item) => appUser && item.roles.includes(appUser.role));
  const initials =
    appUser?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  function UserBlock({ compact }: { compact?: boolean }) {
    return (
      <div className={`flex items-center gap-3 ${compact ? "px-1" : "px-2"}`}>
        <Avatar className="h-10 w-10 shrink-0 border border-border/80 shadow-sm">
          <AvatarFallback className="bg-muted text-xs font-medium text-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{appUser?.full_name || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{appUser?.email}</p>
        </div>
      </div>
    );
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pb-4 pt-5">
          <Link href="/" className="block font-[var(--font-heading)] text-lg font-medium tracking-tight text-foreground">
            Aribter
          </Link>
          <p className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </p>
        </div>

        <div className="px-3 pb-4">
          <UserBlock />
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border/80 p-2">
          <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenuTrigger>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSettingsOpen(false);
                  void handleLogout();
                }}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  if (appUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading workspace" />
      </div>
    );
  }

  if (appUser === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Redirecting" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/50">
      <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 p-4 md:block">
        <div
          className={`flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)]`}
        >
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/95 px-4 backdrop-blur-md md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer rounded-2xl" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,18rem)] border-r border-border/80 p-0">
              <div className="flex h-full flex-col p-4">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-[var(--font-heading)] text-base font-medium tracking-tight">Aribter</span>
        </header>

        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 md:px-8 md:py-10 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

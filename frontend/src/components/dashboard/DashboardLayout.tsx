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
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
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
import { cn } from "@/lib/utils";
import { SidebarNavCollapsible } from "@/components/ui/sidebar-with-submenu";
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

function linkIsActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function DashboardSidebarPanel({
  appUser,
  pathname,
  filteredNav,
  onNavigate,
  settingsOpen,
  onSettingsOpenChange,
  onLogout,
  onCollapseRequest,
}: {
  appUser: User;
  pathname: string;
  filteredNav: NavItem[];
  onNavigate: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onLogout: () => void;
  /** Desktop rail only: collapse the sidebar */
  onCollapseRequest?: () => void;
}) {
  const initials =
    appUser.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const isAdmin = appUser.role === "admin";
  const dashboardItem = filteredNav.find((item) => item.href === "/dashboard");
  const adminSectionItems = isAdmin ? filteredNav.filter((item) => item.href !== "/dashboard") : [];
  const flatNav = isAdmin && dashboardItem ? [dashboardItem] : filteredNav;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-sidebar-border px-4 pb-4 pt-6 sm:px-5">
        <div className="min-w-0">
          <Link href="/" className="block font-semibold text-xl tracking-tight text-sidebar-foreground">
            Arbiter
          </Link>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
        </div>
        {onCollapseRequest ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onCollapseRequest}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="px-4 pb-5 pt-5">
        <div className="flex items-center gap-3 px-1">
          <Avatar className="h-9 w-9 shrink-0 border border-border/60 shadow-sm">
            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{appUser.full_name || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{appUser.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {flatNav.map((item) => {
          const isActive = linkIsActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-primary/5 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && adminSectionItems.length > 0 ? (
          <SidebarNavCollapsible
            title="Administration"
            icon={Shield}
            onNavigate={onNavigate}
            items={adminSectionItems.map((item) => ({
              href: item.href,
              label: item.label,
              icon: item.icon,
              isActive: linkIsActive(pathname, item.href),
            }))}
          />
        ) : null}
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3">
        <DropdownMenu open={settingsOpen} onOpenChange={onSettingsOpenChange}>
          <DropdownMenuTrigger
            nativeButton={false}
            render={
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onSettingsOpenChange(false);
                void onLogout();
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

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [appUser, setAppUser] = useState<User | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Desktop sidebar: collapsed by default */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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

  /** AI intake / upload workspace needs more horizontal room while keeping the dashboard shell */
  const wideMainContent =
    pathname.startsWith("/dashboard/proposals/new") ||
    /\/dashboard\/proposals\/[^/]+\/edit$/.test(pathname);

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
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200 ease-out md:block",
          sidebarExpanded ? "w-64 border-r border-sidebar-border" : "w-0 border-0 pointer-events-none"
        )}
        aria-hidden={!sidebarExpanded}
      >
        <div className="flex h-full w-64 min-w-64 flex-col overflow-hidden">
          <DashboardSidebarPanel
            appUser={appUser}
            pathname={pathname}
            filteredNav={filteredNav}
            onNavigate={() => setMobileOpen(false)}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            onLogout={handleLogout}
            onCollapseRequest={() => setSidebarExpanded(false)}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-md",
            sidebarExpanded && "md:hidden"
          )}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="cursor-pointer rounded-md md:hidden" aria-label="Open menu" />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,18rem)] border-r border-sidebar-border bg-sidebar p-0">
              <div className="flex h-full flex-col">
                <DashboardSidebarPanel
                  appUser={appUser}
                  pathname={pathname}
                  filteredNav={filteredNav}
                  onNavigate={() => setMobileOpen(false)}
                  settingsOpen={settingsOpen}
                  onSettingsOpenChange={setSettingsOpen}
                  onLogout={handleLogout}
                />
              </div>
            </SheetContent>
          </Sheet>
          {!sidebarExpanded ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden cursor-pointer rounded-md md:inline-flex"
              onClick={() => setSidebarExpanded(true)}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </Button>
          ) : null}
          <span className="font-semibold text-base tracking-tight">Arbiter</span>
        </header>

        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 md:px-8 md:py-10 lg:px-10">
          <div className={cn("mx-auto w-full", wideMainContent ? "max-w-[1600px]" : "max-w-6xl")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

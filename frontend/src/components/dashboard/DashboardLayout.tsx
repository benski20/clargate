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
  Building2,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

/** Admin: full administration section in the collapsible nav. */
const ADMIN_SECTION_NAV_HREFS = new Set([
  "/dashboard/admin",
  "/dashboard/admin/inbox",
  "/dashboard/admin/users",
  "/dashboard/admin/audit",
  "/dashboard/admin/configure",
]);

/** Reviewer: submissions queue + inbox only (no users, audit, or configure). */
const REVIEWER_STAFF_NAV_HREFS = new Set(["/dashboard/admin", "/dashboard/admin/inbox"]);

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "reviewer", "pi"] },
  { label: "My Proposals", href: "/dashboard/proposals", icon: FileText, roles: ["pi"] },
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox, roles: ["pi"] },
  {
    label: "Your institution",
    href: "/dashboard/institution",
    icon: Building2,
    roles: ["pi", "reviewer"],
  },
  { label: "Submissions", href: "/dashboard/admin", icon: ClipboardList, roles: ["admin", "reviewer"] },
  { label: "Inbox", href: "/dashboard/admin/inbox", icon: Inbox, roles: ["admin", "reviewer"] },
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
  onExpandRequest,
  compact,
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
  /** Desktop rail only: expand from icon-only mode */
  onExpandRequest?: () => void;
  /** Narrow icon rail (desktop sidebar collapsed) */
  compact?: boolean;
}) {
  const initials =
    appUser.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const isInstitutionStaff = appUser.role === "admin" || appUser.role === "reviewer";
  const dashboardItem = filteredNav.find((item) => item.href === "/dashboard");
  const institutionItem = filteredNav.find((item) => item.href === "/dashboard/institution");
  const myReviewsItem = filteredNav.find((item) => item.href === "/dashboard/reviewer");

  let flatNav: NavItem[];
  let adminSectionItems: NavItem[];

  if (appUser.role === "admin") {
    flatNav = dashboardItem ? [dashboardItem] : [];
    adminSectionItems = filteredNav.filter(
      (item) => item.href !== "/dashboard" && ADMIN_SECTION_NAV_HREFS.has(item.href),
    );
  } else if (appUser.role === "reviewer") {
    flatNav = [dashboardItem, institutionItem, myReviewsItem].filter(
      (item): item is NavItem => Boolean(item),
    );
    adminSectionItems = filteredNav.filter((item) => REVIEWER_STAFF_NAV_HREFS.has(item.href));
  } else {
    flatNav = filteredNav;
    adminSectionItems = [];
  }

  const showStaffCollapsible = isInstitutionStaff && adminSectionItems.length > 0;
  const adminSectionTitle = appUser.role === "reviewer" ? "Institution" : "Administration";

  if (compact) {
    return (
      <TooltipProvider delay={0}>
        <div className="flex h-full w-full flex-col items-stretch">
          <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-2 pb-3 pt-4">
            <Tooltip>
              <TooltipTrigger className="cursor-pointer rounded-md outline-none">
                <Link
                  href="/"
                  onClick={onNavigate}
                  className="flex h-9 w-9 items-center justify-center rounded-md font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  aria-label="Arbiter home"
                >
                  A
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Arbiter
              </TooltipContent>
            </Tooltip>
            {onExpandRequest ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={onExpandRequest}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="flex justify-center px-2 py-3">
            <Tooltip>
              <TooltipTrigger className="cursor-pointer rounded-full outline-none">
                <Avatar className="h-9 w-9 shrink-0 border border-border/60 shadow-sm">
                  <AvatarFallback className="bg-muted text-xs font-medium text-foreground">{initials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="max-w-[14rem]">
                <p className="font-medium">{appUser.full_name || "—"}</p>
                <p className="text-muted-foreground">{appUser.email}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5 pb-4" aria-label="Workspace">
            {flatNav.map((item) => {
              const isActive = linkIsActive(pathname, item.href);
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger className="cursor-pointer rounded-md outline-none">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-label={item.label}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                        isActive
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {showStaffCollapsible ? (
              <>
                <div
                  className="my-1.5 h-px w-7 shrink-0 bg-sidebar-border/80"
                  role="separator"
                  aria-hidden
                />
                <span className="sr-only">{adminSectionTitle}</span>
                {adminSectionItems.map((item) => {
                  const isActive = linkIsActive(pathname, item.href);
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger className="cursor-pointer rounded-md outline-none">
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-label={`${adminSectionTitle}: ${item.label}`}
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                            isActive
                              ? "bg-primary/5 text-primary"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="flex max-w-[14rem] flex-col gap-0.5">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-80">
                          {adminSectionTitle}
                        </span>
                        <span>{item.label}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </>
            ) : null}
          </nav>

          <div className="mt-auto border-t border-sidebar-border p-2">
            <div className="flex justify-center">
              <DropdownMenu open={settingsOpen} onOpenChange={onSettingsOpenChange}>
                <DropdownMenuTrigger
                  nativeButton={false}
                  render={
                    <button
                      type="button"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      aria-label="Settings and account"
                      aria-haspopup="menu"
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" side="right" sideOffset={8} className="w-56">
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
        </div>
      </TooltipProvider>
    );
  }

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

        {showStaffCollapsible ? (
          <SidebarNavCollapsible
            title={appUser.role === "reviewer" ? "Institution" : "Administration"}
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
          sidebarExpanded ? "w-64 border-r border-sidebar-border" : "w-14 border-r border-sidebar-border"
        )}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden transition-[width] duration-200 ease-out",
            sidebarExpanded ? "w-64 min-w-64" : "w-14 min-w-14"
          )}
        >
          <DashboardSidebarPanel
            appUser={appUser}
            pathname={pathname}
            filteredNav={filteredNav}
            onNavigate={() => setMobileOpen(false)}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            onLogout={handleLogout}
            onCollapseRequest={sidebarExpanded ? () => setSidebarExpanded(false) : undefined}
            onExpandRequest={!sidebarExpanded ? () => setSidebarExpanded(true) : undefined}
            compact={!sidebarExpanded}
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

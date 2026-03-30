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
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase";
import type { UserRole } from "@/lib/types";

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
  { label: "My Reviews", href: "/dashboard/reviewer", icon: ClipboardList, roles: ["reviewer"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ email: string; name: string; role: UserRole } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email || "",
          name: data.user.user_metadata?.full_name || data.user.email || "",
          role: (data.user.user_metadata?.role as UserRole) || "pi",
        });
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            C
          </span>
          <div>
            <span className="font-[var(--font-heading)] text-base font-semibold tracking-tight">Clargate</span>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Workspace
            </p>
          </div>
        </div>
        <Separator className="opacity-60" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Separator className="opacity-60" />
        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{user?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[17rem] shrink-0 border-r border-border/80 bg-sidebar/95 backdrop-blur-sm md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[17rem] border-r-border/80 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
            C
          </span>
          <span className="font-[var(--font-heading)] text-sm font-semibold">Clargate</span>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,oklch(0.99_0.006_252)_0%,oklch(0.985_0.008_252)_100%)] p-5 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

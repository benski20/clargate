"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
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
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-6 py-5">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-[var(--font-heading)] text-lg font-bold">Clargate</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="font-medium text-foreground truncate">{user?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
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
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:block">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-[var(--font-heading)] font-semibold">Clargate</span>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

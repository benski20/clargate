"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  dashboardCardClass,
  DashboardWelcome,
} from "@/components/dashboard/dashboard-ui";
import { createClient } from "@/lib/supabase";
import { db } from "@/lib/database";
import type { Proposal, UserRole } from "@/lib/types";

type QuickGradient = "orange" | "gray" | "purple" | "green";

type DashboardQuickCard = {
  badgeText: string;
  badgeColor: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  gradient: QuickGradient;
};

function dashboardQuickCards(role: UserRole | null): DashboardQuickCard[] {
  if (role === "pi") {
    return [
      {
        badgeText: "Start",
        badgeColor: "#ea580c",
        title: "New proposal",
        description:
          "Open a draft, attach documents, and submit when your package is complete.",
        ctaText: "Create proposal",
        ctaHref: "/dashboard/proposals/new",
        gradient: "orange",
      },
      {
        badgeText: "Track",
        badgeColor: "#64748b",
        title: "My proposals",
        description:
          "See every submission, status, and update in one place—no duplicate list here.",
        ctaText: "Open full list",
        ctaHref: "/dashboard/proposals",
        gradient: "gray",
      },
      {
        badgeText: "Messages",
        badgeColor: "#8b5cf6",
        title: "Inbox",
        description:
          "IRB and PI message threads across your proposals in one place.",
        ctaText: "Go to inbox",
        ctaHref: "/dashboard/inbox",
        gradient: "purple",
      },
      {
        badgeText: "Institution",
        badgeColor: "#059669",
        title: "Learn about your institution",
        description:
          "See rules, guidelines, examples, and local policies your IRB office configured for submissions.",
        ctaText: "View guidance",
        ctaHref: "/dashboard/institution",
        gradient: "green",
      },
    ];
  }
  if (role === "admin") {
    return [
      {
        badgeText: "Pipeline",
        badgeColor: "#ea580c",
        title: "Submissions",
        description:
          "Triage the full institutional queue, assignments, and next steps.",
        ctaText: "Open queue",
        ctaHref: "/dashboard/admin",
        gradient: "orange",
      },
      {
        badgeText: "Intake",
        badgeColor: "#64748b",
        title: "Inbox",
        description:
          "Catch administrative messages and items that need a quick response.",
        ctaText: "Go to inbox",
        ctaHref: "/dashboard/admin/inbox",
        gradient: "gray",
      },
      {
        badgeText: "Institution",
        badgeColor: "#059669",
        title: "Configure",
        description:
          "AI guidance, review settings, and institutional defaults for submissions.",
        ctaText: "Open settings",
        ctaHref: "/dashboard/admin/configure",
        gradient: "green",
      },
    ];
  }
  if (role === "reviewer") {
    return [
      {
        badgeText: "Pipeline",
        badgeColor: "#ea580c",
        title: "Submissions",
        description:
          "Open proposals in your institutional queue that you are assigned to review.",
        ctaText: "Open queue",
        ctaHref: "/dashboard/admin",
        gradient: "orange",
      },
      {
        badgeText: "Intake",
        badgeColor: "#64748b",
        title: "Inbox",
        description:
          "Message threads on proposals you are assigned to review.",
        ctaText: "Go to inbox",
        ctaHref: "/dashboard/admin/inbox",
        gradient: "gray",
      },
      {
        badgeText: "Institution",
        badgeColor: "#059669",
        title: "Learn about your institution",
        description:
          "Read-only rules, guidelines, examples, and local policies configured by your IRB office.",
        ctaText: "View guidance",
        ctaHref: "/dashboard/institution",
        gradient: "green",
      },
    ];
  }
  return [];
}

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [welcomeName, setWelcomeName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (appUser?.role) setRole(appUser.role);
      if (appUser?.full_name?.trim()) {
        setWelcomeName(appUser.full_name.trim());
        return;
      }
      const { data } = await createClient().auth.getUser();
      const n =
        String(data.user?.user_metadata?.full_name ?? "").trim() ||
        data.user?.email?.split("@")[0] ||
        "";
      setWelcomeName(n);
    })();
  }, []);

  useEffect(() => {
    db
      .getProposals({ pageSize: 500 })
      .then(setProposals)
      .catch(() => {});
  }, []);

  const stats = {
    total: proposals.length,
    active: proposals.filter((p) =>
      ["submitted", "initial_review", "under_committee_review", "resubmitted"].includes(p.status)
    ).length,
    needsAction: proposals.filter((p) =>
      ["draft", "revisions_requested"].includes(p.status)
    ).length,
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {welcomeName ? (
          <DashboardWelcome
            name={welcomeName}
            subtitle="Here is a concise view of your proposals."
          />
        ) : (
          <div className="h-24 w-full max-w-md animate-pulse rounded-lg bg-muted/60" aria-hidden />
        )}
        {role === "pi" && (
          <Button
            className="h-9 w-full shrink-0 cursor-pointer gap-2 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90 lg:w-auto"
            render={<Link href="/dashboard/proposals/new" />}
          >
            <Plus className="h-4 w-4" />
            New proposal
          </Button>
        )}
      </div>

      <div id="dashboard-stats" className="grid gap-4 scroll-mt-24 sm:grid-cols-3">
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
              <FileText className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl tabular-nums tracking-tight">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Under review
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
              <Clock className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl tabular-nums tracking-tight">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Needs action
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
              <MessageSquare className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl tabular-nums tracking-tight">
              {stats.needsAction}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-4 font-mono text-[0.65rem] font-normal uppercase tracking-[0.2em] text-muted-foreground">
          Quick links
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {role === null
            ? [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[180px] animate-pulse rounded-2xl bg-muted/70 md:h-[200px]"
                  aria-hidden
                />
              ))
            : dashboardQuickCards(role).map((card) => (
                <GradientCard
                  key={`${card.ctaHref}-${card.title}`}
                  badgeText={card.badgeText}
                  badgeColor={card.badgeColor}
                  title={card.title}
                  description={card.description}
                  ctaText={card.ctaText}
                  ctaHref={card.ctaHref}
                  gradient={card.gradient}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

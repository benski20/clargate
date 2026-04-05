import type { UserRole } from "@/lib/types";

/** Query param for interactive tour (step index, 0-based). */
export const PLATFORM_TOUR_QUERY = "platformTour";

/** Build a path with tour step in the query (or remove the param when `step` is null). */
export function platformTourUrl(path: string, step: number | null): string {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");
  if (step === null) {
    params.delete(PLATFORM_TOUR_QUERY);
  } else {
    params.set(PLATFORM_TOUR_QUERY, String(step));
  }
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** Remove only the tour param from the current location string. */
export function stripPlatformTour(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(PLATFORM_TOUR_QUERY);
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export type PlatformGuideStep = {
  title: string;
  body: string;
  /** Route to show for this step (tour navigates here). */
  path: string;
};

const PI_STEPS: PlatformGuideStep[] = [
  {
    title: "Your dashboard",
    path: "/dashboard",
    body: "These cards summarize totals, items under review, and anything waiting on you. Quick links below jump to common tasks—we will visit each area next.",
  },
  {
    title: "Start a submission",
    path: "/dashboard/proposals/new",
    body: "Create a new proposal, attach documents, and work through intake. Save drafts anytime—nothing is submitted until you explicitly submit the package.",
  },
  {
    title: "Track everything in one place",
    path: "/dashboard/proposals",
    body: "My proposals lists every submission with status and history. When the board requests changes, you will see it on the dashboard and here on the proposal.",
  },
  {
    title: "Messages across proposals",
    path: "/dashboard/inbox",
    body: "Inbox pulls IRB and PI threads across your proposals so you do not have to hunt inside each record.",
  },
  {
    title: "Your institution’s rules",
    path: "/dashboard/institution",
    body: "Your IRB office can publish local policies, examples, and guidance here. This context is merged into AI assistance and review expectations.",
  },
];

const ADMIN_STEPS: PlatformGuideStep[] = [
  {
    title: "Dashboard snapshot",
    path: "/dashboard",
    body: "You are in the administrative workspace. From here you can open the queue, inbox, and configuration—next screens walk through each.",
  },
  {
    title: "Institutional queue",
    path: "/dashboard/admin",
    body: "Triage the full submission queue: assignments, routing, and what needs attention next.",
  },
  {
    title: "Administrative inbox",
    path: "/dashboard/admin/inbox",
    body: "Threads that need a quick reply from staff stay visible so nothing sits unanswered.",
  },
  {
    title: "Configure Arbiter",
    path: "/dashboard/admin/configure",
    body: "Set AI guidance text and files, institutional defaults, and other site-specific expectations merged into intake and review.",
  },
];

const REVIEWER_STEPS: PlatformGuideStep[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    body: "This is your reviewer home. Next we will open the queue, inbox, and institution guidance in turn.",
  },
  {
    title: "Review queue",
    path: "/dashboard/admin",
    body: "Submissions lists proposals you are assigned to review. Open a row to read materials and record your assessment.",
  },
  {
    title: "Stay in the conversation",
    path: "/dashboard/admin/inbox",
    body: "Message threads on proposals you review appear here so clarifications stay in one place.",
  },
  {
    title: "Institutional context",
    path: "/dashboard/institution",
    body: "Read-only rules, examples, and policies your IRB office configured—use them to align reviews with local expectations.",
  },
];

export function platformGuideSteps(role: UserRole): PlatformGuideStep[] {
  if (role === "pi") return PI_STEPS;
  if (role === "admin") return ADMIN_STEPS;
  return REVIEWER_STEPS;
}

/** Whether the current URL path belongs to this tour step (exact dashboard vs prefix for nested routes). */
export function pathMatchesPlatformGuideStep(pathname: string, stepPath: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/";
  const sp = stepPath.replace(/\/$/, "") || "/";
  if (sp === "/dashboard") return norm === "/dashboard";
  return norm === sp || norm.startsWith(`${sp}/`);
}

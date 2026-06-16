import type { UserRole } from "@/lib/types";
import { TOUR_DEMO_PROPOSAL_ID } from "@/lib/tour-demo";

export const PLATFORM_TOUR_QUERY = "platformTour";

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

export function stripPlatformTour(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(PLATFORM_TOUR_QUERY);
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export type PlatformGuideStep = {
  title: string;
  body: string;
  path: string;
  tourPath?: string;
  phase?: string;
};

const PI_STEPS: PlatformGuideStep[] = [
  {
    title: "Dashboard",
    phase: "Overview",
    path: "/dashboard",
    body: "Your home screen shows active submissions, pending actions, and quick links to start a new proposal, view your list, or check messages.",
  },
  {
    title: "Starting a proposal",
    phase: "Getting started",
    path: "/dashboard/proposals/new",
    body: "Choose your workflow: Upload & complete if you have existing materials (PDF, Word, Excel), or Draft with AI to build your protocol interactively from scratch.",
  },

  {
    title: "Attach materials",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=0",
    body: "Upload your study documents and add any ground-truth notes for the AI. Enter a study title in the header before continuing.",
  },
  {
    title: "AI review",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=1",
    body: "The AI analyzes your materials section by section, identifying gaps, ambiguities, and areas that may need revision before IRB submission.",
  },
  {
    title: "Consent document",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=2",
    body: "Review and edit the AI-generated informed consent draft. Toggle between formatted preview and source editing.",
  },
  {
    title: "Compliance check",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=3",
    body: "Automated compliance checks flag regulatory considerations and predict your review category (exempt, expedited, or full board). Confirm or adjust before submitting.",
  },
  {
    title: "Supporting documents",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=4",
    body: "Attach supplementary files — recruitment scripts, survey instruments, device specifications — that reviewers should see alongside your protocol.",
  },
  {
    title: "Review and submit",
    phase: "Upload workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=5",
    body: "Confirm your complete package and submit to the IRB. Nothing is sent until you explicitly submit — all prior steps are saved as a draft.",
  },

  {
    title: "Open Draft with AI",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=picker&pick=chat",
    body: "The conversational path walks you through an interactive Q&A that builds your protocol in real time. Select Draft with AI from the chooser to begin.",
  },
  {
    title: "Reference materials",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=0",
    body: "Optionally upload reference files or notes before starting the conversation. You can also skip ahead if you are building from scratch.",
  },
  {
    title: "AI intake conversation",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=1",
    body: "Answer guided questions in the chat panel. The AI drafts protocol sections in real time, informed by your institution's configured rules and examples.",
  },
  {
    title: "Consent decision",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=2",
    body: "Choose whether to generate an AI-drafted consent document, or skip this step if your study does not require one.",
  },
  {
    title: "Consent review",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=3",
    body: "Review and edit the consent draft generated from your protocol and intake responses.",
  },
  {
    title: "Protocol preview",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=4",
    body: "Preview the assembled protocol document that will be exported on submission. Make any final edits before compliance checks.",
  },
  {
    title: "Compliance check",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=5",
    body: "Automated compliance analysis flags regulatory items and predicts your review category. Confirm before finalizing.",
  },
  {
    title: "Supporting documents",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=6",
    body: "Attach any additional files that reviewers should see beyond your core protocol and consent documents.",
  },
  {
    title: "Review and submit",
    phase: "AI drafting workflow",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=7",
    body: "Confirm your package and submit to the IRB. Nothing is sent until you explicitly submit.",
  },

  {
    title: "Draft privacy",
    phase: "Managing proposals",
    path: "/dashboard/proposals",
    tourPath: "/dashboard/proposals?demo=drafts",
    body: "Work is saved automatically as you go. Drafts are visible only to you — not IRB staff or reviewers — until you submit. You can leave and return to any draft at any time.",
  },
  {
    title: "My proposals",
    phase: "Managing proposals",
    path: "/dashboard/proposals",
    body: "All submissions are listed here with their current status. Open any row to view the full record, download documents, or resume editing a draft.",
  },
  {
    title: "Proposal detail",
    phase: "Managing proposals",
    path: "/dashboard/proposals",
    tourPath: `/dashboard/proposals/${TOUR_DEMO_PROPOSAL_ID}`,
    body: "The detail view organizes your protocol sections, attached documents with secure download links, revision letters from the IRB office, and a per-proposal message thread.",
  },
  {
    title: "Revisions and resubmission",
    phase: "Managing proposals",
    path: "/dashboard/proposals",
    tourPath: `/dashboard/proposals/${TOUR_DEMO_PROPOSAL_ID}?variant=revisions&tab=letters`,
    body: "When the IRB requests changes, open your proposal and use Edit to return to the workspace with your prior answers loaded. Address feedback, update documents, and resubmit.",
  },
  {
    title: "Inbox",
    phase: "Communication",
    path: "/dashboard/inbox",
    body: "Message threads from all of your proposals in one place. Reply to IRB staff directly — unread counts appear in the sidebar so nothing gets missed.",
  },
  {
    title: "Institutional guidance",
    phase: "Communication",
    path: "/dashboard/institution",
    body: "Your IRB office publishes local policies, example proposals, and campus-specific guidance here. This same content informs the AI during intake.",
  },
];

const ADMIN_PROPOSAL_TOUR = `/dashboard/admin/proposals/${TOUR_DEMO_PROPOSAL_ID}`;

const ADMIN_STEPS: PlatformGuideStep[] = [
  {
    title: "Admin dashboard",
    phase: "Overview",
    path: "/dashboard",
    body: "Your home screen shows the institutional pipeline at a glance — submissions queue, inbox, user management, audit log, and configuration.",
  },
  {
    title: "Submissions queue",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    body: "The full institutional queue lists every non-draft proposal. Search by title or PI name and filter by status to find what needs attention.",
  },
  {
    title: "Proposal workspace",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=summary`,
    body: "Each proposal opens a unified workspace with AI summary, protocol details, reviewer assignments, revision letters, and messaging — all accessible from the sidebar navigation.",
  },
  {
    title: "AI summary",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=summary`,
    body: "The AI summary provides a structured digest — study overview, key findings, compliance flags, and predicted review category — so staff can triage efficiently.",
  },
  {
    title: "Reviewer assignment",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=reviewers`,
    body: "Assign reviewers from your institution's roster. Assignments appear in each reviewer's queue — reviewers see only proposals they are assigned to.",
  },
  {
    title: "Status and decisions",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=reviewers`,
    body: "Advance proposals through the lifecycle: initial review, revisions requested, committee review, approved, or rejected. Every transition is recorded in the audit log.",
  },
  {
    title: "Revision letters",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=letter`,
    body: "Draft formal revision letters — optionally with AI assistance — then send to the PI. Sent letters appear on the investigator's proposal record.",
  },
  {
    title: "Messaging",
    phase: "Reviewing submissions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=messages`,
    body: "Per-proposal messaging keeps investigator correspondence in context alongside the protocol and documents.",
  },
  {
    title: "Admin inbox",
    phase: "Administration",
    path: "/dashboard/admin/inbox",
    body: "Surfaces unanswered message threads across the institution so coordinators can catch and route follow-ups in one place.",
  },
  {
    title: "Users and signup codes",
    phase: "Administration",
    path: "/dashboard/admin/users",
    body: "Manage institutional users by role, adjust permissions, and issue signup codes with configurable limits and expiration.",
  },
  {
    title: "Audit log",
    phase: "Administration",
    path: "/dashboard/admin/audit",
    body: "Searchable log of institutional actions — submissions, status changes, assignments, and more. Export to CSV for compliance reviews.",
  },
  {
    title: "Configuration",
    phase: "Administration",
    path: "/dashboard/admin/configure",
    body: "Publish institutional guidance — example proposals, mandatory rules, and policies — that shapes AI assistance for investigators and reviewers across your site.",
  },
];

const REVIEWER_STEPS: PlatformGuideStep[] = [
  {
    title: "Reviewer dashboard",
    phase: "Overview",
    path: "/dashboard",
    body: "Your home screen shows what needs attention — pending review assignments, messages, and links to institutional guidance.",
  },
  {
    title: "My reviews",
    phase: "Reviewing",
    path: "/dashboard/reviewer",
    body: "All proposals assigned to you, split between pending and completed. Each card shows assignment status and how long ago you were assigned.",
  },
  {
    title: "Assigned submissions",
    phase: "Reviewing",
    path: "/dashboard/admin",
    body: "The submissions view shows only proposals assigned to you — not the full institutional queue. Search and filter to find specific records.",
  },
  {
    title: "Reading a submission",
    phase: "Reviewing",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=details`,
    body: "Browse the AI summary for a quick digest, then open Details for the full protocol and attached documents. Use Messages to ask the PI for clarifications.",
  },
  {
    title: "Submitting your review",
    phase: "Reviewing",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=submit_review`,
    body: "Record your recommendation — approve, request revisions, or defer — with structured comments. Once submitted, staff see your input when making final decisions.",
  },
  {
    title: "Reviewer inbox",
    phase: "Communication",
    path: "/dashboard/admin/inbox",
    body: "Message threads on proposals you review appear here for easy follow-up across all your assignments.",
  },
  {
    title: "Institutional context",
    phase: "Communication",
    path: "/dashboard/institution",
    body: "Read-only access to the rules, guidelines, and policies your IRB office has configured. Use this reference to align your reviews with site-specific expectations.",
  },
];

export function platformGuideSteps(role: UserRole): PlatformGuideStep[] {
  if (role === "pi") return PI_STEPS;
  if (role === "admin") return ADMIN_STEPS;
  return REVIEWER_STEPS;
}

function parseStepRoute(route: string): { pathname: string; params: URLSearchParams } {
  const [pathname, queryString] = route.split("?");
  return { pathname, params: new URLSearchParams(queryString ?? "") };
}

export function platformGuideStepPath(step: PlatformGuideStep): string {
  return step.tourPath ?? step.path;
}

export function intakeWizardStepBadge(tourPath?: string): string | null {
  if (!tourPath) return null;
  const query = tourPath.split("?")[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const demo = params.get("demo");
  const demoStepRaw = params.get("demoStep");
  if (demo === "upload" && demoStepRaw !== null) {
    const n = Number.parseInt(demoStepRaw, 10);
    if (Number.isFinite(n)) return `Upload · Step ${n + 1} of 6`;
  }
  if (demo === "chat" && demoStepRaw !== null) {
    const n = Number.parseInt(demoStepRaw, 10);
    if (Number.isFinite(n)) return `AI draft · Step ${n + 1} of 8`;
  }
  if (demo === "picker") return "Choose workflow";
  return null;
}

export function stepMatchesPath(step: PlatformGuideStep, pathname: string, search = ""): boolean {
  const route = step.tourPath ?? step.path;
  const { pathname: expectedPath, params: expectedParams } = parseStepRoute(route);
  const norm = pathname.replace(/\/$/, "") || "/";
  const expectedNorm = expectedPath.replace(/\/$/, "") || "/";

  if (expectedNorm === "/dashboard") {
    if (norm !== "/dashboard") return false;
  } else if (norm !== expectedNorm && !norm.startsWith(`${expectedNorm}/`)) {
    return false;
  }

  if (step.tourPath) {
    const current = new URLSearchParams(search);
    for (const [key, value] of expectedParams.entries()) {
      if (key === PLATFORM_TOUR_QUERY) continue;
      if (current.get(key) !== value) return false;
    }
    return true;
  }

  return pathMatchesPlatformGuideStep(pathname, step.path);
}

export function pathMatchesPlatformGuideStep(pathname: string, stepPath: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/";
  const sp = stepPath.replace(/\/$/, "") || "/";
  if (sp === "/dashboard") return norm === "/dashboard";
  return norm === sp || norm.startsWith(`${sp}/`);
}

import type { UserRole } from "@/lib/types";
import { TOUR_DEMO_PROPOSAL_ID } from "@/lib/tour-demo";

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
  /** Default route for this step (sidebar context, list pages, etc.). */
  path: string;
  /** When set, tour navigates to the real screen (or demo variant of it). */
  tourPath?: string;
};

const PI_STEPS: PlatformGuideStep[] = [
  {
    title: "Your dashboard",
    path: "/dashboard",
    body: "Your home screen shows counts for active submissions, items under IRB review, and anything waiting on you. Quick-link cards below jump to the most common tasks—new proposals, your full list, inbox, and institutional guidance.",
  },
  {
    title: "Choose how to start",
    path: "/dashboard/proposals/new",
    body: "When you create a proposal, pick the path that fits your materials. Upload & complete is best when you already have a protocol or application file (PDF, Word, or Markdown). Draft with AI walks you through intake conversationally when you are building from scratch.",
  },
  {
    title: "Upload · Materials",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=0",
    body: "Upload path, step 1: attach PDF, Word, or Markdown files and add ground-truth notes for the AI. Enter a study title in the header before continuing.",
  },
  {
    title: "Upload · AI review",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=1",
    body: "Upload path, step 2: the AI reviews your materials and surfaces structured observations section by section—gaps, ambiguities, and suggested revisions before you package for the IRB.",
  },
  {
    title: "Upload · Consent",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=2",
    body: "Upload path, step 3: review and edit the AI-generated consent draft. Switch between preview and source editing before moving on.",
  },
  {
    title: "Upload · Compliance",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=3",
    body: "Upload path, step 4: compliance checks flag regulatory items and predict a specific review type (exempt or expedited subcategories under 45 CFR 46.104/46.110, full board, or undetermined). Confirm or adjust before submitting.",
  },
  {
    title: "Upload · Extra materials",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=4",
    body: "Upload path, step 5: attach supporting documents—recruitment scripts, surveys, or other files reviewers should see alongside your main package.",
  },
  {
    title: "Upload · Submit",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=upload&demoStep=5",
    body: "Upload path, step 6: confirm your package and submit to the IRB. Nothing is sent until you explicitly submit; prior steps stay saved as a draft.",
  },
  {
    title: "Open Draft with AI",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=picker&pick=chat",
    body: "The conversational path is separate from upload-and-review. From the chooser, pick Draft with AI to open the eight-step chat workspace (Materials → AI intake → Consent → Proposal → Compliance → Submit).",
  },
  {
    title: "Chat · Materials",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=0",
    body: "Draft-with-AI, step 1 of 8: optionally upload reference files or add notes—or skip ahead to AI intake if you are building the protocol from scratch. This is not the same as the upload path’s materials step.",
  },
  {
    title: "Chat · AI intake",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=1",
    body: "Draft-with-AI, step 2 of 8: answer guided questions in the chat. The AI drafts protocol sections live using your institution’s configured rules and examples.",
  },
  {
    title: "Chat · Consent?",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=2",
    body: "Draft-with-AI, step 3 of 8: decide whether you need an AI-generated consent document, or skip consent if your study does not require one.",
  },
  {
    title: "Chat · Consent",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=3",
    body: "Draft-with-AI, step 4 of 8: review and edit the consent draft generated from your protocol and intake answers.",
  },
  {
    title: "Chat · Proposal",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=4",
    body: "Draft-with-AI, step 5 of 8: preview the assembled proposal package—the full protocol document that will be exported on submit.",
  },
  {
    title: "Chat · Compliance",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=5",
    body: "Draft-with-AI, step 6 of 8: run compliance checks against 45 CFR 46 heuristics and review predicted review category before finalizing.",
  },
  {
    title: "Chat · Extra materials",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=6",
    body: "Draft-with-AI, step 7 of 8: attach any additional files investigators want reviewers to see beyond the core protocol and consent.",
  },
  {
    title: "Chat · Submit",
    path: "/dashboard/proposals/new",
    tourPath: "/dashboard/proposals/new?demo=chat&demoStep=7",
    body: "Draft-with-AI, step 8 of 8: confirm your package and submit to the IRB. Nothing is sent until you explicitly submit.",
  },
  {
    title: "Drafts stay private until you submit",
    path: "/dashboard/proposals",
    tourPath: "/dashboard/proposals?demo=drafts",
    body: "Work is saved automatically as you go. Drafts are visible only to you—not IRB staff or reviewers—until you explicitly submit the package. You can leave and return anytime; use My proposals to reopen a draft or a submission that needs revisions.",
  },
  {
    title: "My proposals",
    path: "/dashboard/proposals",
    body: "Every submission appears here with its current status (draft, submitted, under review, revisions requested, approved, and so on). Open any row to see the full record. Drafts you no longer need can be removed from your list without affecting submitted work.",
  },
  {
    title: "Inside a proposal",
    path: "/dashboard/proposals",
    tourPath: `/dashboard/proposals/${TOUR_DEMO_PROPOSAL_ID}`,
    body: "The proposal detail view organizes your protocol into browsable sections, attached documents (with secure download links), official revision letters from the IRB office, and a per-proposal message thread. When the board requests changes, status updates here and you can edit and resubmit from the same record.",
  },
  {
    title: "Revisions & resubmission",
    path: "/dashboard/proposals",
    tourPath: `/dashboard/proposals/${TOUR_DEMO_PROPOSAL_ID}?variant=revisions&tab=letters`,
    body: "If status is Revisions requested, open the proposal and use Edit to return to the intake workspace with your prior answers loaded. Address IRB feedback, update documents or consent as needed, then resubmit—the platform logs the resubmission for your institution’s audit trail.",
  },
  {
    title: "Messages across proposals",
    path: "/dashboard/inbox",
    body: "Inbox aggregates message threads from all of your proposals in one place. Reply to IRB staff without hunting inside each submission. Unread counts appear in the sidebar so time-sensitive clarifications do not get lost.",
  },
  {
    title: "Your institution’s rules",
    path: "/dashboard/institution",
    body: "Your IRB office publishes local policies here—example proposals, mandatory rules, guidelines, and campus-specific context. Read or download reference files. This same guidance is woven into AI assistance during intake and sets expectations for what a complete submission looks like at your site.",
  },
];

const ADMIN_PROPOSAL_TOUR = `/dashboard/admin/proposals/${TOUR_DEMO_PROPOSAL_ID}`;

const ADMIN_STEPS: PlatformGuideStep[] = [
  {
    title: "Administrative dashboard",
    path: "/dashboard",
    body: "Your home screen orients you to the institutional pipeline: open the submissions queue, administrative inbox, user management, audit log, and configuration. Sidebar navigation groups these under Administration when expanded.",
  },
  {
    title: "Submissions queue",
    path: "/dashboard/admin",
    body: "The full institutional queue lists every non-draft proposal. Search by title or PI name and filter by status—submitted, initial review, revisions requested, committee review, approved, or rejected. Click a row to open the proposal workspace for triage and action.",
  },
  {
    title: "Proposal workspace overview",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=summary`,
    body: "Each proposal opens a unified workspace with a navigation tree: AI Summary, protocol Details, Reviewers, Revision letter, Messages, and (for reviewers) Submit review. Status and key dates appear at the top; staff can update routing from here while reviewers see a read-only status.",
  },
  {
    title: "AI summary & compliance flags",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=summary`,
    body: "The Summary panel generates an AI digest of the submission on demand—title, form data, and institutional context—so staff and reviewers can triage faster. Compliance flags and predicted review category highlight items that may need extra scrutiny before assignment or decision.",
  },
  {
    title: "Assigning reviewers",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=reviewers`,
    body: "From the Reviewers section, assign one or more reviewers from your institution’s roster. Assignments appear in each reviewer’s queue and My Reviews dashboard. Reviewers gain access only to proposals they are assigned—not the full queue or other institutions’ data.",
  },
  {
    title: "Status changes & decisions",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=reviewers`,
    body: "Administrators advance proposals through the lifecycle: initial review, revisions requested, committee review, approved, or rejected. Status changes can include an internal note. Approvals use a confirmation step. Every transition is recorded in the audit log.",
  },
  {
    title: "Revision letters",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=letter`,
    body: "When revisions are needed, draft a formal letter in the Revision letter panel—optionally with AI-assisted drafting from the submission context. Review the text, then send to the PI; sent letters appear on the investigator’s proposal record and trigger their resubmission workflow.",
  },
  {
    title: "Per-proposal messaging",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=messages`,
    body: "The Messages tab on each proposal keeps investigator correspondence in context alongside the protocol and documents. Use it for clarifications that should stay tied to the submission rather than scattered email threads.",
  },
  {
    title: "Administrative inbox",
    path: "/dashboard/admin/inbox",
    body: "Inbox surfaces message threads across the institution that need a staff reply. It complements per-proposal messaging by giving coordinators one place to catch unanswered investigator questions and route follow-ups.",
  },
  {
    title: "Users & signup codes",
    path: "/dashboard/admin/users",
    body: "Manage who belongs to your institution: view users by role (PI, reviewer, admin), adjust roles when responsibilities change, and issue signup codes so new accounts attach to the correct organization and role. Codes can be limited by uses and expiration.",
  },
  {
    title: "Audit log",
    path: "/dashboard/admin/audit",
    body: "Review a searchable, institution-scoped log of significant actions—submissions and resubmissions, document uploads, status changes, reviewer assignments, revision letters sent, AI summaries generated, and role changes. Export to CSV for compliance reviews or SIEM ingestion.",
  },
  {
    title: "Configure Arbiter",
    path: "/dashboard/admin/configure",
    body: "Publish institutional guidance that shapes intake and review: example proposals, mandatory rules, guidelines, and campus-specific policies. Add text or upload reference files; content is extracted and merged into AI assistance for investigators and reviewers across your site.",
  },
];

const REVIEWER_STEPS: PlatformGuideStep[] = [
  {
    title: "Reviewer dashboard",
    path: "/dashboard",
    body: "Your home screen summarizes what needs attention and links to your review assignments, inbox, and institutional guidance. Use it as a starting point before diving into individual submissions.",
  },
  {
    title: "My Reviews",
    path: "/dashboard/reviewer",
    body: "This page lists every proposal assigned to you, split between pending and completed reviews. Each card shows assignment status (not started, in progress, or submitted) and how long ago you were assigned. Open a card to jump into that proposal’s workspace.",
  },
  {
    title: "Your review queue",
    path: "/dashboard/admin",
    body: "Submissions shows proposals you are assigned to review—not the full institutional queue. Search and filter the same way staff do, but only assigned records appear. Select a row to read materials, view AI summary, and record your assessment.",
  },
  {
    title: "Reading a submission",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=details`,
    body: "Inside a proposal, browse the AI Summary for a quick digest, then open Details for the full protocol sections and attached documents (downloads use short-lived secure links). Messages let you ask the PI or staff for clarifications without leaving the record.",
  },
  {
    title: "Submitting your review",
    path: "/dashboard/admin",
    tourPath: `${ADMIN_PROPOSAL_TOUR}?tab=submit_review`,
    body: "Use the Submit review section to record your recommendation—approve, request revisions, defer, or other options your institution supports—and add structured comments. Once submitted, your assignment moves to completed on My Reviews; staff see your input when making final decisions.",
  },
  {
    title: "Reviewer inbox",
    path: "/dashboard/admin/inbox",
    body: "Message threads on proposals you review appear here so follow-ups stay visible across assignments. Reply when investigators or staff need input from the assigned reviewer.",
  },
  {
    title: "Institutional context",
    path: "/dashboard/institution",
    body: "Read-only access to the rules, guidelines, example proposals, and local policies your IRB office configured. Use this reference to align your review with site-specific expectations—the same material investigators see during intake.",
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

/** Resolved navigation target for a tour step. */
export function platformGuideStepPath(step: PlatformGuideStep): string {
  return step.tourPath ?? step.path;
}

/** Wizard-relative label for intake demo tour steps (matches sidebar step numbers). */
export function intakeWizardStepBadge(tourPath?: string): string | null {
  if (!tourPath) return null;
  const query = tourPath.split("?")[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const demo = params.get("demo");
  const demoStepRaw = params.get("demoStep");
  if (demo === "upload" && demoStepRaw !== null) {
    const n = Number.parseInt(demoStepRaw, 10);
    if (Number.isFinite(n)) return `Upload path · Step ${n + 1} of 6`;
  }
  if (demo === "chat" && demoStepRaw !== null) {
    const n = Number.parseInt(demoStepRaw, 10);
    if (Number.isFinite(n)) return `Draft with AI · Step ${n + 1} of 8`;
  }
  if (demo === "picker") return "Choose intake path";
  return null;
}

/** Whether the current URL matches this tour step's target screen. */
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

/** Whether the current URL path belongs to this tour step (exact dashboard vs prefix for nested routes). */
export function pathMatchesPlatformGuideStep(pathname: string, stepPath: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/";
  const sp = stepPath.replace(/\/$/, "") || "/";
  if (sp === "/dashboard") return norm === "/dashboard";
  return norm === sp || norm.startsWith(`${sp}/`);
}

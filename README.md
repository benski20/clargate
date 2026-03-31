# Arbiter

**Arbiter is an AI-assisted IRB (Institutional Review Board) platform** — one governed workspace for investigators, administrators, and reviewers, from intake through decision. It replaces fragmented email, PDFs, and legacy submission tools with guided workflows, unified threads, and audit-oriented design.

---

## Landing page copy (gist)

Use the sections below as source material for a marketing site, one-pager, or investor blurb.

### Positioning

- **Headline direction:** *IRB operations, distilled to clarity.*
- **Subline:** A single workspace for investigators, administrators, and reviewers — from intake to decision, without the noise of scattered tools and inboxes.
- **Micro-trust:** No credit card required · Audit-oriented design · Security-first posture  
- **Status line (optional):** Accepting new institutions

### The gap

Legacy IRB workflows were not built for today. Most teams still stitch together tools from another era — patched with email and spreadsheets.

| Pain | What teams feel |
|------|------------------|
| **Fragmented communication** | Submissions scattered across email, PDFs, and spreadsheets — no single source of truth for status. |
| **Hidden delays** | Admins lose hours coaching rewrites, chasing documents, and drafting revision letters by hand. |
| **Inconsistent reviews** | Guidelines interpreted differently across reviewers — unpredictable outcomes for investigators. |

**Bridge line:** Arbiter replaces that patchwork with one governed workspace — built for compliance and speed.

### How it works (three steps)

1. **Submit** — Investigators complete guided intake with AI help; documents and answers live in one place.  
2. **Review** — Admins triage with summaries, assign reviewers, and draft revision letters with assistance.  
3. **Decide** — Structured evaluations, clear decisions, and renewal reminders — without the email chase.

**Compliance note:** Every step is logged so teams can answer who did what, and when, without digging through inboxes.

### Capabilities (platform pillars)

- **AI-assisted review** — Summaries and draft language that reduce reading load while keeping humans in control of every decision.  
- **Unified threads** — Per-proposal conversation with full context; fewer handoffs lost between systems or inboxes.  
- **Governance by design** — Roles, MFA-ready flows, and an append-only audit trail structured for serious compliance review.  
- **Guided submissions** — Step-by-step intake so investigators submit complete packages and cut unnecessary revision cycles.  
- **Role-aware surfaces** — PIs, admins, and reviewers each see what their job requires.  
- **Operational clarity** — Pipeline visibility and deadlines in one place instead of reconciling spreadsheets and email.

### Product surfaces (functional map)

- **PI submission portal** — Multi-step guided flow with an AI assistant.  
- **Admin dashboard** — Proposal summaries, reviewer assignment, revision-letter drafting support.  
- **Reviewer portal** — Structured review forms and decision options.  
- **Unified messaging** — Per-proposal threads, attachments, and reminders.  
- **Audit trail** — Tamper-evident, append-only logging of actions.

### Trust and security (messaging)

- SOC 2 ready · HIPAA aligned · US data residency · Encryption in transit and at rest  

**Technical posture (high level):** Supabase Auth for identity (JWT, SSO/MFA-capable patterns); application data and Row Level Security in Postgres; sensitive document flows supported via presigned S3-style uploads/downloads in Edge Functions; AI workloads run in Supabase Edge Functions (e.g. summarization, PI assistant, revision-letter drafting).

### Pricing (institution-wide framing)

One subscription covers the organization — predictable cost, without per-seat arithmetic.

| Tier | Price | Summary |
|------|-------|---------|
| **Starter** | $499 / month | Smaller institutions; capped submissions/year, core AI summaries, messaging, storage, email notifications. |
| **Professional** | $999 / month | Full workflow; unlimited submissions and seats; revision-letter drafting, PI assistant, SSO/SAML, audit reporting, priority support. |
| **Enterprise** | Custom | Dedicated success, custom SSO, analytics, migration help, BAA/custom contracts, optional on-premise. |

*Marketing disclaimer:* Taxes and implementation may vary; enterprise plans use custom terms.

### Closing CTA (tone)

*A quieter way to run IRB.* Move from reactive email threads to one governed workspace — start on your terms, with a trial that respects your time.

---

## Architecture (this repository)

| Layer | Stack |
|-------|--------|
| **Web app** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui — deployed (e.g. Vercel). |
| **Auth & data** | Supabase (Auth + Postgres with RLS). |
| **Serverless logic** | Supabase Edge Functions — AI (Google Gemini), email, reviewer assignment, presigned storage, etc. |
| **Design** | Shared tokens and references under `design-system/`. |

Product requirements and platform narrative PDFs live in `ProjectDocs/` (including PRD and platform overview).

---

## Repository layout

```
aribter/
├── frontend/           # Next.js app (marketing + dashboard)
│   └── src/
│       ├── app/        # Routes (landing, auth, dashboard)
│       ├── components/ # UI including landing sections
│       └── lib/        # Clients, auth helpers, utilities
├── supabase/
│   ├── functions/      # Edge Functions (AI, storage presign, workflows)
│   └── migrations/     # SQL (RLS, schema)
├── design-system/      # Design references
└── ProjectDocs/        # PRD and PDFs
```

---

## Quick start (frontend)

### Prerequisites

- Node.js 20+

### Local development

```bash
cd frontend
npm install
cp .env.example .env.local   # Set NEXT_PUBLIC_SUPABASE_* and NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the app (landing and authenticated areas require a configured Supabase project).

### Supabase

To run or deploy Edge Functions and apply migrations, use the [Supabase CLI](https://supabase.com/docs/guides/cli) against your project. Function code under `supabase/functions/` expects project secrets (e.g. AI keys, storage, email) to be set in the Supabase dashboard or CLI.

**Auth redirect URLs:** In the Supabase project → **Authentication** → **URL Configuration**, set **Site URL** to your deployed origin (or `http://localhost:3000` for local dev). Under **Redirect URLs**, add each origin you use with path `/callback` (Supabase matches the callback URL your app sends). For example: `http://localhost:3000/callback`, `https://<production-domain>/callback`, and optionally the same URLs with `?next=/onboarding/redeem` if you list query strings explicitly. These must align with `NEXT_PUBLIC_APP_URL` and `getAppOrigin()` in `frontend/src/lib/supabase.ts`.

#### Institutional signup codes

New accounts must **redeem a code** so `public.users` is linked to an institution and role (RLS depends on this).

1. Apply migrations through `004_…`: `002` (table + `redeem_signup_code`), `003` (`validate_signup_code` RPC for signups), `004` (RLS so admins **insert/select** `signup_codes` from the app — no Edge Functions for codes).
2. Signup code **verify** uses the `validate_signup_code` RPC via a small **`/api/validate-signup-code`** route (server calls PostgREST with the anon key only). **Create/list** codes use normal Supabase `.from("signup_codes")` as an admin.
3. **Admins** create codes under **Dashboard → Administration → Users** (“New signup code”). Share the code (e.g. `CLG-XXXXXXXX`) with people who should register.
4. Users enter the code on **`/signup`** (optional query `?code=CLG-...`). After email confirmation, if needed they finish at **`/onboarding/redeem`**.
5. If `redeem_signup_code` fails on migrate (e.g. `user_role` enum name differs), adjust the cast in the migration to match your schema.

**Bootstrap:** The first app user must still be created by your usual process (e.g. SQL insert into `users` + Auth user, or a seed script). After that, admins can mint codes for self-serve signups.

---

## Contributing

Match existing patterns in `frontend/` (components, `src/app` routing) and keep RLS policies in sync with any new tables or access rules in `supabase/migrations/`.

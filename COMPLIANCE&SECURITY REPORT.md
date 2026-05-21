# COMPLIANCE & SECURITY REPORT

**Product context:** Arbiter — AI-assisted IRB workflow platform (investigators, administrators, reviewers).  
**Review basis:** Static analysis of this repository and the in-repo **`AWS+Business+Associate+Addendum.pdf`** (no penetration test, no production configuration audit, no legal review).  
**Report date:** May 6, 2026  

---

## 1. Executive summary

The codebase implements **multi-tenant isolation by institution**, **role-based access** (PI / admin / reviewer), **defense-in-depth on sensitive flows** (server routes verifying identity before using privileged Supabase credentials), **database Row Level Security (RLS)** aligned with those roles, **structured application audit events** stored in Postgres, and **document handling via private object storage** with time-limited presigned downloads.

Institutional buyers evaluating **FERPA** or **HIPAA** should treat regulatory alignment as a **joint obligation**: the application encodes access boundaries and operational patterns that support common institutional controls, but **statutory/regulatory compliance depends on deployment choices, subprocessors, BAAs/DPAs, data classification, and organizational policies** — none of which are fully determined by application code alone.

For **AWS-hosted PHI**, this repository includes Amazon’s standard **AWS Business Associate Addendum (Online)** (`AWS+Business+Associate+Addendum.pdf`, document **#3256920v3**, dated **2023-01-20**). That addendum governs only a **HIPAA Account** designated when the customer accepts the BAA in **AWS Artifact** and uses **HIPAA Eligible Services** with required configurations — see **§13.1** below for a concise summary grounded in that PDF.

**Notable documentation vs. implementation gaps:** `ProjectDocs/infrastructure.md` describes a Supabase-centric auth story with AWS ECS/RDS inside a VPC; the checked-in Next.js app uses **Supabase Auth plus AWS Cognito for MFA**, hosts APIs on **Vercel-style Next.js routes**, and targets **Supabase Postgres + S3** — clients should reconcile marketing/architecture diagrams with the actual deployment they operate.

---

## 2. Scope and methodology

**In scope**

- `frontend/` — Next.js App Router, middleware, API routes, client data access  
- `supabase/migrations/` — RLS policies and audit triggers  
- `supabase/functions/` — Edge Functions (auth header patterns, AI, presigned uploads)  
- `ProjectDocs/infrastructure.md`, `README.md`, in-app privacy policy  
- `AWS+Business+Associate+Addendum.pdf` — AWS’s online HIPAA Business Associate Addendum (reference copy in repo)  

**Out of scope**

- Live Supabase/Vercel/AWS console settings (MFA enforcement flags, IP allowlists, log retention, encryption defaults on buckets, regional residency)  
- SOC 2 evidence packs, vendor questionnaires (beyond the included AWS BAA reference)  
- Behavior of Google Gemini / AWS / Supabase as subprocessors beyond what the code invokes  

---

## 3. Identity, authentication, and session controls

### 3.1 Supabase session + institutional user linkage

Authenticated requests use Supabase’s cookie-backed session (`createServerClient` with anon key). Application authorization repeatedly resolves `auth.users` → `public.users` by `supabase_uid`, then uses **institution_id** and **role** for gating (for example `requireAdminSession`, `requireProposalDocumentAccess`).

### 3.2 Multi-factor authentication (AWS Cognito + signed cookie)

Login performs **both** `signInWithPassword` against Supabase **and** Cognito `signIn` (`frontend/src/app/(auth)/login/page.tsx`). After MFA completion, `/api/mfa/complete` verifies the Cognito **ID token** against the pool JWKS and mints an **httpOnly, SameSite=lax** cookie (`mfa_verified`) signed with `MFA_COOKIE_SIGNING_SECRET` (`frontend/src/app/api/mfa/complete/route.ts`).

**Dashboard access:** Middleware requires a valid Supabase user **and** a valid MFA cookie before `/dashboard` routes (`frontend/src/middleware.ts`).

**Implications for client messaging**

- MFA is **implemented in code** as TOTP-style verification via Amplify/Cognito, layered on top of Supabase sessions — not “Supabase MFA only.”  
- Cookie TTL for MFA verification is **12 hours** (`ttlSeconds` in `/api/mfa/complete`).  

### 3.3 Institutional onboarding

New accounts are tied to institutions via **signup codes**; validation RPC `validate_signup_code` is exposed to `anon` and `authenticated` callers (`supabase/migrations/003_validate_signup_code_rpc.sql`). README documents server-mediated validation via `/api/validate-signup-code` to avoid exposing unnecessary logic client-side — institutions should ensure codes are distributed through controlled channels.

---

## 4. Authorization and data isolation (database RLS)

RLS is enabled on core tables including `institutions`, `users`, `proposals`, `proposal_documents`, messages, reviews, `audit_log`, etc. (`supabase/migrations/001_rls_policies.sql`).

**Representative patterns grounded in SQL**

- **Tenant boundary:** Policies consistently require `institution_id = current_user_institution_id()`.  
- **PI ownership:** PIs see/update proposals where `pi_user_id = current_user_id()` under defined statuses.  
- **Reviewer access:** Reviewers access proposals they are assigned to (via `review_assignments`), with draft/non-draft rules evolving across migrations `010`, `013`, and `014`.  
- **Draft confidentiality:** Migration `010_admin_cannot_access_draft_proposals.sql` documents intent that **admins must not see draft proposals** (PI-only until submitted); reviewers retain assignment-based paths where applicable.  
- **Audit visibility:** `audit_log` **SELECT** is restricted to **admin only** in `014_reviewer_scope_inbox_and_admin_only.sql` (reviewers explicitly excluded from audit log reads).

**Application-layer enforcement**

Server helpers duplicate critical checks (e.g. draft handling for staff vs. assigned reviewer in `frontend/src/lib/require-proposal-access-server.ts`), which complements RLS for routes using the **service role** (RLS bypass).

---

## 5. Audit logging and accountability

### 5.1 Database-backed `audit_log`

- **Read policy:** Admin-only (institution scoped) per migration `014`.  
- **Writes observed in code:**  
  - Postgres trigger `audit_log_proposal_submission` on proposal transitions to `submitted` / `resubmitted` (`supabase/migrations/007_audit_log_proposal_submissions.sql`).  
  - Inserts from Next.js API routes using `SUPABASE_SERVICE_ROLE_KEY` (e.g. document upload, admin status changes).  
  - Inserts from Supabase Edge Functions using the service client (e.g. `summarize`, `presign-upload`, `assign-reviewers`).  

---

## 6. Document storage and file handling

### 6.1 Preferred path: Next.js API + S3 SDK

`POST /api/proposals/[id]/upload-document` authenticates via Supabase session, confirms the caller is the **PI owner**, uploads bytes with `PutObjectCommand`, then inserts `proposal_documents` using the **service role**, and writes `audit_log` (`frontend/src/app/api/proposals/[id]/upload-document/route.ts`). Comments explicitly note AWS credentials remain server-only.

**Limits enforced in code:** upload size capped at **16 MiB** (`MAX_BYTES`).

### 6.2 Downloads

`GET .../documents/[documentId]/download` calls `requireProposalDocumentAccess`, loads the row with service role, returns a **short-lived presigned GET URL** (default **300 seconds** in `getPresignedDownloadUrl`) (`frontend/src/app/api/proposals/[id]/documents/[documentId]/download/route.ts`, `frontend/src/lib/s3-server.ts`).

### 6.3 Encryption configuration

`putObjectToS3` does **not** set `ServerSideEncryption` / KMS key IDs in code (`frontend/src/lib/s3-server.ts`). Bucket-level default encryption (e.g. SSE-KMS) would be an **operational** setting — `ProjectDocs/infrastructure.md` specifies KMS-encrypted objects, but that must match actual AWS configuration.

### 6.4 Legacy Edge Function uploads

`supabase/functions/presign-upload/index.ts` still generates presigned PUT URLs using Bearer `Authorization` and mirrors PI-only upload rules. `ProjectDocs/infrastructure.md` labels this path **legacy** relative to the Next.js upload route.

---

## 7. AI processing and subprocessors

### 7.1 Edge Function summarization (Gemini)

`summarize/index.ts` sends **proposal title and `form_data` JSON** to Google Gemini (`gemini-2.0-flash`) after verifying the caller is admin or reviewer and the proposal is non-draft and in-institution. Results persist to `ai_summaries` with `audit_log` entry action `ai_summary_generated`.

### 7.2 API implementation detail

`supabase/functions/_shared/gemini.ts` passes the API key as a **query parameter** (`key=`). This is an integration pattern institutions may wish to review from a **secrets-handling and logging surface** perspective (vendor HTTP logs vary).

### 7.3 Privacy policy alignment (in-repo product copy)

`frontend/src/app/privacy/page.tsx` states:

- Research content is processed for features invoked by users; **not used to train general-purpose models** for advertising/resale/broad model development.  
- Subprocessors/inference APIs are framed under contractual use restrictions.  
- Institutions retain responsibility for **what may be submitted** under ethics/grant/health-privacy laws where applicable.  

**FERPA / HIPAA lens:** Sending protocol narratives or attachments to **external inference APIs** can constitute disclosure of **education records** or **PHI** depending on content and agreements. The codebase **does not** automatically detect or block regulated categories before inference — **governance is contractual + procedural** (what institutions upload, which features they enable, regional deployments, Google Cloud / Vertex agreements, etc.).

---

## 8. Admin APIs and privileged credentials

Several sensitive workflows run only after server-side role checks **and** use `SUPABASE_SERVICE_ROLE_KEY` to insert audit rows or mutate protected state (`frontend/src/lib/supabase-service.ts`). Examples include proposal status changes, reviewer assignment, revision letters, and AI summary routes under `/api/admin/...`.

**Operational requirement:** Service role keys must never ship to browsers or client bundles — the code treats them as server-only (`supabase-service.ts` comment).

---

## 9. Edge Functions: authentication and CORS

Shared helper `getCallerUser` validates JWT via Supabase user client + loads app user via service client (`supabase/functions/_shared/supabase.ts`).

**CORS:** `_shared/cors.ts` sets `Access-Control-Allow-Origin: *` for Edge Functions. Combined with **`Authorization` Bearer tokens**, this is common for Supabase functions but is a **cross-origin exposure surface** institutions may wish to tighten (explicit origins in production).

---

## 10. CI and engineering hygiene

`.github/workflows/ci.yml` runs `next lint` and production build on Node 20 with **placeholder** Supabase env vars — appropriate for compile checks but **not** a security scanner.

---

## 11. Gaps and risks visible from code

| Topic | Observation |
|--------|-------------|
| **`/api/prototype/` routes** | Example: `frontend/src/app/api/prototype/ai-intake/chat/route.ts` forwards user content to Gemini **without an evident session gate** in the handler body reviewed — if deployed publicly, this could allow **unauthenticated inference spend and data disclosure**. Treat as **dev-only** or add explicit auth + rate limits before production. |
| **Infrastructure narrative drift** | `ProjectDocs/infrastructure.md` emphasizes ECS/RDS/VPC and “Supabase never touches research data”; actual repo couples research Postgres **to Supabase** and documents Edge Functions for AI. Align sales/engineering collateral with deployed topology. |
| **`README.md` trust bullets** | Claims such as “SOC 2 ready · HIPAA aligned · US data residency” are **not proven by repository contents** — they require governance artifacts and hosting contracts. When PHI is stored only on **HIPAA-eligible AWS services** under a designated **HIPAA Account**, customers typically rely on AWS’s **Business Associate Addendum** (see `AWS+Business+Associate+Addendum.pdf` and **§13.1**). |
| **S3 encryption headers** | Application code does not mandate SSE-KMS per object — rely on bucket policy/defaults and organizational verification. Under the AWS BAA (§4.3.1), **you** must encrypt PHI stored in or transmitted using the Services per **HHS breach-notification guidance** on rendering PHI unusable to unauthorized persons. |

---

## 12. FERPA (Family Educational Rights and Privacy Act) — how the codebase relates

FERPA protects **education records** held by educational agencies/institutions. An IRB platform may process records that qualify depending on **who operates the system**, **what identifiers attach**, and **whether records relate to students**.

**Technical measures in code that support common FERPA program expectations**

- **Minimum necessary inside the institution:** RLS limits cross-institution visibility; role policies separate PI vs. reviewer vs. admin surfaces.  
- **Draft confidentiality:** Administrative staff are excluded from PI drafts pre-submission per migration `010` (supports limiting premature disclosure).  
- **Access accountability:** `audit_log` captures multiple workflow actions when combined with server/Edge inserts and submission triggers.  
- **Document disclosure minimization:** Downloads use **short-lived presigned URLs** rather than static public links.  

**What the codebase does not decide**

- Whether Arbiter acts as a **school official**, **processor**, or other category under institutional policy  
- **Parental consent** pathways, **directory information** elections, or **consent to disclose**  
- **Subprocessor agreements** with Supabase, AWS, Google, Vercel, etc., for education-record handling  

**Suggested client-facing framing (grounded):** The platform provides **tenant isolation, RBAC, MFA-gated dashboard entry (when configured), audit events, and private document handling patterns**; institutional counsel determines whether specific deployments satisfy FERPA for their record types and subprocessors.

---

## 13. HIPAA (Health Insurance Portability and Accountability Act) — how the codebase relates

HIPAA applies when a **covered entity** or **business associate** handles **PHI** on behalf of regulated workflows. IRB submissions **may** contain PHI (e.g., clinical protocol details), but **many IRB records are not PHI** as defined under HIPAA.

**Engineering controls evidenced in code**

- Strong emphasis on **authenticated APIs**, **RBAC**, **RLS**, **private storage URLs**, and **separation of upload privileges** (PI-owned uploads).  
- `ProjectDocs/infrastructure.md` includes an explicit **AWS HIPAA checklist** (BAA, KMS, RDS encryption, CloudTrail, MFA, Secret Manager discipline) — these are **deployment tasks**, not guarantees from this repo.  

**Gaps relative to typical HIPAA programs**

- No application-layer **PHI labeling**, **minimum necessary** workflows beyond RBAC, or **automatic DLP** appear in code.  
- **AI subprocessors** (Gemini HTTP API) require **vendor BAAs / HIPAA eligibility** and architecture choices (e.g., Vertex AI with approved configurations) — **not encoded here.**  

### 13.1 AWS Business Associate Addendum — summary (`AWS+Business+Associate+Addendum.pdf`)

The PDF in this repo is Amazon Web Services, Inc.’s **AWS Business Associate Addendum (Online)** (**Doc #3256920v3**, **2023-01-20**). It forms an addendum to the **AWS Customer Agreement** (or other AWS agreement governing use of Services) and takes effect on the **Addendum Effective Date** when the customer accepts it through **AWS Artifact** (or successor). The following bullets **paraphrase** the instrument for procurement/engineering alignment; the PDF controls if anything differs.

| Topic | What the addendum states (paraphrased) |
|--------|----------------------------------------|
| **Scope** | Applies **only** to the **HIPAA Account**: the account used to accept the addendum in Artifact **and** identified per §4.1 **and** that uses **only HIPAA Eligible Services** (alone or combined) to store or transmit PHI **and** has AWS-required security configurations (§1). Other accounts are **not** covered; separate acceptance or **AWS Organizations** BAA may be needed for additional accounts (§3.1). |
| **HIPAA Eligible Services** | Defined solely by AWS’s published list at `https://aws.amazon.com/compliance/hipaa-eligible-services-reference` (and successors), including any required security configurations posted there. AWS commits to **≥6 months’ notice** before removing an existing service or functionality from that list, subject to exceptions (emergency, IP/legal, etc.) (§1). |
| **AWS duties** | Use/disclose PHI only as permitted by the addendum or law (§3.2). Implement **reasonable and appropriate safeguards** consistent with **45 C.F.R. Part 164, Subpart C** for electronic PHI, as reflected in the Agreement (§3.3). Report impermissible uses/disclosures AWS becomes aware of (§3.4.1). Report **Security Incidents** involving PHI **at least quarterly** when there is **successful** unauthorized access/use/disclosure/modification/destruction or interference risking confidentiality, integrity, or availability; **no separate notice** for unsuccessful attempts (e.g., port scans, failed logins, encrypted interception without key compromise) (§3.4.2). Report **Breaches** of **Unsecured PHI** within **60 calendar days** of discovery where required by **45 C.F.R. §164.410** (§3.4.3). Flow HIPAA-equivalent obligations to subcontractors handling PHI (§3.5). Support **access**, **amendment**, and **accounting of disclosures** obligations as described (§3.6–3.8). AWS notes it **cannot** typically identify which individuals or PHI types are in customer content for breach/accounting detail — **you** identify affected individuals and describe PHI types when needed (§3.4, §3.8). |
| **Your duties** | Implement safeguards for PHI (§4.2). **Do not** place PHI in Services that are **not** HIPAA Eligible (§4.2(a)). Use the **highest level of audit logging** and **maximum log retention** for **all** HIPAA Eligible Services you use (§4.2(b)–(c)). Configure encryption so PHI at rest/in transit meets **HHS guidance** on rendering PHI unusable/unreadable to unauthorized persons (`http://www.hhs.gov/ocr/privacy/hipaa/administrative/breachnotificationrule/brguidance.html`, successor URLs) (§4.3.1). Warrant necessary **authorizations/consents** before placing Customer Content (including PHI) on AWS (§4.4). Do not cause AWS to violate HIPAA or the addendum (§4.6). |
| **Termination** | Either party may terminate per §5.2. On termination, AWS will return/destroy PHI if feasible; parties **acknowledge** return/destruction is **not feasible** in practice for AWS’s retained PHI, so protections extend and uses/disclosures narrow per §5.3. |
| **Nondisclosure** | You agree the addendum terms are **not publicly known** and constitute **AWS Confidential Information** under the Agreement (§7). |

**How this relates to Arbiter’s codebase:** Features such as **S3 uploads/downloads** and **Cognito MFA** sit on AWS services that institutions typically evaluate against the **HIPAA Eligible Services** list and configure per §4. **Supabase, Vercel, Google Gemini,** and other non-AWS components are **outside** this AWS BAA unless separately contracted — a production HIPAA posture usually requires a **service-by-service** eligibility and DPA/BAA matrix.

**Suggested client-facing framing:** HIPAA readiness is a **program**: encryption, logging, breach procedures, BAAs, workforce training, and subprocessors. The codebase supplies **access-control and audit primitives** that commonly appear in HIPAA-aligned SaaS; **AWS’s standard online BAA** (as summarized above) addresses AWS’s BA obligations **only for the designated HIPAA Account and HIPAA Eligible Services**. It **does not replace** a formal HIPAA risk analysis or agreements with other vendors.

---

## 14. Summary table for procurement conversations

| Control area | Evidence in codebase | Typical institutional follow-up |
|--------------|----------------------|----------------------------------|
| Tenant isolation | RLS on institutions/users/proposals/documents/messages | Verify Supabase project config + region |
| RBAC | SQL policies + TS helpers (`requireAdminSession`, proposal access checks) | Map institution HR roles to app roles |
| MFA | Cognito TOTP flow + middleware cookie gate | Enforce pool/App MFA policies + monitoring |
| Audit trail | `audit_log` + triggers + API/Edge inserts | Export/SIEM retention; for AWS HIPAA Eligible Services, AWS BAA §4.2(b)–(c) expects **highest audit logging** and **maximum log retention** |
| File security | Server-side S3 upload/download + presigned GET | Bucket policies, KMS, antivirus/DLP |
| AI disclosure | Gemini calls from Edge/API routes | Subprocessor DPAs, data residency, disable paths |

---

## 15. Disclaimer

This document summarizes **observations from source code and repository documentation**. The **`AWS+Business+Associate+Addendum.pdf`** copy included here is a **reference artifact only**; binding rights and obligations arise from the **executed** AWS Customer Agreement (or successor) and **your acceptance** of the current AWS BAA for each **HIPAA Account** in **AWS Artifact** — not from this report. It is **not legal advice**, **not a HIPAA security risk analysis**, and **not a certification** of SOC 2, FERPA, HIPAA, or IRB regulatory compliance. Institutions should involve counsel, security/compliance officers, and vendor risk teams when evaluating production deployment.

---

## Appendix — Key file references

| Area | Path |
|------|------|
| Middleware / MFA gate | `frontend/src/middleware.ts` |
| MFA cookie issuance | `frontend/src/app/api/mfa/complete/route.ts` |
| Core RLS | `supabase/migrations/001_rls_policies.sql` |
| Draft admin exclusion | `supabase/migrations/010_admin_cannot_access_draft_proposals.sql` |
| Reviewer scope & audit visibility | `supabase/migrations/013_reviewer_institution_staff_access.sql`, `014_reviewer_scope_inbox_and_admin_only.sql` |
| Submission audit trigger | `supabase/migrations/007_audit_log_proposal_submissions.sql` |
| Document upload/download | `frontend/src/app/api/proposals/[id]/upload-document/route.ts`, `.../download/route.ts` |
| S3 helpers | `frontend/src/lib/s3-server.ts` |
| Privacy policy (product) | `frontend/src/app/privacy/page.tsx` |
| Infra/compliance checklist (aspirational) | `ProjectDocs/infrastructure.md` |
| AI summarization Edge Function | `supabase/functions/summarize/index.ts` |
| AWS HIPAA Business Associate Addendum (reference) | `AWS+Business+Associate+Addendum.pdf` |

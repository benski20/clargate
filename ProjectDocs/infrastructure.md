# Arbiter — Infrastructure & Compliance Overview

## Stack

| Layer | Service |
|-------|---------|
| Frontend | Vercel |
| Auth | Supabase (SSO, MFA, JWT) |
| API / Backend | AWS ECS (Fargate) inside VPC |
| Database | AWS RDS inside VPC |
| Document Storage | AWS S3 inside VPC |
| Secrets | AWS Secrets Manager |
| Encryption | AWS KMS |
| Logging | AWS CloudTrail + CloudWatch |

---

## How It Fits Together

```
User → Vercel (frontend)
          │
          ▼
    Supabase Auth  ──── issues JWT
          │
          ▼
    AWS ALB (public subnet)  ◄── JWT validated here
          │
          ▼
    AWS VPC (private)
    ┌─────────────────────┐
    │  ECS (app layer)    │
    │       │             │
    │  RDS (Postgres)     │
    │       │             │
    │  S3 (documents)     │
    └─────────────────────┘
```

Vercel serves the frontend. Supabase handles login, MFA, and SSO. Once authenticated, the JWT is sent with every request to your AWS backend — ECS validates it, then all data access happens entirely inside the VPC.

**The hard rule**: Supabase never touches research data or PHI. It owns identity only.

---

## VPC Design

Everything sensitive lives in private subnets — no direct internet access.

| Subnet | What Lives Here | Internet |
|--------|----------------|---------|
| Public | ALB (load balancer) only | Yes — ingress only |
| Private — App | ECS tasks (your API) | No — outbound via NAT |
| Private — Data | RDS + S3 VPC endpoint | No |

**Security groups** enforce the boundaries: ALB → ECS only, ECS → RDS only. Nothing else is reachable.

**VPC Endpoints** for S3, Secrets Manager, and KMS mean traffic to those services never leaves the AWS network.

---

## Proposal uploads to S3 (Next.js API, preferred)

The app uploads files via **`POST /api/proposals/[id]/upload-document`** (see `frontend/src/app/api/proposals/[id]/upload-document/route.ts`). The browser sends the **session cookie**; the Next.js server validates the user, writes to S3 with the **AWS SDK**, and inserts `proposal_documents` using **`SUPABASE_SERVICE_ROLE_KEY`**. No Supabase Edge Function and no `Authorization` header to Edge Functions.

Set these on the **frontend host** (e.g. Vercel environment variables), not in the browser:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; inserts rows and audit log. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM with `s3:PutObject` on the bucket/prefix. |
| `S3_BUCKET_NAME` | Target bucket. |
| `AWS_REGION` or `AWS_DEFAULT_REGION` | Must match the bucket region. |

---

## Supabase Edge Functions (legacy presigned uploads)

The `presign-upload` Edge Function can still generate S3 PUT presigned URLs for other callers. Configure **Project → Edge Functions → Secrets** (or the Supabase CLI `secrets set`) so the function can reach AWS and the database:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Usually injected automatically; confirm if missing. |
| `SUPABASE_ANON_KEY` | JWT validation for `getUser` (often injected). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service client for inserts (often injected). |
| `AWS_ACCESS_KEY_ID` | IAM user or role with `s3:PutObject` on the bucket prefix. |
| `AWS_SECRET_ACCESS_KEY` | Pair for the access key. |
| `S3_BUCKET_NAME` | Target bucket for proposal documents. |
| `AWS_DEFAULT_REGION` | Must match the bucket region (e.g. `us-east-1`). |

Without the AWS variables, presign calls return 500 or the client shows an upload error on the Proposal tab.

---

## Storage & Data


**S3 (documents)**
- All public access blocked
- KMS encryption on every object
- Versioning enabled (supports audit trail + accidental deletion recovery)
- Access via presigned URLs only — no public paths ever

---

## Security Essentials

**Encryption**: KMS customer-managed key applied to RDS, S3, CloudWatch Logs, and Secrets Manager. TLS 1.2+ enforced on all endpoints via AWS Certificate Manager.

**Secrets**: Everything (DB credentials, Anthropic API key, Supabase service key) lives in AWS Secrets Manager. No hardcoded credentials anywhere.

**Audit logging**: Two layers — AWS CloudTrail for infrastructure-level actions, and an `audit_log` table in RDS for application actions (proposal submitted, letter sent, status changed, document uploaded). Log from day one.

**MFA**: Enforced via Supabase Auth for all users. Required for your team's AWS console access too.

**SSO**: Supabase supports SAML 2.0 and OAuth 2.0 — sufficient for university IdPs (Shibboleth, Azure AD, Google Workspace).

---

## Compliance Checklist

- [ ] Supabase project confirmed on `us-east-1` (data residency)
- [ ] AWS region locked to `us-east-1` or `us-west-2`
- [ ] AWS BAA signed (free via AWS Artifact — required for HIPAA)
- [ ] No PHI in Supabase user metadata or JWTs
- [ ] KMS CMK created, rotation enabled
- [ ] RDS encryption at rest enabled
- [ ] S3 public access blocked, KMS encryption on
- [ ] CloudTrail enabled, logs stored in locked S3 bucket
- [ ] MFA enforced for all users (Supabase) and AWS console (IAM)
- [ ] All secrets in Secrets Manager — no `.env` credentials in prod
- [ ] RBAC enforced in application layer — users only access their own data

---

## Build Order

1. **VPC + subnets + security groups** — before any application code
2. **RDS in private subnet** — database up and locked down
3. **S3 bucket** — KMS encryption, public access blocked, presigned URL access
4. **ECS + ALB** — API running in private subnet, JWT validation wired in
5. **Secrets Manager** — all credentials migrated out of environment variables
6. **CloudTrail + audit log table** — logging live from day one

---


---

*March 2026*

# Clargate

AI-powered IRB (Institutional Review Board) platform that replaces fragmented email threads, legacy submission systems, and manual administrative workflows with a single intelligent platform.

## Architecture

- **Frontend**: Next.js 16 (App Router) on Vercel — TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic
- **Database**: PostgreSQL 16 (RDS in production)
- **Auth**: Supabase Auth (SSO/MFA/JWT) — identity only, no PHI
- **AI**: OpenAI GPT-4o (summaries, revision letters, PI assistant)
- **Storage**: AWS S3 (KMS-encrypted, presigned URLs)
- **Infrastructure**: AWS CDK (VPC, ECS Fargate, RDS, S3, KMS, CloudTrail)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### Local Development

```bash
# Start Postgres + MinIO
docker compose up postgres minio createbuckets -d

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # Edit with your Supabase/OpenAI keys
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local   # Edit with your Supabase keys
npm run dev
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

## Project Structure

```
clargate/
├── frontend/          # Next.js app (Vercel)
│   └── src/
│       ├── app/       # App Router pages
│       ├── components/# UI components
│       └── lib/       # API client, auth, types
├── backend/           # FastAPI app (ECS)
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # AI, email, storage
│   │   └── core/      # Config, security, DB
│   └── alembic/       # Database migrations
├── infra/             # AWS CDK stacks
├── ProjectDocs/       # PRD + infrastructure docs
└── docker-compose.yml # Local dev environment
```

## Key Features

- **PI Submission Portal**: Multi-step guided form with AI assistant
- **Admin Dashboard**: AI-generated proposal summaries, reviewer assignment, revision letter drafting
- **Reviewer Portal**: Structured review forms with decision options
- **Unified Messaging**: Per-proposal threads with attachments and reminders
- **Audit Trail**: Tamper-evident, append-only logging of all actions
- **Compliance**: MFA, SSO (SAML/OAuth), RBAC, US data residency, KMS encryption

## Security

- Supabase handles identity only — no PHI stored in Supabase
- All research data in AWS VPC (private subnets)
- KMS customer-managed key for RDS, S3, CloudWatch, Secrets Manager
- TLS 1.2+ on all endpoints
- Append-only audit log enforced by database trigger

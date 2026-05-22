-- Additional metadata fields for AI-extracted certificate details.

alter table public.compliance_certifications
  add column if not exists trainee_name text,
  add column if not exists issued_at date,
  add column if not exists extracted_metadata jsonb;

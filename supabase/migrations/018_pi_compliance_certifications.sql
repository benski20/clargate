-- PI / student compliance training certificates (CITI, HIPAA, etc.).
-- Files live in S3; metadata and access control live here.

create table if not exists public.compliance_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  certification_type text not null
    check (
      certification_type in (
        'citi_human_subjects',
        'hipaa',
        'biosafety',
        'conflict_of_interest',
        'other'
      )
    ),
  title text,
  file_name text not null,
  s3_key text not null,
  mime_type text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  expires_at date,
  uploaded_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_certifications_user_idx
  on public.compliance_certifications (user_id, uploaded_at desc)
  where is_deleted = false;

create index if not exists compliance_certifications_institution_idx
  on public.compliance_certifications (institution_id, user_id)
  where is_deleted = false;

alter table public.compliance_certifications enable row level security;

-- PIs / students: read own active certificates
create policy "PI read own compliance certifications"
  on public.compliance_certifications for select
  using (
    public.current_user_role() = 'pi'
    and user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
    and is_deleted = false
  );

-- PIs / students: upload for themselves
create policy "PI insert own compliance certifications"
  on public.compliance_certifications for insert
  with check (
    public.current_user_role() = 'pi'
    and user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
    and is_deleted = false
  );

-- PIs / students: update own rows (e.g. soft-delete, metadata)
create policy "PI update own compliance certifications"
  on public.compliance_certifications for update
  using (
    public.current_user_role() = 'pi'
    and user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
  )
  with check (
    public.current_user_role() = 'pi'
    and user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
  );

-- Institution admins: read certificates for compliance review
create policy "Admin read institution compliance certifications"
  on public.compliance_certifications for select
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
    and is_deleted = false
  );

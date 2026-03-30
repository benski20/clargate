-- Admin-managed materials that shape PI-facing AI (examples, rules, guidelines, institutional specifics).

create table if not exists public.institution_ai_guidance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  category text not null
    check (category in ('example_proposal', 'rules', 'guidelines', 'institutional')),
  title text,
  content_type text not null check (content_type in ('text', 'file')),
  body_text text,
  file_name text,
  s3_key text,
  mime_type text,
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null
);

create index if not exists institution_ai_guidance_institution_idx
  on public.institution_ai_guidance (institution_id);

create index if not exists institution_ai_guidance_category_idx
  on public.institution_ai_guidance (institution_id, category);

alter table public.institution_ai_guidance enable row level security;

-- PIs and admins: read (for AI server routes and transparency)
create policy "PI and admin read institution AI guidance"
  on public.institution_ai_guidance for select
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('pi', 'admin')
  );

-- Admins only: manage
create policy "Admin insert institution AI guidance"
  on public.institution_ai_guidance for insert
  with check (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

create policy "Admin update institution AI guidance"
  on public.institution_ai_guidance for update
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

create policy "Admin delete institution AI guidance"
  on public.institution_ai_guidance for delete
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

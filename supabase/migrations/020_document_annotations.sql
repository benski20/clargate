create table public.document_annotations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  document_id uuid not null references public.proposal_documents(id) on delete cascade,
  author_user_id uuid not null references public.users(id),
  quoted_text text not null,
  prefix_context text not null default '',
  suffix_context text not null default '',
  body text not null,
  is_resolved boolean not null default false,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.annotation_replies (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references public.document_annotations(id) on delete cascade,
  author_user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.document_annotations enable row level security;
alter table public.annotation_replies enable row level security;

create index idx_document_annotations_document_id on public.document_annotations(document_id);
create index idx_document_annotations_proposal_id on public.document_annotations(proposal_id);
create index idx_annotation_replies_annotation_id on public.annotation_replies(annotation_id);

create policy "Users can view annotations for accessible proposals"
  on public.document_annotations for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = document_annotations.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        public.current_user_role() = 'admin'
        or (public.current_user_role() = 'pi' and p.pi_user_id = public.current_user_id())
        or (public.current_user_role() = 'reviewer' and exists (
          select 1 from public.review_assignments ra
          where ra.proposal_id = p.id
          and ra.reviewer_user_id = public.current_user_id()
        ))
      )
    )
  );

create policy "Admin or assigned reviewer can insert annotations"
  on public.document_annotations for insert
  with check (
    author_user_id = public.current_user_id()
    and public.current_user_role() in ('admin', 'reviewer')
    and exists (
      select 1 from public.proposals p
      where p.id = document_annotations.proposal_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

create policy "Author can update own annotations"
  on public.document_annotations for update
  using (
    author_user_id = public.current_user_id()
    or public.current_user_role() = 'admin'
  );

create policy "Users can view replies for accessible annotations"
  on public.annotation_replies for select
  using (
    exists (
      select 1 from public.document_annotations da
      join public.proposals p on p.id = da.proposal_id
      where da.id = annotation_replies.annotation_id
      and p.institution_id = public.current_user_institution_id()
      and (
        public.current_user_role() = 'admin'
        or (public.current_user_role() = 'pi' and p.pi_user_id = public.current_user_id())
        or (public.current_user_role() = 'reviewer' and exists (
          select 1 from public.review_assignments ra
          where ra.proposal_id = p.id
          and ra.reviewer_user_id = public.current_user_id()
        ))
      )
    )
  );

create policy "Authorized users can insert replies"
  on public.annotation_replies for insert
  with check (
    author_user_id = public.current_user_id()
    and exists (
      select 1 from public.document_annotations da
      join public.proposals p on p.id = da.proposal_id
      where da.id = annotation_replies.annotation_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

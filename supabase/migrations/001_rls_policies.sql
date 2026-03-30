-- Helper: resolve the app-level user row from auth.uid()
create or replace function public.current_user_id()
returns uuid
language sql stable security definer
as $$
  select id from public.users where supabase_uid = auth.uid()::text limit 1;
$$;

create or replace function public.current_user_institution_id()
returns uuid
language sql stable security definer
as $$
  select institution_id from public.users where supabase_uid = auth.uid()::text limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql stable security definer
as $$
  select role::text from public.users where supabase_uid = auth.uid()::text limit 1;
$$;

-- ═══════════════════════════════════════
-- Enable RLS on all tables
-- ═══════════════════════════════════════

alter table public.institutions enable row level security;
alter table public.users enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_documents enable row level security;
alter table public.review_assignments enable row level security;
alter table public.reviews enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.letters enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.audit_log enable row level security;
alter table public.reminders enable row level security;

-- ═══════════════════════════════════════
-- institutions
-- ═══════════════════════════════════════
create policy "Users can view own institution"
  on public.institutions for select
  using (id = public.current_user_institution_id());

-- ═══════════════════════════════════════
-- users
-- ═══════════════════════════════════════
create policy "Users can view users in same institution"
  on public.users for select
  using (institution_id = public.current_user_institution_id());

create policy "Users can update own record"
  on public.users for update
  using (id = public.current_user_id());

-- ═══════════════════════════════════════
-- proposals
-- ═══════════════════════════════════════
create policy "PI can view own proposals"
  on public.proposals for select
  using (
    institution_id = public.current_user_institution_id()
    and (
      public.current_user_role() in ('admin')
      or (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id())
      or (public.current_user_role() = 'reviewer' and exists (
        select 1 from public.review_assignments ra
        where ra.proposal_id = proposals.id
        and ra.reviewer_user_id = public.current_user_id()
      ))
    )
  );

create policy "PI can insert own proposals"
  on public.proposals for insert
  with check (
    pi_user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
  );

create policy "PI can update own draft proposals"
  on public.proposals for update
  using (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id()
        and status in ('draft', 'revisions_requested'))
      or public.current_user_role() = 'admin'
    )
  );

-- ═══════════════════════════════════════
-- proposal_documents
-- ═══════════════════════════════════════
create policy "Users can view documents for accessible proposals"
  on public.proposal_documents for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_documents.proposal_id
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
    and is_deleted = false
  );

-- ═══════════════════════════════════════
-- review_assignments
-- ═══════════════════════════════════════
create policy "Reviewer sees own assignments, admin sees institution"
  on public.review_assignments for select
  using (
    (public.current_user_role() = 'reviewer' and reviewer_user_id = public.current_user_id())
    or (public.current_user_role() = 'admin' and exists (
      select 1 from public.proposals p
      where p.id = review_assignments.proposal_id
      and p.institution_id = public.current_user_institution_id()
    ))
  );

create policy "Reviewer can update own assignment status"
  on public.review_assignments for update
  using (
    reviewer_user_id = public.current_user_id()
    and public.current_user_role() = 'reviewer'
  );

-- ═══════════════════════════════════════
-- reviews
-- ═══════════════════════════════════════
create policy "Reviewer can insert review for own assignment"
  on public.reviews for insert
  with check (
    exists (
      select 1 from public.review_assignments ra
      where ra.id = reviews.assignment_id
      and ra.reviewer_user_id = public.current_user_id()
    )
  );

create policy "Admin sees reviews for institution proposals"
  on public.reviews for select
  using (
    exists (
      select 1 from public.review_assignments ra
      join public.proposals p on p.id = ra.proposal_id
      where ra.id = reviews.assignment_id
      and (
        (public.current_user_role() = 'admin' and p.institution_id = public.current_user_institution_id())
        or ra.reviewer_user_id = public.current_user_id()
      )
    )
  );

-- ═══════════════════════════════════════
-- messages
-- ═══════════════════════════════════════
create policy "Users can view messages for accessible proposals"
  on public.messages for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = messages.proposal_id
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

create policy "Users can insert messages for accessible proposals"
  on public.messages for insert
  with check (
    sender_user_id = public.current_user_id()
    and exists (
      select 1 from public.proposals p
      where p.id = messages.proposal_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

-- ═══════════════════════════════════════
-- message_attachments
-- ═══════════════════════════════════════
create policy "Users can view attachments for accessible messages"
  on public.message_attachments for select
  using (
    exists (
      select 1 from public.messages m
      join public.proposals p on p.id = m.proposal_id
      where m.id = message_attachments.message_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

-- ═══════════════════════════════════════
-- letters
-- ═══════════════════════════════════════
create policy "Admin and PI can view letters"
  on public.letters for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = letters.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        public.current_user_role() = 'admin'
        or (public.current_user_role() = 'pi' and p.pi_user_id = public.current_user_id())
      )
    )
  );

-- ═══════════════════════════════════════
-- ai_summaries
-- ═══════════════════════════════════════
create policy "Admin can view AI summaries"
  on public.ai_summaries for select
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.proposals p
      where p.id = ai_summaries.proposal_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

-- ═══════════════════════════════════════
-- audit_log (read-only for admin)
-- ═══════════════════════════════════════
create policy "Admin can view audit log"
  on public.audit_log for select
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

-- ═══════════════════════════════════════
-- reminders
-- ═══════════════════════════════════════
create policy "Admin can view reminders"
  on public.reminders for select
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.proposals p
      where p.id = reminders.proposal_id
      and p.institution_id = public.current_user_institution_id()
    )
  );

-- ═══════════════════════════════════════
-- Inbox helper function
-- ═══════════════════════════════════════
create or replace function public.get_inbox(p_page int default 1, p_page_size int default 20)
returns table (
  proposal_id uuid,
  proposal_title text,
  last_message_body text,
  last_message_sender_name text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql stable security definer
as $$
  select
    p.id as proposal_id,
    p.title as proposal_title,
    last_msg.body as last_message_body,
    u.full_name as last_message_sender_name,
    last_msg.created_at as last_message_at,
    coalesce(unread.cnt, 0) as unread_count
  from public.proposals p
  inner join lateral (
    select m.body, m.sender_user_id, m.created_at
    from public.messages m
    where m.proposal_id = p.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  left join public.users u on u.id = last_msg.sender_user_id
  left join lateral (
    select count(*) as cnt
    from public.messages m2
    where m2.proposal_id = p.id and m2.is_read = false
  ) unread on true
  where p.institution_id = public.current_user_institution_id()
    and public.current_user_role() = 'admin'
  order by last_msg.created_at desc
  offset ((p_page - 1) * p_page_size)
  limit p_page_size;
$$;

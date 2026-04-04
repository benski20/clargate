-- Admins must not see or act on proposals in draft status (PI-only until submitted).

-- Helper used by review_assignments policy: exclude drafts for admin visibility.
create or replace function public.admin_sees_proposal_in_institution(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proposals p
    where p.id = p_proposal_id
      and p.institution_id = public.current_user_institution_id()
      and p.status <> 'draft'
  );
$$;

drop policy if exists "PI can view own proposals" on public.proposals;
create policy "PI can view own proposals"
  on public.proposals for select
  using (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'admin' and status <> 'draft')
      or (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id())
      or (
        public.current_user_role() = 'reviewer'
        and public.reviewer_assigned_to_proposal(id)
      )
    )
  );

drop policy if exists "PI can update own draft proposals" on public.proposals;
create policy "PI can update own draft proposals"
  on public.proposals for update
  using (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id()
        and status in ('draft', 'revisions_requested'))
      or (public.current_user_role() = 'admin' and status <> 'draft')
    )
  )
  with check (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id()
        and status in ('draft', 'revisions_requested', 'submitted', 'resubmitted'))
      or (public.current_user_role() = 'admin' and status <> 'draft')
    )
  );

drop policy if exists "Users can view documents for accessible proposals" on public.proposal_documents;
create policy "Users can view documents for accessible proposals"
  on public.proposal_documents for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_documents.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        (public.current_user_role() = 'admin' and p.status <> 'draft')
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

drop policy if exists "Reviewer sees own assignments, admin sees institution" on public.review_assignments;
create policy "Reviewer sees own assignments, admin sees institution"
  on public.review_assignments for select
  using (
    (public.current_user_role() = 'reviewer' and reviewer_user_id = public.current_user_id())
    or (public.current_user_role() = 'admin' and exists (
      select 1 from public.proposals p
      where p.id = review_assignments.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and p.status <> 'draft'
    ))
  );

drop policy if exists "Admin sees reviews for institution proposals" on public.reviews;
create policy "Admin sees reviews for institution proposals"
  on public.reviews for select
  using (
    exists (
      select 1 from public.review_assignments ra
      join public.proposals p on p.id = ra.proposal_id
      where ra.id = reviews.assignment_id
      and (
        (public.current_user_role() = 'admin'
          and p.institution_id = public.current_user_institution_id()
          and p.status <> 'draft')
        or ra.reviewer_user_id = public.current_user_id()
      )
    )
  );

drop policy if exists "Users can view messages for accessible proposals" on public.messages;
create policy "Users can view messages for accessible proposals"
  on public.messages for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = messages.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        (public.current_user_role() = 'admin' and p.status <> 'draft')
        or (public.current_user_role() = 'pi' and p.pi_user_id = public.current_user_id())
        or (public.current_user_role() = 'reviewer' and exists (
          select 1 from public.review_assignments ra
          where ra.proposal_id = p.id
          and ra.reviewer_user_id = public.current_user_id()
        ))
      )
    )
  );

drop policy if exists "Users can insert messages for accessible proposals" on public.messages;
create policy "Users can insert messages for accessible proposals"
  on public.messages for insert
  with check (
    sender_user_id = public.current_user_id()
    and exists (
      select 1 from public.proposals p
      where p.id = messages.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        public.current_user_role() <> 'admin'
        or p.status <> 'draft'
      )
    )
  );

drop policy if exists "Users can view attachments for accessible messages" on public.message_attachments;
create policy "Users can view attachments for accessible messages"
  on public.message_attachments for select
  using (
    exists (
      select 1 from public.messages m
      join public.proposals p on p.id = m.proposal_id
      where m.id = message_attachments.message_id
      and p.institution_id = public.current_user_institution_id()
      and (
        public.current_user_role() <> 'admin'
        or p.status <> 'draft'
      )
    )
  );

drop policy if exists "Admin and PI can view letters" on public.letters;
create policy "Admin and PI can view letters"
  on public.letters for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = letters.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and (
        (public.current_user_role() = 'admin' and p.status <> 'draft')
        or (public.current_user_role() = 'pi' and p.pi_user_id = public.current_user_id())
      )
    )
  );

drop policy if exists "Admin can view AI summaries" on public.ai_summaries;
create policy "Admin can view AI summaries"
  on public.ai_summaries for select
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.proposals p
      where p.id = ai_summaries.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and p.status <> 'draft'
    )
  );

drop policy if exists "Admin can view reminders" on public.reminders;
create policy "Admin can view reminders"
  on public.reminders for select
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.proposals p
      where p.id = reminders.proposal_id
      and p.institution_id = public.current_user_institution_id()
      and p.status <> 'draft'
    )
  );

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
    and p.status <> 'draft'
  order by last_msg.created_at desc
  offset ((p_page - 1) * p_page_size)
  limit p_page_size;
$$;

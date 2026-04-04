-- Reviewers: inbox threads only for assigned proposals; no audit log; no signup code or
-- institution guidance writes; admin-only where appropriate.

-- ═══════════════════════════════════════
-- audit_log (admin only)
-- ═══════════════════════════════════════
drop policy if exists "Admin can view audit log" on public.audit_log;
create policy "Admin can view audit log"
  on public.audit_log for select
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

-- ═══════════════════════════════════════
-- institution_ai_guidance (writes — admin only)
-- ═══════════════════════════════════════
drop policy if exists "Admin insert institution AI guidance" on public.institution_ai_guidance;
create policy "Admin insert institution AI guidance"
  on public.institution_ai_guidance for insert
  with check (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

drop policy if exists "Admin update institution AI guidance" on public.institution_ai_guidance;
create policy "Admin update institution AI guidance"
  on public.institution_ai_guidance for update
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

drop policy if exists "Admin delete institution AI guidance" on public.institution_ai_guidance;
create policy "Admin delete institution AI guidance"
  on public.institution_ai_guidance for delete
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

-- ═══════════════════════════════════════
-- signup_codes (admin only)
-- ═══════════════════════════════════════
drop policy if exists "Admins select signup codes for their institution" on public.signup_codes;
create policy "Admins select signup codes for their institution"
  on public.signup_codes for select
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

drop policy if exists "Admins insert signup codes for their institution" on public.signup_codes;
create policy "Admins insert signup codes for their institution"
  on public.signup_codes for insert
  with check (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
    and created_by_user_id = public.current_user_id()
  );

-- ═══════════════════════════════════════
-- Inbox RPC: reviewer sees only assigned proposals with threads
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
    and (
      (
        public.current_user_role() = 'admin'
        and p.status <> 'draft'
      )
      or (
        public.current_user_role() = 'reviewer'
        and exists (
          select 1 from public.review_assignments ra
          where ra.proposal_id = p.id
          and ra.reviewer_user_id = public.current_user_id()
        )
      )
      or (
        public.current_user_role() = 'pi'
        and p.pi_user_id = public.current_user_id()
      )
    )
  order by last_msg.created_at desc
  offset ((p_page - 1) * p_page_size)
  limit p_page_size;
$$;

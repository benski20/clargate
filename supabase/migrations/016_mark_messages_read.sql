-- Unread counts: only messages from *others* that the current user has not read.
-- mark_proposal_messages_read: set is_read on incoming messages when the viewer opens the thread.

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
set search_path = public
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
    where m2.proposal_id = p.id
      and m2.is_read = false
      and m2.sender_user_id <> public.current_user_id()
  ) unread on true
  where p.institution_id = public.current_user_institution_id()
    and (
      (
        public.current_user_role() in ('admin', 'reviewer')
        and p.status <> 'draft'
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

create or replace function public.mark_proposal_messages_read(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages m
  set is_read = true
  where m.proposal_id = p_proposal_id
    and m.sender_user_id <> public.current_user_id()
    and m.is_read = false
    and exists (
      select 1
      from public.proposals p
      where p.id = m.proposal_id
        and p.institution_id = public.current_user_institution_id()
        and (
          (
            public.current_user_role() = 'pi'
            and p.pi_user_id = public.current_user_id()
          )
          or (
            public.current_user_role() = 'admin'
            and p.status <> 'draft'
          )
          or (
            public.current_user_role() = 'reviewer'
            and exists (
              select 1
              from public.review_assignments ra
              where ra.proposal_id = p.id
                and ra.reviewer_user_id = public.current_user_id()
            )
          )
        )
    );
end;
$$;

grant execute on function public.mark_proposal_messages_read(uuid) to authenticated;

-- Total unread incoming messages across all threads visible in get_inbox (same scope as inbox list).

create or replace function public.get_inbox_unread_total()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(unread.cnt, 0)), 0)::bigint
  from public.proposals p
  left join lateral (
    select count(*)::bigint as cnt
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
    );
$$;

grant execute on function public.get_inbox_unread_total() to authenticated;

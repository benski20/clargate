-- Fix 42P17 "infinite recursion detected in policy for relation proposals"
-- Cause: proposals SELECT policy subqueries review_assignments; review_assignments SELECT
-- subqueries proposals — mutual RLS re-entry.
-- Fix: SECURITY DEFINER helpers that read those tables without re-applying RLS.

create or replace function public.reviewer_assigned_to_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.review_assignments ra
    where ra.proposal_id = p_proposal_id
      and ra.reviewer_user_id = public.current_user_id()
  );
$$;

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
  );
$$;

drop policy if exists "PI can view own proposals" on public.proposals;
create policy "PI can view own proposals"
  on public.proposals for select
  using (
    institution_id = public.current_user_institution_id()
    and (
      public.current_user_role() in ('admin')
      or (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id())
      or (
        public.current_user_role() = 'reviewer'
        and public.reviewer_assigned_to_proposal(id)
      )
    )
  );

drop policy if exists "Reviewer sees own assignments, admin sees institution" on public.review_assignments;
create policy "Reviewer sees own assignments, admin sees institution"
  on public.review_assignments for select
  using (
    (public.current_user_role() = 'reviewer' and reviewer_user_id = public.current_user_id())
    or (
      public.current_user_role() = 'admin'
      and public.admin_sees_proposal_in_institution(proposal_id)
    )
  );

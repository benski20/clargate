-- PI could update drafts but could not set status to submitted: UPDATE with no WITH CHECK
-- defaults to USING on the *new* row, so status = 'submitted' failed the draft/revisions check.
-- Explicit WITH CHECK allows PI-owned rows to transition to submitted / resubmitted.

drop policy if exists "PI can update own draft proposals" on public.proposals;

create policy "PI can update own draft proposals"
  on public.proposals for update
  using (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id()
        and status in ('draft', 'revisions_requested'))
      or public.current_user_role() = 'admin'
    )
  )
  with check (
    institution_id = public.current_user_institution_id()
    and (
      (public.current_user_role() = 'pi' and pi_user_id = public.current_user_id()
        and status in ('draft', 'revisions_requested', 'submitted', 'resubmitted'))
      or public.current_user_role() = 'admin'
    )
  );

-- Only principal investigators may create proposals; admins cannot create proposals on behalf of the institution.

drop policy if exists "PI can insert own proposals" on public.proposals;

create policy "PI can insert own proposals"
  on public.proposals for insert
  with check (
    public.current_user_role() = 'pi'
    and pi_user_id = public.current_user_id()
    and institution_id = public.current_user_institution_id()
  );

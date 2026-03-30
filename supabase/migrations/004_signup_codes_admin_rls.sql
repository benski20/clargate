-- Let institution admins create and list signup codes from the app (Postgres + RLS only; no Edge Function).

create policy "Admins select signup codes for their institution"
  on public.signup_codes for select
  using (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
  );

create policy "Admins insert signup codes for their institution"
  on public.signup_codes for insert
  with check (
    public.current_user_role() = 'admin'
    and institution_id = public.current_user_institution_id()
    and created_by_user_id = public.current_user_id()
  );

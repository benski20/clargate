-- Reviewers read the same institution guidance as PIs (dashboard “Learn about your institution”).

drop policy if exists "PI and admin read institution AI guidance" on public.institution_ai_guidance;

create policy "PI admin and reviewer read institution AI guidance"
  on public.institution_ai_guidance for select
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('pi', 'admin', 'reviewer')
  );

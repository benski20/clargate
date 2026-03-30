-- Public validation for institutional signup codes (no Edge Function / no JWT).
-- Call from the signup page with the anon key only.

create or replace function public.validate_signup_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.signup_codes%rowtype;
  inst_name text;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('valid', false, 'error', 'missing_code');
  end if;

  select * into rec
  from public.signup_codes
  where upper(trim(code)) = upper(trim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'error', 'invalid_code');
  end if;

  if rec.expires_at is not null and rec.expires_at < now() then
    return jsonb_build_object('valid', false, 'error', 'expired');
  end if;

  if rec.max_uses is not null and rec.uses_count >= rec.max_uses then
    return jsonb_build_object('valid', false, 'error', 'exhausted');
  end if;

  select name into inst_name
  from public.institutions
  where id = rec.institution_id;

  return jsonb_build_object(
    'valid', true,
    'role', rec.role,
    'label', rec.label,
    'institution_name', coalesce(inst_name, 'Your institution')
  );
end;
$$;

grant execute on function public.validate_signup_code(text) to anon;
grant execute on function public.validate_signup_code(text) to authenticated;

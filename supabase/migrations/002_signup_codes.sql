-- Institutional signup codes: redeem links auth.users → public.users with institution + role.

create table if not exists public.signup_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  role text not null check (role in ('pi', 'reviewer', 'admin')),
  max_uses int,
  uses_count int not null default 0,
  expires_at timestamptz,
  label text,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.users (id) on delete set null
);

create unique index if not exists signup_codes_code_normalized_idx
  on public.signup_codes (upper(trim(code)));

alter table public.signup_codes enable row level security;

-- No direct client access; Edge Functions use service role.

create or replace function public.redeem_signup_code(p_code text, p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_uid text;
  v_email text;
  rec public.signup_codes%rowtype;
  v_name text;
begin
  if v_auth is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  v_uid := v_auth::text;

  select email into v_email from auth.users where id = v_auth;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'no_email');
  end if;

  select * into rec
  from public.signup_codes
  where upper(trim(code)) = upper(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if rec.expires_at is not null and rec.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if rec.max_uses is not null and rec.uses_count >= rec.max_uses then
    return jsonb_build_object('ok', false, 'error', 'exhausted');
  end if;

  if exists (select 1 from public.users where supabase_uid = v_uid) then
    return jsonb_build_object('ok', true, 'already_redeemed', true);
  end if;

  if exists (
    select 1 from public.users
    where institution_id = rec.institution_id
      and lower(email) = lower(v_email)
      and supabase_uid is distinct from v_uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'email_in_use');
  end if;

  v_name := coalesce(nullif(trim(p_full_name), ''), split_part(v_email, '@', 1));

  insert into public.users (supabase_uid, institution_id, email, full_name, role, is_active)
  values (
    v_uid,
    rec.institution_id,
    v_email,
    v_name,
    rec.role::public.user_role,
    true
  );

  update public.signup_codes
  set uses_count = uses_count + 1
  where id = rec.id;

  return jsonb_build_object(
    'ok', true,
    'role', rec.role,
    'institution_id', rec.institution_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
end;
$$;

grant execute on function public.redeem_signup_code(text, text) to authenticated;

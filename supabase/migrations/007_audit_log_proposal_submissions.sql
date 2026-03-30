-- Log PI-driven proposal submissions with explicit submitted_at and title in audit metadata.

create or replace function public.audit_log_proposal_submission()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if tg_op = 'update'
     and new.status in ('submitted', 'resubmitted')
     and old.status is distinct from new.status
     and new.submitted_at is not null
  then
    v_actor := coalesce(public.current_user_id(), new.pi_user_id);

    insert into public.audit_log (
      institution_id,
      user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      new.institution_id,
      v_actor,
      case when new.status = 'submitted' then 'proposal_submitted' else 'proposal_resubmitted' end,
      'proposal',
      new.id,
      jsonb_build_object(
        'proposal_title', new.title,
        'submitted_at', new.submitted_at,
        'previous_status', old.status::text,
        'new_status', new.status::text
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_log_proposal_submission on public.proposals;

create trigger audit_log_proposal_submission
  after update on public.proposals
  for each row
  execute procedure public.audit_log_proposal_submission();

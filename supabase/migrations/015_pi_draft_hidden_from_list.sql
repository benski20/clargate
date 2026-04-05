-- PI "delete draft" from My proposals: hide row without deleting (soft hide).
alter table public.proposals
  add column if not exists hidden_from_pi_at timestamptz null;

comment on column public.proposals.hidden_from_pi_at is
  'When set, draft is hidden from the PI proposal list; row and data remain in the database.';

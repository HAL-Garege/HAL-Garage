alter table public.club_benefits
  add column if not exists usage_control boolean not null default false;

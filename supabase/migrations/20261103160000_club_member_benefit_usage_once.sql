create table if not exists public.club_member_benefit_usage (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  benefit_id uuid not null references public.club_benefits(id) on delete cascade,
  used_at timestamptz not null default now(),
  used_by uuid references auth.users(id),
  unique (member_id, benefit_id)
);

alter table public.club_member_benefit_usage enable row level security;
grant select, insert on public.club_member_benefit_usage to authenticated;

create policy club_member_benefit_usage_self_select
on public.club_member_benefit_usage for select to authenticated
using (exists (
  select 1 from public.club_members m
  where m.id = member_id and m.auth_user_id = (select auth.uid())
));

create policy club_member_benefit_usage_staff_select
on public.club_member_benefit_usage for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.active = true
    and p.role = any (array['admin','supervisor','operator'])
));

create policy club_member_benefit_usage_staff_insert
on public.club_member_benefit_usage for insert to authenticated
with check (
  used_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active = true
      and p.role = any (array['admin','supervisor','operator'])
  )
);

drop policy if exists club_member_benefit_usage_staff_insert on public.club_member_benefit_usage;

create policy club_member_benefit_usage_admin_insert
on public.club_member_benefit_usage
for insert
to authenticated
with check (
  used_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role = 'admin'
  )
);

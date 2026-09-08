create table if not exists public.club_point_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  multiplier integer not null default 1 check (multiplier >= 1 and multiplier <= 10),
  starts_at date not null,
  ends_at date not null,
  weekdays integer[] not null default '{}',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (weekdays <@ array[0,1,2,3,4,5,6]::integer[])
);

create unique index if not exists club_point_campaigns_exact_uq
  on public.club_point_campaigns (lower(name), starts_at, ends_at, multiplier, weekdays);

alter table public.club_point_campaigns enable row level security;

create policy "club_point_campaigns_staff_select"
  on public.club_point_campaigns for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','supervisor','operator')));

create policy "club_point_campaigns_admin_manage"
  on public.club_point_campaigns for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin'))
  with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin'));

create or replace function public.award_club_points_for_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record; c record; m record;
  pts integer; base_pts integer; multiplier integer := 1;
  already boolean; sale_day integer;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','supervisor','operator')) then raise exception 'No autorizado'; end if;

  select id, client_id, total, status, sale_number, created_at into s from public.sales where id=p_sale_id limit 1;
  if not found or s.status <> 'confirmed' then return jsonb_build_object('awarded_points',0,'reason','sale_not_confirmed'); end if;

  base_pts := greatest(0, floor(coalesce(s.total,0))::integer);
  if base_pts <= 0 then return jsonb_build_object('awarded_points',0,'reason','zero_points'); end if;

  sale_day := extract(dow from (s.created_at at time zone 'America/Lima'))::integer;
  select coalesce(max(pc.multiplier),1) into multiplier
  from public.club_point_campaigns pc
  where pc.active=true
    and (s.created_at at time zone 'America/Lima')::date between pc.starts_at and pc.ends_at
    and (cardinality(pc.weekdays)=0 or sale_day = any(pc.weekdays));
  pts := base_pts * multiplier;

  select cc.id, cc.full_name, cc.phone, cc.dni into c
  from public.clients cl join public.club_customers cc on (
    (nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null and nullif(regexp_replace(coalesce(cc.phone,''),'\\D','','g'),'') = regexp_replace(cl.phone,'\\D','','g'))
    or (nullif(trim(cl.dni),'') is not null and nullif(trim(cc.dni),'') = trim(cl.dni))
    or (lower(trim(regexp_replace(coalesce(cl.full_name,''),'\\s+',' ','g'))) = lower(trim(regexp_replace(coalesce(cc.full_name,''),'\\s+',' ','g'))) and nullif(trim(cl.full_name),'') is not null)
  )
  where cl.id=s.client_id and cc.active=true
  order by case
    when nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null and nullif(regexp_replace(coalesce(cc.phone,''),'\\D','','g'),'') = regexp_replace(cl.phone,'\\D','','g') then 1
    when nullif(trim(cl.dni),'') is not null and nullif(trim(cc.dni),'') = trim(cl.dni) then 2
    else 3 end, cc.created_at desc limit 1;
  if not found then return jsonb_build_object('awarded_points',0,'reason','club_customer_not_found'); end if;

  select id, points_balance into m from public.club_members where customer_id=c.id and active=true order by created_at desc limit 1;
  if not found then return jsonb_build_object('awarded_points',0,'reason','club_member_not_found'); end if;

  select exists(select 1 from public.club_point_transactions t where t.reference_id=s.id and t.transaction_type='EARN') into already;
  if already then return jsonb_build_object('awarded_points',0,'reason','already_awarded','member_id',m.id); end if;

  insert into public.club_point_transactions(member_id,points,transaction_type,reference_id,description)
  values (m.id,pts,'EARN',s.id,'Puntos por venta HAL Garage #'||s.sale_number::text||case when multiplier>1 then ' · campaña x'||multiplier else '' end);
  update public.club_members set points_balance=coalesce(points_balance,0)+pts, updated_at=now() where id=m.id;
  return jsonb_build_object('awarded_points',pts,'base_points',base_pts,'multiplier',multiplier,'member_id',m.id,'customer_id',c.id);
end;
$$;

grant execute on function public.award_club_points_for_sale(uuid) to authenticated;

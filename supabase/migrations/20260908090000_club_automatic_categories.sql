-- HAL Garage Club: automatic categories based on real spend + visit activity.
-- Baseline: confirmed sales from 2026-03-01 onward.
-- Spend bands: BRONCE 0-200, PLATA 201-400, ORO 401-600, VIP 601+.
-- Points and campaign multipliers never affect category.
-- At least one confirmed visit in the current calendar month enables an upgrade.
-- Without a current-month visit, recalculation can reduce an existing category by one level.

create or replace function public.refresh_club_member_category(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  c record;
  total_spend numeric := 0;
  visit_count integer := 0;
  current_month_visits integer := 0;
  spend_category text := 'BRONCE';
  final_category text := 'BRONCE';
  old_category text;
  customer_phone text;
  customer_dni text;
  customer_name text;
begin
  select cm.id, cm.customer_id, cm.category into m
  from public.club_members cm
  where cm.id = p_member_id and cm.active = true
  limit 1;
  if not found then return jsonb_build_object('updated',false,'reason','member_not_found'); end if;

  old_category := coalesce(m.category,'BRONCE');
  select cc.id, cc.phone, cc.dni, cc.full_name into c
  from public.club_customers cc where cc.id = m.customer_id limit 1;
  if not found then return jsonb_build_object('updated',false,'reason','customer_not_found'); end if;

  customer_phone := nullif(regexp_replace(coalesce(c.phone,''),'\\D','','g'),'');
  customer_dni := nullif(trim(c.dni),'');
  customer_name := nullif(lower(trim(regexp_replace(coalesce(c.full_name,''),'\\s+',' ','g'))),'');

  select coalesce(sum(s.total),0), count(*)::integer,
    count(*) filter (where date_trunc('month',s.created_at at time zone 'America/Lima') = date_trunc('month',now() at time zone 'America/Lima'))::integer
  into total_spend, visit_count, current_month_visits
  from public.sales s join public.clients cl on cl.id=s.client_id
  where s.status='confirmed'
    and (s.created_at at time zone 'America/Lima')::date >= date '2026-03-01'
    and (
      (customer_phone is not null and nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'')=customer_phone)
      or (customer_dni is not null and nullif(trim(cl.dni),'')=customer_dni)
      or (customer_name is not null and lower(trim(regexp_replace(coalesce(cl.full_name,''),'\\s+',' ','g')))=customer_name)
    );

  if total_spend > 600 then spend_category:='VIP';
  elsif total_spend > 400 then spend_category:='ORO';
  elsif total_spend > 200 then spend_category:='PLATA';
  else spend_category:='BRONCE'; end if;

  if current_month_visits > 0 then
    final_category := spend_category;
  else
    if old_category='VIP' then final_category := 'ORO';
    elsif old_category='ORO' then final_category := 'PLATA';
    elsif old_category='PLATA' then final_category := 'BRONCE';
    else final_category := 'BRONCE'; end if;
  end if;

  update public.club_members set category=final_category, updated_at=now() where id=m.id;
  return jsonb_build_object('updated',true,'member_id',m.id,'old_category',old_category,'category',final_category,'total_spend',round(total_spend,2),'visits_since_2026_03_01',visit_count,'current_month_visits',current_month_visits);
end;
$$;

revoke execute on function public.refresh_club_member_category(uuid) from public;
grant execute on function public.refresh_club_member_category(uuid) to authenticated;

create or replace function public.refresh_my_club_category()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare mid uuid;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  select cm.id into mid from public.club_members cm
  where cm.auth_user_id=auth.uid() and cm.active=true
  order by cm.created_at desc limit 1;
  if mid is null then return jsonb_build_object('updated',false,'reason','member_not_found'); end if;
  return public.refresh_club_member_category(mid);
end;
$$;
revoke execute on function public.refresh_my_club_category() from public;
grant execute on function public.refresh_my_club_category() to authenticated;

create or replace function public.refresh_all_club_categories()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','supervisor')) then raise exception 'No autorizado'; end if;
  for r in select id from public.club_members where active=true loop
    perform public.refresh_club_member_category(r.id); n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.refresh_all_club_categories() from public;
grant execute on function public.refresh_all_club_categories() to authenticated;

create or replace function public.refresh_category_after_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare cmid uuid; cl record;
begin
  if new.status <> 'confirmed' then return new; end if;
  select phone,dni,full_name into cl from public.clients where id=new.client_id limit 1;
  if not found then return new; end if;
  select cm.id into cmid
  from public.club_members cm join public.club_customers cc2 on cc2.id=cm.customer_id
  where cm.active=true and cc2.active=true and (
    (nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null and nullif(regexp_replace(coalesce(cc2.phone,''),'\\D','','g'),'')=regexp_replace(cl.phone,'\\D','','g'))
    or (nullif(trim(cl.dni),'') is not null and nullif(trim(cc2.dni),'')=trim(cl.dni))
    or (nullif(trim(cl.full_name),'') is not null and lower(trim(regexp_replace(coalesce(cl.full_name,''),'\\s+',' ','g')))=lower(trim(regexp_replace(coalesce(cc2.full_name,''),'\\s+',' ','g'))))
  )
  order by case
    when nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null and nullif(regexp_replace(coalesce(cc2.phone,''),'\\D','','g'),'')=regexp_replace(cl.phone,'\\D','','g') then 1
    when nullif(trim(cl.dni),'') is not null and nullif(trim(cc2.dni),'')=trim(cl.dni) then 2 else 3 end,
    cm.created_at desc limit 1;
  if cmid is not null then perform public.refresh_club_member_category(cmid); end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_club_category_after_sale on public.sales;
create trigger trg_refresh_club_category_after_sale
after insert or update of status on public.sales
for each row execute function public.refresh_category_after_sale();

-- Initial synchronization for all active Club members.
do $$
declare r record;
begin
  for r in select id from public.club_members where active=true loop
    perform public.refresh_club_member_category(r.id);
  end loop;
end $$;

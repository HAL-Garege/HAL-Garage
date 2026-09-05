create or replace function public.award_club_points_for_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  c record;
  m record;
  pts integer;
  already boolean;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role in ('admin','supervisor','operator')
  ) then
    raise exception 'No autorizado';
  end if;

  select id, client_id, total, status, sale_number
    into s
  from public.sales
  where id = p_sale_id
  limit 1;

  if not found or s.status <> 'confirmed' then
    return jsonb_build_object('awarded_points',0,'reason','sale_not_confirmed');
  end if;

  pts := greatest(0, floor(coalesce(s.total,0))::integer);
  if pts <= 0 then
    return jsonb_build_object('awarded_points',0,'reason','zero_points');
  end if;

  select cc.id, cc.full_name, cc.phone, cc.dni
    into c
  from public.clients cl
  join public.club_customers cc
    on (
      (nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null
       and nullif(regexp_replace(coalesce(cc.phone,''),'\\D','','g'),'') = regexp_replace(cl.phone,'\\D','','g'))
      or
      (nullif(trim(cl.dni),'') is not null and nullif(trim(cc.dni),'') = trim(cl.dni))
      or
      (lower(trim(regexp_replace(coalesce(cl.full_name,''),'\\s+',' ','g'))) = lower(trim(regexp_replace(coalesce(cc.full_name,''),'\\s+',' ','g')))
       and nullif(trim(cl.full_name),'') is not null)
    )
  where cl.id = s.client_id and cc.active = true
  order by
    case
      when nullif(regexp_replace(coalesce(cl.phone,''),'\\D','','g'),'') is not null
       and nullif(regexp_replace(coalesce(cc.phone,''),'\\D','','g'),'') = regexp_replace(cl.phone,'\\D','','g') then 1
      when nullif(trim(cl.dni),'') is not null and nullif(trim(cc.dni),'') = trim(cl.dni) then 2
      else 3
    end,
    cc.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('awarded_points',0,'reason','club_customer_not_found');
  end if;

  select id, points_balance
    into m
  from public.club_members
  where customer_id = c.id and active = true
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('awarded_points',0,'reason','club_member_not_found');
  end if;

  select exists(
    select 1 from public.club_point_transactions t
    where t.reference_id = s.id and t.transaction_type = 'EARN'
  ) into already;

  if already then
    return jsonb_build_object('awarded_points',0,'reason','already_awarded','member_id',m.id);
  end if;

  insert into public.club_point_transactions(member_id, points, transaction_type, reference_id, description)
  values (m.id, pts, 'EARN', s.id, 'Puntos por venta HAL Garage ' || coalesce('#'||s.sale_number::text, ''));

  update public.club_members
  set points_balance = coalesce(points_balance,0) + pts,
      updated_at = now()
  where id = m.id;

  return jsonb_build_object('awarded_points',pts,'member_id',m.id,'customer_id',c.id);
end;
$$;

grant execute on function public.award_club_points_for_sale(uuid) to authenticated;

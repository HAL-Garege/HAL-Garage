create or replace function public.club_redeem_product(p_auth_user_id uuid, p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  m record;
  p record;
  r record;
  newbal integer;
  code text;
begin
  if auth.uid() is null or auth.uid() <> p_auth_user_id then
    raise exception 'No autorizado';
  end if;

  select cm.id, cm.category, cm.points_balance
    into m
  from public.club_members cm
  where cm.auth_user_id = p_auth_user_id
    and cm.active = true
  for update;
  if not found then raise exception 'Membresía no disponible'; end if;

  select cp.id, cp.name, cp.description, cp.points_cost, cp.stock, cp.category
    into p
  from public.club_catalog_products cp
  where cp.id = p_product_id
    and cp.active = true
  for update;
  if not found then raise exception 'Producto no disponible'; end if;

  if p.category is not null and upper(p.category) <> upper(m.category) then
    raise exception 'Este producto no está disponible para tu categoría';
  end if;
  if p.stock is null or p.stock <= 0 then raise exception 'Producto agotado'; end if;
  if m.points_balance < p.points_cost then raise exception 'No tienes suficientes puntos'; end if;

  newbal := m.points_balance - p.points_cost;
  update public.club_members
     set points_balance = newbal, updated_at = now()
   where id = m.id;

  code := 'HG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.club_redemptions(member_id,product_id,points_spent,status,pickup_code)
  values(m.id,p.id,p.points_cost,'PENDING_PICKUP',code)
  returning id, status, pickup_code, points_spent into r;

  update public.club_catalog_products
     set stock = stock - 1, updated_at = now()
   where id = p.id;

  insert into public.club_point_transactions(member_id,points,transaction_type,reference_id,description)
  values(m.id,-p.points_cost,'REDEEM',r.id,'Canje: ' || p.name);

  return jsonb_build_object(
    'ok',true,
    'redemption_id',r.id,
    'pickup_code',r.pickup_code,
    'points_spent',r.points_spent,
    'points_balance',newbal,
    'product_name',p.name,
    'status',r.status
  );
end;
$function$;

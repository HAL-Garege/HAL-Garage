create or replace function public.club_adjust_points(p_member_id uuid, p_points integer, p_description text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_balance integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin','supervisor')
  ) then
    raise exception 'No autorizado';
  end if;
  if p_points = 0 then raise exception 'El ajuste no puede ser 0'; end if;

  update public.club_members
  set points_balance = greatest(0, points_balance + p_points),
      updated_at = now()
  where id = p_member_id
  returning points_balance into v_balance;

  if not found then raise exception 'Miembro no encontrado'; end if;

  insert into public.club_point_transactions
    (member_id, points, transaction_type, reference_id, description)
  values
    (p_member_id, p_points, 'ADJUSTMENT', null,
     coalesce(p_description, 'Ajuste manual de puntos'));

  return jsonb_build_object(
    'member_id', p_member_id,
    'points_balance', v_balance,
    'adjusted_points', p_points
  );
end;
$function$;

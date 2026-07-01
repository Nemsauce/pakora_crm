create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  tipo text not null default 'estado_dropi',
  titulo text not null,
  mensaje text not null,
  leida boolean default false,
  pais text,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_leida on public.notifications(leida, created_at desc);
create index if not exists idx_notifications_order on public.notifications(order_id);

create or replace function public.generate_notification_on_status_change()
returns trigger as $$
declare
  v_order_label text;
  v_customer text;
begin
  if tg_op = 'UPDATE' and old.estado_dropi is not distinct from new.estado_dropi then
    return new;
  end if;

  v_order_label := coalesce(new.numero_orden, '#' || new.id_orden_dropi::text, '#' || new.id::text);
  v_customer := trim(coalesce(new.nombre, '') || ' ' || coalesce(new.apellido, ''));

  insert into public.notifications (order_id, tipo, titulo, mensaje, pais)
  values (
    new.id,
    'estado_dropi',
    v_order_label || ' → ' || coalesce(new.estado_dropi, 'Sin estado'),
    coalesce(nullif(v_customer, ''), 'Cliente sin nombre') || ' — ' || coalesce(new.ciudad, '') || ' — ' || coalesce(new.transportadora, ''),
    new.pais
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_generate_notification on public.orders;
create trigger trigger_generate_notification
  after insert or update of estado_dropi on public.orders
  for each row
  execute function public.generate_notification_on_status_change();

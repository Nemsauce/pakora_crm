create or replace function public.generate_task_on_order_change()
returns trigger as $$
declare
  v_tipo text;
  v_titulo text;
  v_descripcion text;
  v_existing_count int;
  v_estado text;
  v_order_label text;
  v_customer text;
  v_phone text;
begin
  if tg_op = 'UPDATE' and old.estado_dropi is not distinct from new.estado_dropi then
    return new;
  end if;

  v_estado := coalesce(new.estado_dropi, '');
  v_order_label := coalesce(new.numero_orden, '#' || new.id_orden_dropi::text, '#' || new.id::text);
  v_customer := trim(coalesce(new.nombre, '') || ' ' || coalesce(new.apellido, ''));
  v_phone := coalesce(new.telefono, 'sin telefono');

  if v_estado in ('ENTREGADO', 'CANCELADO', 'DEVOLUCION') then
    return new;
  end if;

  if v_estado = 'PENDIENTE CONFIRMACION' then
    v_tipo := 'llamar_confirmacion';
  elsif v_estado = 'GUIA_GENERADA' then
    v_tipo := 'notificar_guia';
  elsif v_estado in ('NOVEDAD', 'SIN MOVIMIENTOS') then
    v_tipo := 'revisar_novedad';
  elsif v_estado in (
    'INTENTO DE ENTREGA',
    'RECLAME EN OFICINA',
    'RECEPCION CENTRO DE ENTREGA',
    'TELEMERCADEO',
    'DESTINATARIO SE REHUSA A RECIBIR',
    'Se visita, no se logra entrega',
    'No contesta Cliente',
    'PARA NUEVO INTENTO ENTREGA',
    'EN CONFIRMACIÓN TELEFÓNICA',
    'CERRADO POR INCIDENCIA, VER CAUSA'
  ) then
    v_tipo := 'presionar_entrega';
  else
    return new;
  end if;

  select count(*) into v_existing_count
  from public.tasks
  where order_id = new.id
    and tipo = v_tipo
    and estado = 'pendiente';

  if v_existing_count > 0 then
    return new;
  end if;

  if v_tipo = 'llamar_confirmacion' then
    v_titulo := 'Llamar para confirmar pedido ' || v_order_label;
    v_descripcion := 'Llamar a ' || coalesce(nullif(v_customer, ''), 'cliente sin nombre') || ' al ' || v_phone || ' para confirmar el pedido';
  elsif v_tipo = 'notificar_guia' then
    v_titulo := 'Notificar guía a ' || coalesce(nullif(new.nombre, ''), 'cliente');
    v_descripcion := 'Guía ' || coalesce(new.guia_envio, 'pendiente') || ' generada por ' || coalesce(new.transportadora, 'transportadora') || '. Notificar al cliente ' || v_phone;
  elsif v_tipo = 'revisar_novedad' then
    v_titulo := 'Revisar novedad de ' || coalesce(nullif(new.nombre, ''), 'cliente');
    v_descripcion := 'Estado: ' || v_estado || '. Revisar con transportadora y contactar cliente ' || v_phone;
  elsif v_tipo = 'presionar_entrega' then
    v_titulo := 'Presionar entrega a ' || coalesce(nullif(new.nombre, ''), 'cliente');
    v_descripcion := 'Estado activo: ' || v_estado || '. Llamar a ' || v_phone || ' para coordinar entrega.';
  end if;

  insert into public.tasks (
    order_id, tipo, titulo, descripcion,
    estado, intento_numero, creado_por, fecha_limite
  ) values (
    new.id, v_tipo, v_titulo, v_descripcion,
    'pendiente', 1, 'automatico', now() + interval '2 hours'
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_generate_task on public.orders;
create trigger trigger_generate_task
  after insert or update of estado_dropi on public.orders
  for each row
  execute function public.generate_task_on_order_change();

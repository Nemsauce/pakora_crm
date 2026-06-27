alter table public.orders
  add column if not exists costo_producto numeric,
  add column if not exists costo_envio numeric,
  add column if not exists costo_devolucion numeric,
  add column if not exists comision_cod numeric,
  add column if not exists valor_recaudado numeric,
  add column if not exists valor_liquidado numeric,
  add column if not exists estado_recaudo text,
  add column if not exists estado_liquidacion text,
  add column if not exists fecha_entrega_real timestamptz,
  add column if not exists fecha_recaudo timestamptz,
  add column if not exists fecha_liquidacion timestamptz;

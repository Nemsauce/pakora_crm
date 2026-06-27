export type RiskLevel = "sin_datos" | "bajo" | "medio" | "alto";

export type CountryCode = "CO" | "MX";

export type OrderCrmStatus =
  | "nuevo"
  | "contactado"
  | "confirmado"
  | "en_ruta"
  | "novedad"
  | "entregado"
  | "cancelado"
  | "devolucion";

export type TaskType =
  | "llamar_confirmacion"
  | "nota_voz"
  | "mensaje_confirmacion"
  | "notificar_guia"
  | "presionar_entrega"
  | "cerrar_orden"
  | "manual";

export type TaskStatus = "pendiente" | "hecha" | "omitida";

export type CommentOrigin =
  | "manual"
  | "sheet"
  | "task_completado"
  | "automatico";

export interface Order {
  id: string;
  numero_orden: string | null;
  id_orden_shopify: string | null;
  id_orden_dropi: number | null;
  fecha: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  barrio_referencia: string | null;
  ciudad: string | null;
  departamento: string | null;
  pais: CountryCode | string | null;
  nombre_producto: string | null;
  cantidad: number | null;
  precio: number | null;
  total: number | null;
  notas_pedido: string | null;
  guia_envio: string | null;
  transportadora: string | null;
  estado_dropi: string | null;
  estado_crm: OrderCrmStatus | string | null;
  activo: boolean | null;
  total_pedidos_cliente: number | null;
  pedidos_entregados_cliente: number | null;
  pedidos_devueltos_cliente: number | null;
  nivel_riesgo: RiskLevel | string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Task {
  id: string;
  order_id: string;
  tipo: TaskType | string | null;
  titulo: string | null;
  descripcion: string | null;
  estado: TaskStatus | string | null;
  intento_numero: number | null;
  fecha_limite: string | null;
  creado_por: string | null;
  created_at: string | null;
  completado_en: string | null;
}

export interface TaskWithOrder extends Task {
  orders?: Order | null;
  order?: Order | null;
}

export interface OrderComment {
  id: string;
  order_id: string;
  task_id: string | null;
  comentario: string | null;
  origen: CommentOrigin | string | null;
  created_at: string | null;
}

export interface StatusHistory {
  id: string;
  order_id: string;
  estado: string | null;
  transportadora: string | null;
  registrado_en: string | null;
}

import type { Order, RiskLevel, TaskStatus, TaskType } from "@/lib/types";

export const CO_LOCALE = "es-CO";

export const taskTypeLabels: Record<TaskType, string> = {
  llamar_confirmacion: "Llamar",
  nota_voz: "Nota de voz",
  mensaje_confirmacion: "Mensaje",
  notificar_guia: "Guía",
  presionar_entrega: "Presionar",
  cerrar_orden: "Cerrar",
  manual: "Manual"
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  hecha: "Hecha",
  omitida: "Omitida"
};

export const riskLabels: Record<RiskLevel, string> = {
  sin_datos: "Sin datos",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto"
};

export const crmStatusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  confirmado: "Confirmado",
  en_ruta: "En ruta",
  novedad: "Novedad",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución"
};

export const originLabels: Record<string, string> = {
  manual: "Manual",
  sheet: "Sheet",
  task_completado: "Tarea",
  automatico: "Auto"
};

export function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat(CO_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat(CO_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatToday() {
  return new Intl.DateTimeFormat(CO_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

export function formatCurrency(value?: number | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(CO_LOCALE, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatPhone(value?: string | null) {
  if (!value) return "Sin teléfono";

  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}`;
  }

  return value;
}

export function fullName(order?: Pick<Order, "nombre" | "apellido"> | null) {
  const name = [order?.nombre, order?.apellido].filter(Boolean).join(" ").trim();
  return name || "Cliente sin nombre";
}

export function orderNumber(order?: Pick<Order, "numero_orden"> | null) {
  return order?.numero_orden || "Sin orden";
}

export function labelFromMap(value: string | null | undefined, map: Record<string, string>) {
  if (!value) return "Sin datos";
  return map[value] ?? titleCase(value);
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isEnRutaOrder(order: Pick<Order, "estado_crm" | "estado_dropi">) {
  if (order.estado_crm === "en_ruta") return true;

  const dropiStatus = (order.estado_dropi ?? "").toUpperCase();
  return [
    "ADMITIDA",
    "EN PROCESAMIENTO",
    "EN REPARTO",
    "EN TRANSPORTE",
    "EN BODEGA",
    "EN TERMINAL"
  ].some((state) => dropiStatus.includes(state));
}

export function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

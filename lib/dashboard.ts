import { isEnRutaOrder, orderNumber } from "@/lib/format";
import type { CountryCode, Order, OrderComment, OrderCrmStatus, StatusHistory } from "@/lib/types";

export interface DashboardPipelineStage {
  key: OrderCrmStatus;
  label: string;
  count: number;
  value: number;
  href: string;
}

export interface RecentActivityItem {
  id: string;
  type: "comment" | "status";
  title: string;
  description: string;
  timestamp: string | null;
  orderId: string | null;
}

const pipelineStageMeta: Array<{ key: OrderCrmStatus; label: string }> = [
  { key: "nuevo", label: "Nuevo" },
  { key: "contactado", label: "Contactado" },
  { key: "confirmado", label: "Confirmado" },
  { key: "en_ruta", label: "En ruta" },
  { key: "novedad", label: "Novedad" },
  { key: "entregado", label: "Entregado" },
  { key: "cancelado", label: "Cancelado" },
  { key: "devolucion", label: "Devolución" }
];

function amount(value?: number | null) {
  return Number(value ?? 0);
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
}

function countryFromOrder(order?: Pick<Order, "pais"> | null): CountryCode | null {
  return order?.pais === "CO" || order?.pais === "MX" ? order.pais : null;
}

function scopeOrdersByCountry(orders: Order[], country?: CountryCode | null) {
  return country ? orders.filter((order) => order.pais === country) : orders;
}

function resolvePipelineStage(order: Order): OrderCrmStatus {
  const status = order.estado_crm;
  if (pipelineStageMeta.some((stage) => stage.key === status)) return status as OrderCrmStatus;
  if (isEnRutaOrder(order)) return "en_ruta";
  return "nuevo";
}

export function buildPipelineStages(orders: Order[], country?: CountryCode | null) {
  const scopedOrders = scopeOrdersByCountry(orders, country);

  return pipelineStageMeta.map<DashboardPipelineStage>((stage) => {
    const stageOrders = scopedOrders.filter((order) => resolvePipelineStage(order) === stage.key);
    const countryQuery = country ? `pais=${country}&` : "";
    const filterByStage: Partial<Record<OrderCrmStatus, string>> = {
      en_ruta: "en_ruta",
      novedad: "novedad",
      entregado: "entregadas",
      cancelado: "canceladas"
    };

    return {
      key: stage.key,
      label: stage.label,
      count: stageOrders.length,
      value: stageOrders.reduce((total, order) => total + amount(order.total), 0),
      href: `/ordenes?${countryQuery}filter=${filterByStage[stage.key] ?? "todas"}`
    };
  });
}

export function buildRecentActivity(
  comments: OrderComment[],
  history: StatusHistory[],
  orders: Order[],
  country?: CountryCode | null
) {
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  const commentItems = comments
    .filter((comment) => {
      const order = ordersById.get(comment.order_id);
      return !country || countryFromOrder(order) === country;
    })
    .map<RecentActivityItem>((comment) => {
      const order = ordersById.get(comment.order_id);
      return {
        id: `comment-${comment.id}`,
        type: "comment",
        title: `Comentario ${orderNumber(order)}`,
        description: comment.comentario || "Comentario sin texto.",
        timestamp: comment.created_at,
        orderId: comment.order_id
      };
    });

  const statusItems = history
    .filter((item) => {
      const order = ordersById.get(item.order_id);
      return !country || countryFromOrder(order) === country;
    })
    .map<RecentActivityItem>((item) => {
      const order = ordersById.get(item.order_id);
      return {
        id: `status-${item.id}`,
        type: "status",
        title: `Estado ${orderNumber(order)}`,
        description: `${item.estado || "Sin estado"}${item.transportadora ? ` · ${item.transportadora}` : ""}`,
        timestamp: item.registrado_en,
        orderId: item.order_id
      };
    });

  return [...commentItems, ...statusItems]
    .sort((first, second) => timestamp(second.timestamp) - timestamp(first.timestamp))
    .slice(0, 8);
}

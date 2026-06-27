import { countryFlag, countryLabel } from "@/lib/country";
import { fullName, isEnRutaOrder, orderNumber } from "@/lib/format";
import type {
  CountryCode,
  Order,
  OrderComment,
  OrderCrmStatus,
  StatusHistory,
  TaskWithOrder
} from "@/lib/types";

export interface DashboardPipelineStage {
  key: OrderCrmStatus;
  label: string;
  count: number;
  value: number;
  href: string;
}

export interface DashboardCountrySummary {
  country: CountryCode;
  label: string;
  flag: string;
  activeOrders: number;
  pendingTasks: number;
  overdueTasks: number;
  enRuta: number;
  novedades: number;
  riskHigh: number;
  valueInRoute: number;
  valueAtRisk: number;
}

export interface CourierHealthSummary {
  name: string;
  total: number;
  enRuta: number;
  novedades: number;
  entregadas: number;
  devoluciones: number;
  valueInRoute: number;
}

export interface PriorityTask extends TaskWithOrder {
  overdue: boolean;
  priorityScore: number;
  priorityReasons: string[];
  value: number;
}

export interface RecentActivityItem {
  id: string;
  type: "comment" | "status";
  title: string;
  description: string;
  timestamp: string | null;
  orderId: string | null;
}

export interface SmartAlert {
  id: string;
  title: string;
  description: string;
  severity: "danger" | "warning" | "primary";
  count: number;
  href: string;
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

function taskOrder(task: TaskWithOrder) {
  return task.orders ?? task.order ?? null;
}

function isOverdue(task: TaskWithOrder, now = new Date()) {
  if (task.estado !== "pendiente" || !task.fecha_limite) return false;
  return new Date(task.fecha_limite).getTime() < now.getTime();
}

function isNovedadOrder(order: Order) {
  const dropiStatus = (order.estado_dropi ?? "").toUpperCase();
  return order.estado_crm === "novedad" || dropiStatus.includes("NOVED");
}

function isDevolucionOrder(order: Order) {
  const dropiStatus = (order.estado_dropi ?? "").toUpperCase();
  return order.estado_crm === "devolucion" || dropiStatus.includes("DEVOL");
}

function resolvePipelineStage(order: Order): OrderCrmStatus {
  const status = order.estado_crm;
  if (pipelineStageMeta.some((stage) => stage.key === status)) return status as OrderCrmStatus;
  if (isEnRutaOrder(order)) return "en_ruta";
  return "nuevo";
}

function countryFromOrder(order?: Pick<Order, "pais"> | null): CountryCode | null {
  return order?.pais === "CO" || order?.pais === "MX" ? order.pais : null;
}

function countryHref(country: CountryCode, base: "ordenes" | "tareas", query = "") {
  const prefix = `/${base}?pais=${country}`;
  return query ? `${prefix}&${query}` : prefix;
}

export function scopeOrdersByCountry(orders: Order[], country?: CountryCode | null) {
  return country ? orders.filter((order) => order.pais === country) : orders;
}

export function scopeTasksByCountry(tasks: TaskWithOrder[], country?: CountryCode | null) {
  return country ? tasks.filter((task) => taskOrder(task)?.pais === country) : tasks;
}

export function buildCountrySummaries(orders: Order[], tasks: TaskWithOrder[]) {
  const pendingTasks = tasks.filter((task) => task.estado === "pendiente");

  return (["CO", "MX"] as CountryCode[]).map<DashboardCountrySummary>((country) => {
    const countryOrders = orders.filter((order) => order.pais === country);
    const countryTasks = pendingTasks.filter((task) => taskOrder(task)?.pais === country);
    const activeOrders = countryOrders.filter((order) => order.activo === true);
    const enRutaOrders = countryOrders.filter(isEnRutaOrder);
    const riskyOrders = countryOrders.filter(
      (order) => isNovedadOrder(order) || order.nivel_riesgo === "alto"
    );

    return {
      country,
      label: countryLabel(country),
      flag: countryFlag(country),
      activeOrders: activeOrders.length,
      pendingTasks: countryTasks.length,
      overdueTasks: countryTasks.filter((task) => isOverdue(task)).length,
      enRuta: enRutaOrders.length,
      novedades: countryOrders.filter(isNovedadOrder).length,
      riskHigh: activeOrders.filter((order) => order.nivel_riesgo === "alto").length,
      valueInRoute: enRutaOrders.reduce((total, order) => total + amount(order.total), 0),
      valueAtRisk: riskyOrders.reduce((total, order) => total + amount(order.total), 0)
    };
  });
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

export function buildCourierHealth(orders: Order[], country?: CountryCode | null) {
  const scopedOrders = scopeOrdersByCountry(orders, country);
  const grouped = scopedOrders.reduce<Record<string, CourierHealthSummary>>((accumulator, order) => {
    const name = order.transportadora || "Sin transportadora";
    const current =
      accumulator[name] ??
      ({
        name,
        total: 0,
        enRuta: 0,
        novedades: 0,
        entregadas: 0,
        devoluciones: 0,
        valueInRoute: 0
      } satisfies CourierHealthSummary);

    current.total += 1;
    if (isEnRutaOrder(order)) {
      current.enRuta += 1;
      current.valueInRoute += amount(order.total);
    }
    if (isNovedadOrder(order)) current.novedades += 1;
    if (order.estado_crm === "entregado") current.entregadas += 1;
    if (isDevolucionOrder(order)) current.devoluciones += 1;

    accumulator[name] = current;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .sort((first, second) => second.novedades - first.novedades || second.enRuta - first.enRuta)
    .slice(0, 5);
}

export function buildPriorityTasks(tasks: TaskWithOrder[], country?: CountryCode | null) {
  return scopeTasksByCountry(tasks, country)
    .filter((task) => task.estado === "pendiente")
    .map<PriorityTask>((task) => {
      const order = taskOrder(task);
      const overdue = isOverdue(task);
      const value = amount(order?.total);
      const priorityReasons: string[] = [];
      let priorityScore = 0;

      if (overdue) {
        priorityScore += 1000;
        priorityReasons.push("Vencida");
      }
      if (task.tipo === "presionar_entrega") {
        priorityScore += 420;
        priorityReasons.push("Entrega");
      }
      if (order?.nivel_riesgo === "alto") {
        priorityScore += 300;
        priorityReasons.push("Riesgo alto");
      }
      if (order && isNovedadOrder(order)) {
        priorityScore += 260;
        priorityReasons.push("Novedad");
      }
      if (!order?.telefono) {
        priorityScore += 140;
        priorityReasons.push("Sin teléfono");
      }
      if (order && !order.guia_envio && isEnRutaOrder(order)) {
        priorityScore += 120;
        priorityReasons.push("Sin guía");
      }

      priorityScore += Math.min(value / 10000, 160);

      return {
        ...task,
        overdue,
        priorityScore,
        priorityReasons: priorityReasons.length ? priorityReasons : ["Pendiente"],
        value
      };
    })
    .sort((first, second) => {
      if (second.priorityScore !== first.priorityScore) {
        return second.priorityScore - first.priorityScore;
      }

      const firstDate = first.fecha_limite ? new Date(first.fecha_limite).getTime() : Infinity;
      const secondDate = second.fecha_limite ? new Date(second.fecha_limite).getTime() : Infinity;
      return firstDate - secondDate;
    })
    .slice(0, 12);
}

export function buildSmartAlerts(
  orders: Order[],
  tasks: TaskWithOrder[],
  country?: CountryCode | null
) {
  const scopedOrders = scopeOrdersByCountry(orders, country);
  const scopedTasks = scopeTasksByCountry(tasks, country).filter((task) => task.estado === "pendiente");
  const countryQuery = country ? `pais=${country}&` : "";

  const overdueTasks = scopedTasks.filter((task) => isOverdue(task));
  const novedadesWithoutTask = scopedOrders.filter(
    (order) =>
      isNovedadOrder(order) &&
      !scopedTasks.some((task) => task.order_id === order.id && task.tipo === "presionar_entrega")
  );
  const missingPhone = scopedOrders.filter((order) => order.activo && !order.telefono);
  const missingGuide = scopedOrders.filter((order) => isEnRutaOrder(order) && !order.guia_envio);
  const returnRisk = scopedOrders.filter((order) => Number(order.pedidos_devueltos_cliente ?? 0) > 0);

  return [
    {
      id: "overdue",
      title: "Tareas vencidas",
      description: "Gestiones que ya pasaron su fecha límite.",
      severity: "danger",
      count: overdueTasks.length,
      href: `/tareas?${countryQuery}estado=pendiente`
    },
    {
      id: "novedad_without_task",
      title: "Novedades sin presión",
      description: "Órdenes con novedad sin tarea activa de entrega.",
      severity: "warning",
      count: novedadesWithoutTask.length,
      href: `/ordenes?${countryQuery}filter=novedad`
    },
    {
      id: "missing_phone",
      title: "Sin teléfono",
      description: "Órdenes activas que necesitan dato de contacto.",
      severity: "warning",
      count: missingPhone.length,
      href: `/ordenes?${countryQuery}filter=activas`
    },
    {
      id: "missing_guide",
      title: "En ruta sin guía",
      description: "Pedidos en movimiento sin guía registrada.",
      severity: "primary",
      count: missingGuide.length,
      href: `/ordenes?${countryQuery}filter=en_ruta`
    },
    {
      id: "return_risk",
      title: "Clientes con devolución",
      description: "Historial del cliente indica devoluciones previas.",
      severity: "danger",
      count: returnRisk.length,
      href: `/ordenes?${countryQuery}filter=riesgo_alto`
    }
  ] satisfies SmartAlert[];
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
    .sort(
      (first, second) =>
        new Date(second.timestamp ?? 0).getTime() - new Date(first.timestamp ?? 0).getTime()
    )
    .slice(0, 8);
}

export function dashboardTotals(
  orders: Order[],
  tasks: TaskWithOrder[],
  country?: CountryCode | null
) {
  const scopedOrders = scopeOrdersByCountry(orders, country);
  const scopedTasks = scopeTasksByCountry(tasks, country).filter((task) => task.estado === "pendiente");
  const enRutaOrders = scopedOrders.filter(isEnRutaOrder);
  const riskOrders = scopedOrders.filter(
    (order) => isNovedadOrder(order) || order.nivel_riesgo === "alto"
  );
  const delivered = scopedOrders.filter((order) => order.estado_crm === "entregado").length;
  const canceled = scopedOrders.filter((order) => order.estado_crm === "cancelado").length;
  const returned = scopedOrders.filter(isDevolucionOrder).length;

  return {
    activeOrders: scopedOrders.filter((order) => order.activo === true).length,
    pendingTasks: scopedTasks.length,
    overdueTasks: scopedTasks.filter((task) => isOverdue(task)).length,
    highRiskClients: scopedOrders.filter(
      (order) => order.activo === true && order.nivel_riesgo === "alto"
    ).length,
    enRuta: enRutaOrders.length,
    novedades: scopedOrders.filter(isNovedadOrder).length,
    valueInRoute: enRutaOrders.reduce((total, order) => total + amount(order.total), 0),
    valueAtRisk: riskOrders.reduce((total, order) => total + amount(order.total), 0),
    deliveredRate: scopedOrders.length ? Math.round((delivered / scopedOrders.length) * 100) : 0,
    canceledRate: scopedOrders.length ? Math.round((canceled / scopedOrders.length) * 100) : 0,
    returnedRate: scopedOrders.length ? Math.round((returned / scopedOrders.length) * 100) : 0
  };
}

export function dashboardOwnerLine(task: TaskWithOrder) {
  const order = taskOrder(task);
  return `${fullName(order)} · ${countryFlag(order?.pais)} ${order?.ciudad || "Sin ciudad"}`;
}

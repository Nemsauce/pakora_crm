import { countryFlag, countryLabel } from "@/lib/country";
import { formatCurrency, isEnRutaOrder } from "@/lib/format";
import type {
  CountryCode,
  Order,
  OrderComment,
  StatusHistory,
  TaskType,
  TaskWithOrder
} from "@/lib/types";

export type LogisticsStage =
  | "sin_datos"
  | "sin_guia"
  | "guia"
  | "bodega"
  | "transito"
  | "ultima_milla"
  | "reclame_oficina"
  | "novedad_activa"
  | "novedad_solucionada"
  | "entregado"
  | "cancelado"
  | "devolucion";

export type SignalSeverity = "danger" | "warning" | "primary" | "success" | "neutral";

export interface SuggestedAction {
  label: string;
  description: string;
  href: string;
}

export interface LogisticsSignal {
  order: Order;
  stage: LogisticsStage;
  stageLabel: string;
  status: string;
  displayStatus: string;
  latestEventAt: string | null;
  ageHours: number | null;
  ageLabel: string;
  severity: SignalSeverity;
  riskLabel: string;
  riskScore: number;
  reasons: string[];
  suggestedAction: SuggestedAction;
  valueAtRisk: number;
  riskBucket: string | null;
}

export interface OrderIntelligence {
  order: Order;
  pendingTasks: TaskWithOrder[];
  tasks: TaskWithOrder[];
  comments: OrderComment[];
  history: StatusHistory[];
  logistics: LogisticsSignal;
  value: number;
  isAtRisk: boolean;
  valueAtRisk: number;
  isHighRiskCustomer: boolean;
  isCrmNovedad: boolean;
  isReturned: boolean;
  isCanceled: boolean;
  isDelivered: boolean;
  latestComment: OrderComment | null;
}

export interface ActionInboxItem {
  id: string;
  kind: "task" | "signal";
  order: Order;
  task?: TaskWithOrder;
  logistics: LogisticsSignal;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  priorityScore: number;
  priorityReasons: string[];
  overdue: boolean;
  value: number;
  severity: SignalSeverity;
}

export interface LogisticsRiskAlert {
  id: string;
  title: string;
  description: string;
  count: number;
  value: number;
  severity: SignalSeverity;
  href: string;
}

export interface LogisticsPipelineStage {
  key: LogisticsStage;
  label: string;
  count: number;
  value: number;
  href: string;
}

export interface CourierPerformance {
  name: string;
  total: number;
  delivered: number;
  novedades: number;
  devoluciones: number;
  atRisk: number;
  deliveredRate: number;
  noveltyRate: number;
  returnRate: number;
  atRiskRate: number;
  averageAgeHours: number | null;
  valueAtRisk: number;
  healthScore: number;
}

export interface RevenueRiskBucket {
  label: string;
  status: string;
  count: number;
  value: number;
  severity: SignalSeverity;
  href: string;
}

export interface DashboardIntelligenceSummary {
  activeOrders: number;
  pendingTasks: number;
  overdueTasks: number;
  highRiskClients: number;
  enRuta: number;
  novedades: number;
  valueInRoute: number;
  valueAtRisk: number;
  deliveredRate: number;
  canceledRate: number;
  returnedRate: number;
}

export interface IntelligenceCountrySummary {
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

const stageLabels: Record<LogisticsStage, string> = {
  sin_datos: "Sin datos",
  sin_guia: "Sin guía",
  guia: "Guía",
  bodega: "Bodega",
  transito: "Tránsito",
  ultima_milla: "Última milla",
  reclame_oficina: "Reclame oficina",
  novedad_activa: "Novedad activa",
  novedad_solucionada: "Novedad solucionada",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución"
};

const pipelineStages: Array<{ key: LogisticsStage; label: string }> = [
  { key: "sin_guia", label: "Sin guía" },
  { key: "guia", label: "Guía" },
  { key: "bodega", label: "Bodega" },
  { key: "transito", label: "Tránsito" },
  { key: "ultima_milla", label: "Última milla" },
  { key: "reclame_oficina", label: "Oficina" },
  { key: "novedad_activa", label: "Novedad" },
  { key: "novedad_solucionada", label: "Solucionada" },
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

function sortHistoryDesc(history: StatusHistory[]) {
  return [...history].sort((first, second) => timestamp(second.registrado_en) - timestamp(first.registrado_en));
}

function sortCommentsDesc(comments: OrderComment[]) {
  return [...comments].sort((first, second) => timestamp(second.created_at) - timestamp(first.created_at));
}

function taskOrder(task: TaskWithOrder) {
  return task.orders ?? task.order ?? null;
}

function isOverdue(task: TaskWithOrder, now = new Date()) {
  if (task.estado !== "pendiente" || !task.fecha_limite) return false;
  return timestamp(task.fecha_limite) < now.getTime();
}

function orderCountry(order?: Pick<Order, "pais"> | null): CountryCode | null {
  return order?.pais === "CO" || order?.pais === "MX" ? order.pais : null;
}

function groupByOrderId<T extends { order_id: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    accumulator[item.order_id] = [...(accumulator[item.order_id] ?? []), item];
    return accumulator;
  }, {});
}

export function normalizeDropiStatus(value?: string | null) {
  return (value ?? "SIN DATOS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function classifyLogisticsStage(value?: string | null, order?: Pick<Order, "guia_envio" | "activo"> | null): LogisticsStage {
  const status = normalizeDropiStatus(value);

  if (status.includes("ENTREG")) return "entregado";
  if (status.includes("CANCEL") || status.includes("RECHAZ")) return "cancelado";
  if (status.includes("DEVOL")) return "devolucion";
  if (status.includes("RECLAME")) return "reclame_oficina";
  if (status.includes("RECEPCION CENTRO DE ENTREGA")) return "reclame_oficina";
  if (status.includes("NOVED") && status.includes("SOLUCION")) return "novedad_solucionada";
  if (status.includes("NOVED")) return "novedad_activa";
  if (status.includes("GUIA")) return "guia";
  if (
    status.includes("BODEGA") ||
    status.includes("PREPARADO") ||
    status.includes("RECOGIDO") ||
    status.includes("RECEPCION") ||
    status.includes("ACEPTACION DE ENVIOS") ||
    status.includes("RECOLECCION ATENDIDA")
  ) {
    return "bodega";
  }
  if (
    status.includes("TRANSPORTE") ||
    status.includes("TRANSITO") ||
    status.includes("CAMINO") ||
    status.includes("DESPACH") ||
    status.includes("ADMITIDA") ||
    status.includes("TERMINAL") ||
    status.includes("SIN MOV") ||
    status.includes("SALIDA DE CENTRO DE DISTRIBUCION") ||
    status.includes("EMBARQUE DE CARGA") ||
    status.includes("DESEMBARQUE DE CARGA") ||
    status.includes("DESEMBARCADA") ||
    status.includes("TRANSBORDADA") ||
    status.includes("SALIDA DE INSTALACIONES CIRCUITO")
  ) {
    return "transito";
  }
  if (
    status.includes("REPARTO") ||
    status.includes("RUTA") ||
    status.includes("OFICINA") ||
    status.includes("ASIGNADO A MENSAJERO") ||
    status.includes("LLEGANDO A INSTALACION") ||
    status.includes("LISTO PARA ENTREGAR")
  ) {
    return "ultima_milla";
  }
  if (order?.activo && !order.guia_envio) return "sin_guia";

  return "sin_datos";
}

export function logisticsStageLabel(stage: LogisticsStage) {
  return stageLabels[stage];
}

function hoursSince(value?: string | null, now = new Date()) {
  if (!value) return null;
  const date = timestamp(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date) / 36e5));
}

export function formatAge(hours: number | null) {
  if (hours === null) return "Sin fecha";
  if (hours < 1) return "Ahora";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

function suggestedAction(order: Order, stage: LogisticsStage, status: string, reasons: string[]): SuggestedAction {
  const href = `/ordenes/${order.id}`;

  if (stage === "reclame_oficina") {
    return {
      label: "Contactar cliente",
      description: "Enviar instrucciones para reclamar en oficina.",
      href
    };
  }
  if (stage === "novedad_activa") {
    return {
      label: "Resolver novedad",
      description: "Revisar causa y presionar solución con transportadora.",
      href
    };
  }
  if (status.includes("SIN MOV") || reasons.includes("Sin movimiento")) {
    return {
      label: "Revisar transporte",
      description: "Validar movimiento con la transportadora.",
      href
    };
  }
  if (stage === "devolucion") {
    return {
      label: "Cerrar recuperación",
      description: "Confirmar devolución y registrar aprendizaje del caso.",
      href
    };
  }
  if (stage === "sin_guia" || stage === "guia") {
    return {
      label: "Notificar guía",
      description: "Enviar guía y expectativa de entrega al cliente.",
      href
    };
  }
  if (stage === "ultima_milla") {
    return {
      label: "Presionar entrega",
      description: "Contactar cliente antes de un intento fallido.",
      href
    };
  }

  return {
    label: "Ver orden",
    description: "Revisar contexto completo del pedido.",
    href
  };
}

function riskBucketFromReasons(reasons: string[], stage: LogisticsStage) {
  if (reasons.includes("Reclame oficina")) return "Reclame oficina";
  if (reasons.includes("Novedad Dropi")) return "Novedad activa";
  if (reasons.includes("Sin movimiento")) return "Sin movimiento";
  if (reasons.includes("Sin guía")) return "Sin guía";
  if (reasons.includes("Devolución")) return "Devolución";
  if (reasons.includes("Reparto prolongado")) return "Reparto prolongado";
  if (stage === "novedad_solucionada") return "Novedad solucionada";
  return null;
}

export function buildLogisticsSignal(order: Order, history: StatusHistory[] = []): LogisticsSignal {
  const sortedHistory = sortHistoryDesc(history);
  const latestEvent = sortedHistory[0] ?? null;
  const displayStatus = latestEvent?.estado ?? order.estado_dropi ?? "Sin estado";
  const status = normalizeDropiStatus(displayStatus);
  const stage = classifyLogisticsStage(displayStatus, order);
  const latestEventAt = latestEvent?.registrado_en ?? order.fecha ?? null;
  const ageHours = hoursSince(latestEventAt);
  const reasons: string[] = [];
  let severity: SignalSeverity = "neutral";
  let riskScore = 0;

  if (stage === "reclame_oficina") {
    reasons.push("Reclame oficina");
    riskScore += 900;
    severity = "danger";
  }
  if (stage === "novedad_activa") {
    reasons.push("Novedad Dropi");
    riskScore += 800;
    severity = "danger";
  }
  if (stage === "novedad_solucionada") {
    reasons.push("Novedad solucionada");
    riskScore += 150;
    severity = "warning";
  }
  if (status.includes("SIN MOV")) {
    reasons.push("Sin movimiento");
    riskScore += 750;
    severity = "danger";
  }
  if (stage === "devolucion") {
    reasons.push("Devolución");
    riskScore += 650;
    severity = "danger";
  }
  if (stage === "sin_guia") {
    reasons.push("Sin guía");
    riskScore += 180;
    if (severity === "neutral") severity = "warning";
  }
  if (ageHours !== null && stage === "ultima_milla" && ageHours >= 24) {
    reasons.push("Reparto prolongado");
    riskScore += 260;
    if (severity !== "danger") severity = "warning";
  }
  if (ageHours !== null && (stage === "bodega" || stage === "transito") && ageHours >= 48) {
    reasons.push("Sin movimiento");
    riskScore += 340;
    if (severity !== "danger") severity = "warning";
  }
  if (stage === "entregado") {
    reasons.push("Entregado");
    severity = "success";
    riskScore = Math.max(0, riskScore - 300);
  }
  if (stage === "cancelado") {
    reasons.push("Cancelado");
  }
  if (["guia", "bodega", "transito", "ultima_milla"].includes(stage)) {
    riskScore += 80;
    if (severity === "neutral") severity = "primary";
  }

  const valueAtRisk = severity === "danger" || severity === "warning" ? amount(order.total) : 0;
  const riskBucket = riskBucketFromReasons(reasons, stage);

  return {
    order,
    stage,
    stageLabel: logisticsStageLabel(stage),
    status,
    displayStatus,
    latestEventAt,
    ageHours,
    ageLabel: formatAge(ageHours),
    severity,
    riskLabel: reasons[0] ?? logisticsStageLabel(stage),
    riskScore,
    reasons: reasons.length ? reasons : [logisticsStageLabel(stage)],
    suggestedAction: suggestedAction(order, stage, status, reasons),
    valueAtRisk,
    riskBucket
  };
}

export function buildOrderIntelligence(
  orders: Order[],
  tasks: TaskWithOrder[] = [],
  history: StatusHistory[] = [],
  comments: OrderComment[] = [],
  country?: CountryCode | null
) {
  const tasksByOrderId = groupByOrderId(tasks);
  const historyByOrderId = groupByOrderId(history);
  const commentsByOrderId = groupByOrderId(comments);

  return orders
    .filter((order) => !country || order.pais === country)
    .map<OrderIntelligence>((order) => {
      const orderTasks = (tasksByOrderId[order.id] ?? []).map((task) => ({
        ...task,
        orders: task.orders ?? order,
        order: task.order ?? order
      }));
      const orderHistory = sortHistoryDesc(historyByOrderId[order.id] ?? []);
      const orderComments = sortCommentsDesc(commentsByOrderId[order.id] ?? []);
      const logistics = buildLogisticsSignal(order, orderHistory);
      const isHighRiskCustomer = order.activo === true && order.nivel_riesgo === "alto";
      const isCrmNovedad = order.estado_crm === "novedad";
      const isReturned = order.estado_crm === "devolucion" || logistics.stage === "devolucion";
      const isCanceled = order.estado_crm === "cancelado" || logistics.stage === "cancelado";
      const isDelivered = order.estado_crm === "entregado" || logistics.stage === "entregado";
      const isAtRisk = logistics.valueAtRisk > 0 || isCrmNovedad || isHighRiskCustomer;

      return {
        order,
        pendingTasks: orderTasks.filter((task) => task.estado === "pendiente"),
        tasks: orderTasks,
        comments: orderComments,
        history: orderHistory,
        logistics,
        value: amount(order.total),
        isAtRisk,
        valueAtRisk: isAtRisk ? amount(order.total) : 0,
        isHighRiskCustomer,
        isCrmNovedad,
        isReturned,
        isCanceled,
        isDelivered,
        latestComment: orderComments[0] ?? null
      };
    });
}

function relatedTaskTypes(signal: LogisticsSignal): TaskType[] {
  if (signal.stage === "sin_guia" || signal.stage === "guia") return ["notificar_guia"];
  if (signal.stage === "reclame_oficina" || signal.stage === "novedad_activa") return ["presionar_entrega"];
  if (signal.stage === "devolucion") return ["cerrar_orden"];
  if (signal.reasons.includes("Sin movimiento") || signal.stage === "ultima_milla") return ["presionar_entrega"];
  return ["manual"];
}

function logisticsPriority(signal: LogisticsSignal) {
  const reasons: string[] = [];
  let score = 0;

  if (signal.stage === "reclame_oficina") {
    score += 900;
    reasons.push("Oficina");
  }
  if (signal.stage === "novedad_activa") {
    score += 800;
    reasons.push("Novedad Dropi");
  }
  if (signal.reasons.includes("Sin movimiento")) {
    score += 750;
    reasons.push("Sin movimiento");
  }
  if (signal.stage === "devolucion") {
    score += 650;
    reasons.push("Devolución");
  }
  if (signal.stage === "sin_guia") {
    score += 180;
    reasons.push("Sin guía");
  }

  return { score, reasons };
}

function valueBonus(value: number) {
  return Math.min(value / 10000, 160);
}

export function buildUnifiedActionInbox(intelligence: OrderIntelligence[], limit = 12) {
  const items: ActionInboxItem[] = [];

  intelligence.forEach((item) => {
    const { order, logistics } = item;
    const logisticsScore = logisticsPriority(logistics);

    item.pendingTasks.forEach((task) => {
      const overdue = isOverdue(task);
      const priorityReasons: string[] = [];
      let priorityScore = valueBonus(item.value);

      if (overdue) {
        priorityScore += 1000;
        priorityReasons.push("Vencida");
      }
      if (task.tipo === "presionar_entrega") {
        priorityScore += 450;
        priorityReasons.push("Entrega");
      }
      if (item.isHighRiskCustomer) {
        priorityScore += 300;
        priorityReasons.push("Riesgo alto");
      }
      if (!order.telefono) {
        priorityScore += 200;
        priorityReasons.push("Sin teléfono");
      }
      if (logistics.stage === "sin_guia") {
        priorityScore += 180;
        priorityReasons.push("Sin guía");
      }

      priorityScore += logisticsScore.score;
      priorityReasons.push(...logisticsScore.reasons);

      const uniqueReasons = Array.from(new Set(priorityReasons.length ? priorityReasons : ["Pendiente"]));
      const taskForCard = {
        ...task,
        order,
        orders: order,
        overdue,
        priorityReasons: uniqueReasons
      } as TaskWithOrder & { overdue: boolean; priorityReasons: string[] };

      items.push({
        id: `task-${task.id}`,
        kind: "task",
        order,
        task: taskForCard,
        logistics,
        title: task.titulo || "Tarea pendiente",
        description: task.descripcion || logistics.suggestedAction.description,
        href: `/ordenes/${order.id}`,
        actionLabel: "Completar tarea",
        priorityScore,
        priorityReasons: uniqueReasons,
        overdue,
        value: item.value,
        severity: overdue ? "danger" : logistics.severity
      });
    });

    const hasRelatedTask = item.pendingTasks.some((task) =>
      relatedTaskTypes(logistics).includes(task.tipo as TaskType)
    );

    if ((logistics.severity === "danger" || logistics.severity === "warning") && !hasRelatedTask) {
      const priorityReasons = Array.from(new Set(logisticsScore.reasons.length ? logisticsScore.reasons : logistics.reasons));

      items.push({
        id: `signal-${order.id}-${logistics.stage}`,
        kind: "signal",
        order,
        logistics,
        title: logistics.suggestedAction.label,
        description: logistics.suggestedAction.description,
        href: logistics.suggestedAction.href,
        actionLabel: "Acción sugerida",
        priorityScore: logistics.riskScore + valueBonus(item.value),
        priorityReasons,
        overdue: false,
        value: item.value,
        severity: logistics.severity
      });
    }
  });

  return items
    .sort((first, second) => {
      if (second.priorityScore !== first.priorityScore) return second.priorityScore - first.priorityScore;
      return second.value - first.value;
    })
    .slice(0, limit);
}

export function buildDashboardIntelligenceSummary(intelligence: OrderIntelligence[]): DashboardIntelligenceSummary {
  const orders = intelligence.map((item) => item.order);
  const pendingTasks = intelligence.flatMap((item) => item.pendingTasks);
  const enRutaOrders = orders.filter(isEnRutaOrder);
  const delivered = intelligence.filter((item) => item.isDelivered).length;
  const canceled = intelligence.filter((item) => item.isCanceled).length;
  const returned = intelligence.filter((item) => item.isReturned).length;

  return {
    activeOrders: orders.filter((order) => order.activo === true).length,
    pendingTasks: pendingTasks.length,
    overdueTasks: pendingTasks.filter((task) => isOverdue(task)).length,
    highRiskClients: intelligence.filter((item) => item.isHighRiskCustomer).length,
    enRuta: enRutaOrders.length,
    novedades: intelligence.filter((item) => item.isCrmNovedad || item.logistics.stage === "novedad_activa").length,
    valueInRoute: enRutaOrders.reduce((total, order) => total + amount(order.total), 0),
    valueAtRisk: intelligence.reduce((total, item) => total + item.valueAtRisk, 0),
    deliveredRate: intelligence.length ? Math.round((delivered / intelligence.length) * 100) : 0,
    canceledRate: intelligence.length ? Math.round((canceled / intelligence.length) * 100) : 0,
    returnedRate: intelligence.length ? Math.round((returned / intelligence.length) * 100) : 0
  };
}

export function buildIntelligenceCountrySummaries(intelligence: OrderIntelligence[]) {
  return (["CO", "MX"] as CountryCode[]).map<IntelligenceCountrySummary>((country) => {
    const scoped = intelligence.filter((item) => orderCountry(item.order) === country);
    const orders = scoped.map((item) => item.order);
    const pendingTasks = scoped.flatMap((item) => item.pendingTasks);
    const enRutaOrders = orders.filter(isEnRutaOrder);

    return {
      country,
      label: countryLabel(country),
      flag: countryFlag(country),
      activeOrders: orders.filter((order) => order.activo === true).length,
      pendingTasks: pendingTasks.length,
      overdueTasks: pendingTasks.filter((task) => isOverdue(task)).length,
      enRuta: enRutaOrders.length,
      novedades: scoped.filter((item) => item.isCrmNovedad || item.logistics.stage === "novedad_activa").length,
      riskHigh: scoped.filter((item) => item.isHighRiskCustomer).length,
      valueInRoute: enRutaOrders.reduce((total, order) => total + amount(order.total), 0),
      valueAtRisk: scoped.reduce((total, item) => total + item.valueAtRisk, 0)
    };
  });
}

export function buildLogisticsRiskAlerts(intelligence: OrderIntelligence[], country?: CountryCode | null) {
  const countryQuery = country ? `pais=${country}&` : "";
  const definitions: Array<{
    id: string;
    title: string;
    description: string;
    matcher: (item: OrderIntelligence) => boolean;
    severity: SignalSeverity;
    href: string;
  }> = [
    {
      id: "reclame_oficina",
      title: "Reclame en oficina",
      description: "Pedidos esperando acción urgente del cliente.",
      matcher: (item) => item.logistics.stage === "reclame_oficina",
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=reclame_oficina`
    },
    {
      id: "novedad_dropi",
      title: "Novedad Dropi",
      description: "Incidencias activas de transportadora.",
      matcher: (item) => item.logistics.stage === "novedad_activa",
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=novedad_dropi`
    },
    {
      id: "sin_movimiento",
      title: "Sin movimiento",
      description: "Órdenes quietas por estado o por aging prolongado.",
      matcher: (item) => item.logistics.reasons.includes("Sin movimiento"),
      severity: "warning",
      href: `/ordenes?${countryQuery}filter=sin_movimiento`
    },
    {
      id: "sin_guia",
      title: "Sin guía",
      description: "Pedidos activos sin guía de envío registrada.",
      matcher: (item) => item.logistics.stage === "sin_guia",
      severity: "warning",
      href: `/ordenes?${countryQuery}filter=sin_guia`
    },
    {
      id: "devolucion",
      title: "Devolución",
      description: "Pedidos entrando o marcados en devolución.",
      matcher: (item) => item.logistics.stage === "devolucion",
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=devolucion_dropi`
    }
  ];

  return definitions.map<LogisticsRiskAlert>((definition) => {
    const matches = intelligence.filter(definition.matcher);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      count: matches.length,
      value: matches.reduce((total, item) => total + item.value, 0),
      severity: definition.severity,
      href: definition.href
    };
  });
}

function pipelineHref(stage: LogisticsStage, country?: CountryCode | null) {
  const countryQuery = country ? `pais=${country}&` : "";
  const filterByStage: Partial<Record<LogisticsStage, string>> = {
    sin_guia: "sin_guia",
    bodega: "en_ruta",
    transito: "en_ruta",
    ultima_milla: "en_ruta",
    reclame_oficina: "reclame_oficina",
    novedad_activa: "novedad_dropi",
    entregado: "entregadas",
    cancelado: "canceladas",
    devolucion: "devolucion_dropi"
  };

  return `/ordenes?${countryQuery}filter=${filterByStage[stage] ?? "todas"}`;
}

export function buildLogisticsPipeline(intelligence: OrderIntelligence[], country?: CountryCode | null) {
  return pipelineStages.map<LogisticsPipelineStage>((stage) => {
    const matches = intelligence.filter((item) => item.logistics.stage === stage.key);
    return {
      key: stage.key,
      label: stage.label,
      count: matches.length,
      value: matches.reduce((total, item) => total + item.value, 0),
      href: pipelineHref(stage.key, country)
    };
  });
}

export function buildCourierPerformance(intelligence: OrderIntelligence[]) {
  const grouped = intelligence.reduce<
    Record<string, CourierPerformance & { ageTotal: number; ageSamples: number }>
  >((accumulator, item) => {
    const name = item.order.transportadora || "Sin transportadora";
    const current =
      accumulator[name] ??
      ({
        name,
        total: 0,
        delivered: 0,
        novedades: 0,
        devoluciones: 0,
        atRisk: 0,
        deliveredRate: 0,
        noveltyRate: 0,
        returnRate: 0,
        atRiskRate: 0,
        averageAgeHours: null,
        valueAtRisk: 0,
        healthScore: 100,
        ageTotal: 0,
        ageSamples: 0
      });

    current.total += 1;
    if (item.isDelivered) current.delivered += 1;
    if (item.logistics.stage === "novedad_activa" || item.logistics.stage === "novedad_solucionada") {
      current.novedades += 1;
    }
    if (item.isReturned) current.devoluciones += 1;
    if (item.isAtRisk) {
      current.atRisk += 1;
      current.valueAtRisk += item.valueAtRisk;
    }
    if (item.logistics.ageHours !== null) {
      current.ageTotal += item.logistics.ageHours;
      current.ageSamples += 1;
    }

    accumulator[name] = current;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .map((score) => {
      const deliveredRate = score.total ? score.delivered / score.total : 0;
      const noveltyRate = score.total ? score.novedades / score.total : 0;
      const returnRate = score.total ? score.devoluciones / score.total : 0;
      const atRiskRate = score.total ? score.atRisk / score.total : 0;
      const averageAgeHours = score.ageSamples ? Math.round(score.ageTotal / score.ageSamples) : null;
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          100 -
            noveltyRate * 40 -
            returnRate * 50 -
            atRiskRate * 30 -
            Math.min(averageAgeHours ?? 0, 96) * 0.25
        )
      );

      const { ageTotal, ageSamples, ...publicScore } = score;
      void ageTotal;
      void ageSamples;

      return {
        ...publicScore,
        deliveredRate,
        noveltyRate,
        returnRate,
        atRiskRate,
        averageAgeHours,
        healthScore
      };
    })
    .sort((first, second) => first.healthScore - second.healthScore || second.total - first.total)
    .slice(0, 6);
}

export function buildRevenueRiskBuckets(intelligence: OrderIntelligence[], country?: CountryCode | null) {
  const countryQuery = country ? `pais=${country}&` : "";
  const hrefByBucket: Record<string, string> = {
    "Reclame oficina": `/ordenes?${countryQuery}filter=reclame_oficina`,
    "Novedad activa": `/ordenes?${countryQuery}filter=novedad_dropi`,
    "Sin movimiento": `/ordenes?${countryQuery}filter=sin_movimiento`,
    "Sin guía": `/ordenes?${countryQuery}filter=sin_guia`,
    Devolución: `/ordenes?${countryQuery}filter=devolucion_dropi`,
    "Reparto prolongado": `/ordenes?${countryQuery}filter=en_ruta`,
    "Novedad solucionada": `/ordenes?${countryQuery}filter=novedad_dropi`
  };

  const grouped = intelligence
    .filter((item) => item.logistics.valueAtRisk > 0)
    .reduce<Record<string, RevenueRiskBucket>>((accumulator, item) => {
      const label = item.logistics.riskBucket ?? item.logistics.riskLabel;
      const current =
        accumulator[label] ??
        ({
          label,
          status: label,
          count: 0,
          value: 0,
          severity: item.logistics.severity,
          href: hrefByBucket[label] ?? `/ordenes?${countryQuery}filter=riesgo_alto`
        } satisfies RevenueRiskBucket);

      current.count += 1;
      current.value += item.logistics.valueAtRisk;
      if (item.logistics.severity === "danger") current.severity = "danger";
      accumulator[label] = current;
      return accumulator;
    }, {});

  return Object.values(grouped)
    .sort((first, second) => second.value - first.value)
    .slice(0, 6);
}

export function severityClasses(severity: SignalSeverity) {
  const classes: Record<SignalSeverity, string> = {
    danger: "border-danger/30 bg-danger/[0.14] text-danger",
    warning: "border-warning/30 bg-warning/[0.14] text-warning",
    primary: "border-primary/30 bg-primary/[0.14] text-primary",
    success: "border-success/30 bg-success/[0.14] text-success",
    neutral: "border-slate-400/20 bg-white/[0.07] text-muted"
  };

  return classes[severity];
}

export function signalValueLabel(signal: LogisticsSignal) {
  return signal.valueAtRisk ? formatCurrency(signal.valueAtRisk) : formatCurrency(signal.order.total);
}

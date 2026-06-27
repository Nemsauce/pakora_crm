import { formatCurrency, isEnRutaOrder } from "@/lib/format";
import type { CountryCode, Order, StatusHistory } from "@/lib/types";

export type DropiLogisticsStage =
  | "confirmacion"
  | "guia"
  | "bodega"
  | "transito"
  | "ultima_milla"
  | "novedad"
  | "finalizado"
  | "sin_datos";

export type DropiSignalSeverity = "danger" | "warning" | "primary" | "success" | "neutral";

export interface SuggestedDropiAction {
  label: string;
  description: string;
  href: string;
}

export interface DropiOrderSignal {
  order: Order;
  stage: DropiLogisticsStage;
  stageLabel: string;
  status: string;
  latestEventAt: string | null;
  ageHours: number | null;
  ageLabel: string;
  severity: DropiSignalSeverity;
  riskLabel: string;
  riskScore: number;
  reasons: string[];
  suggestedAction: SuggestedDropiAction;
  valueAtRisk: number;
}

export interface DropiRiskAlert {
  id: string;
  title: string;
  description: string;
  count: number;
  value: number;
  severity: DropiSignalSeverity;
  href: string;
}

export interface CourierScore {
  name: string;
  total: number;
  delivered: number;
  novedades: number;
  devoluciones: number;
  enRuta: number;
  atRisk: number;
  valueAtRisk: number;
  averageAgeHours: number | null;
  healthScore: number;
}

export interface DropiPipelineStage {
  key: DropiLogisticsStage;
  label: string;
  count: number;
  value: number;
  href: string;
}

export interface DropiStatusRisk {
  status: string;
  count: number;
  value: number;
  severity: DropiSignalSeverity;
}

const stageLabels: Record<DropiLogisticsStage, string> = {
  confirmacion: "Confirmación",
  guia: "Guía",
  bodega: "Bodega",
  transito: "Tránsito",
  ultima_milla: "Última milla",
  novedad: "Novedad",
  finalizado: "Finalizado",
  sin_datos: "Sin datos"
};

const pipelineStages: Array<{ key: DropiLogisticsStage; label: string }> = [
  { key: "confirmacion", label: "Confirmación" },
  { key: "guia", label: "Guía" },
  { key: "bodega", label: "Bodega" },
  { key: "transito", label: "Tránsito" },
  { key: "ultima_milla", label: "Última milla" },
  { key: "novedad", label: "Novedad" },
  { key: "finalizado", label: "Finalizado" }
];

function amount(value?: number | null) {
  return Number(value ?? 0);
}

export function normalizeDropiStatus(value?: string | null) {
  return (value ?? "SIN DATOS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function classifyDropiStage(value?: string | null): DropiLogisticsStage {
  const status = normalizeDropiStatus(value);

  if (!status || status === "SIN DATOS") return "sin_datos";
  if (status.includes("NOVED") || status.includes("RECLAME") || status.includes("SIN MOV")) {
    return "novedad";
  }
  if (status.includes("DEVOL") || status.includes("ENTREG") || status.includes("CANCEL")) {
    return "finalizado";
  }
  if (status.includes("REPARTO") || status.includes("RUTA") || status.includes("OFICINA")) {
    return "ultima_milla";
  }
  if (
    status.includes("TRANSPORTE") ||
    status.includes("CAMINO") ||
    status.includes("DESPACH") ||
    status.includes("ADMITIDA") ||
    status.includes("TERMINAL")
  ) {
    return "transito";
  }
  if (status.includes("BODEGA") || status.includes("PREPARADO") || status.includes("RECOGIDO")) {
    return "bodega";
  }
  if (status.includes("GUIA")) return "guia";
  if (status.includes("CONFIRM") || status.includes("PENDIENTE") || status.includes("TELEMERCADEO")) {
    return "confirmacion";
  }

  return "sin_datos";
}

export function stageLabel(stage: DropiLogisticsStage) {
  return stageLabels[stage];
}

function latestEventForOrder(order: Order, history: StatusHistory[]) {
  const events = history
    .filter((item) => item.order_id === order.id)
    .sort(
      (first, second) =>
        new Date(second.registrado_en ?? 0).getTime() -
        new Date(first.registrado_en ?? 0).getTime()
    );

  return events[0] ?? null;
}

function eventDate(order: Order, event?: StatusHistory | null) {
  return event?.registrado_en ?? order.updated_at ?? order.fecha ?? null;
}

function hoursSince(value?: string | null, now = new Date()) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 36e5));
}

export function formatAge(hours: number | null) {
  if (hours === null) return "Sin fecha";
  if (hours < 1) return "Ahora";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

function suggestedAction(
  order: Order,
  stage: DropiLogisticsStage,
  status: string,
  reasons: string[]
): SuggestedDropiAction {
  const orderUrl = `/ordenes/${order.id}`;

  if (status.includes("RECLAME")) {
    return {
      label: "Contactar cliente",
      description: "Enviar instrucciones para reclamar en oficina.",
      href: orderUrl
    };
  }
  if (status.includes("NOVED")) {
    return {
      label: "Resolver novedad",
      description: "Revisar causa y presionar solución con transportadora.",
      href: orderUrl
    };
  }
  if (status.includes("SIN MOV") || reasons.includes("Sin movimiento")) {
    return {
      label: "Revisar transporte",
      description: "Validar movimiento con transportadora.",
      href: orderUrl
    };
  }
  if (stage === "ultima_milla") {
    return {
      label: "Presionar entrega",
      description: "Contactar cliente antes de intento fallido.",
      href: orderUrl
    };
  }
  if (stage === "guia") {
    return {
      label: "Notificar guía",
      description: "Enviar guía y expectativa de entrega al cliente.",
      href: orderUrl
    };
  }

  return {
    label: "Ver orden",
    description: "Revisar contexto completo del pedido.",
    href: orderUrl
  };
}

export function buildDropiOrderSignal(order: Order, history: StatusHistory[] = []): DropiOrderSignal {
  const latestEvent = latestEventForOrder(order, history);
  const status = normalizeDropiStatus(latestEvent?.estado ?? order.estado_dropi);
  const stage = classifyDropiStage(status);
  const latestEventAt = eventDate(order, latestEvent);
  const ageHours = hoursSince(latestEventAt);
  const reasons: string[] = [];
  let severity: DropiSignalSeverity = "neutral";
  let riskScore = 0;

  if (status.includes("RECLAME")) {
    reasons.push("Reclame oficina");
    riskScore += 900;
    severity = "danger";
  }
  if (status.includes("NOVED")) {
    reasons.push(status.includes("SOLUCION") ? "Novedad solucionada" : "Novedad Dropi");
    riskScore += status.includes("SOLUCION") ? 220 : 760;
    severity = status.includes("SOLUCION") ? "warning" : "danger";
  }
  if (status.includes("SIN MOV")) {
    reasons.push("Sin movimientos");
    riskScore += 720;
    severity = "danger";
  }
  if (status.includes("DEVOL")) {
    reasons.push("Devolución");
    riskScore += 820;
    severity = "danger";
  }
  if (!order.guia_envio && order.activo) {
    reasons.push("Sin guía");
    riskScore += 280;
    if (severity === "neutral") severity = "warning";
  }
  if (ageHours !== null && stage === "ultima_milla" && ageHours >= 24) {
    reasons.push("Reparto prolongado");
    riskScore += 360;
    if (severity !== "danger") severity = "warning";
  }
  if (ageHours !== null && (stage === "bodega" || stage === "transito") && ageHours >= 48) {
    reasons.push("Sin movimiento");
    riskScore += 340;
    if (severity !== "danger") severity = "warning";
  }
  if (stage === "finalizado" && status.includes("ENTREG")) {
    reasons.push("Entregado");
    severity = "success";
    riskScore = Math.max(0, riskScore - 300);
  }
  if (stage === "transito" || stage === "ultima_milla") {
    riskScore += 80;
    if (severity === "neutral") severity = "primary";
  }

  const valueAtRisk = severity === "danger" || severity === "warning" ? amount(order.total) : 0;

  return {
    order,
    stage,
    stageLabel: stageLabel(stage),
    status,
    latestEventAt,
    ageHours,
    ageLabel: formatAge(ageHours),
    severity,
    riskLabel: reasons[0] ?? stageLabel(stage),
    riskScore,
    reasons: reasons.length ? reasons : [stageLabel(stage)],
    suggestedAction: suggestedAction(order, stage, status, reasons),
    valueAtRisk
  };
}

export function buildDropiSignals(
  orders: Order[],
  history: StatusHistory[] = [],
  country?: CountryCode | null
) {
  return orders
    .filter((order) => !country || order.pais === country)
    .map((order) => buildDropiOrderSignal(order, history))
    .sort(
      (first, second) =>
        second.riskScore - first.riskScore || second.valueAtRisk - first.valueAtRisk
    );
}

export function buildDropiRiskAlerts(signals: DropiOrderSignal[], country?: CountryCode | null) {
  const countryQuery = country ? `pais=${country}&` : "";
  const definitions: Array<{
    id: string;
    title: string;
    description: string;
    matcher: (signal: DropiOrderSignal) => boolean;
    severity: DropiSignalSeverity;
    href: string;
  }> = [
    {
      id: "office",
      title: "Reclame en oficina",
      description: "Pedidos esperando acción del cliente en oficina.",
      matcher: (signal) => signal.status.includes("RECLAME"),
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=reclame_oficina`
    },
    {
      id: "novedad",
      title: "Novedad Dropi",
      description: "Incidencias abiertas o recientes de transportadora.",
      matcher: (signal) => signal.status.includes("NOVED") && !signal.status.includes("SOLUCION"),
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=novedad_dropi`
    },
    {
      id: "stalled",
      title: "Sin movimiento",
      description: "Pedidos quietos en bodega, terminal o transporte.",
      matcher: (signal) =>
        signal.status.includes("SIN MOV") || signal.reasons.includes("Sin movimiento"),
      severity: "warning",
      href: `/ordenes?${countryQuery}filter=sin_movimiento`
    },
    {
      id: "returns",
      title: "Devolución",
      description: "Pedidos entrando o marcados en devolución.",
      matcher: (signal) => signal.status.includes("DEVOL"),
      severity: "danger",
      href: `/ordenes?${countryQuery}filter=devolucion_dropi`
    },
    {
      id: "missing-guide",
      title: "Sin guía",
      description: "Pedidos activos sin guía de envío registrada.",
      matcher: (signal) => signal.reasons.includes("Sin guía"),
      severity: "warning",
      href: `/ordenes?${countryQuery}filter=sin_guia`
    }
  ];

  return definitions.map<DropiRiskAlert>((definition) => {
    const matches = signals.filter(definition.matcher);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      count: matches.length,
      value: matches.reduce((total, signal) => total + amount(signal.order.total), 0),
      severity: definition.severity,
      href: definition.href
    };
  });
}

export function buildDropiPipeline(signals: DropiOrderSignal[], country?: CountryCode | null) {
  const countryQuery = country ? `pais=${country}&` : "";

  return pipelineStages.map<DropiPipelineStage>((stage) => {
    const matches = signals.filter((signal) => signal.stage === stage.key);
    const filter =
      stage.key === "novedad"
        ? "novedad_dropi"
        : stage.key === "ultima_milla"
          ? "en_ruta"
          : "todas";

    return {
      key: stage.key,
      label: stage.label,
      count: matches.length,
      value: matches.reduce((total, signal) => total + amount(signal.order.total), 0),
      href: `/ordenes?${countryQuery}filter=${filter}`
    };
  });
}

export function buildCriticalLogisticsInbox(signals: DropiOrderSignal[]) {
  return signals
    .filter((signal) => signal.severity === "danger" || signal.severity === "warning")
    .slice(0, 8);
}

export function buildCourierScores(signals: DropiOrderSignal[]) {
  const grouped = signals.reduce<Record<string, CourierScore>>((accumulator, signal) => {
    const name = signal.order.transportadora || "Sin transportadora";
    const current =
      accumulator[name] ??
      ({
        name,
        total: 0,
        delivered: 0,
        novedades: 0,
        devoluciones: 0,
        enRuta: 0,
        atRisk: 0,
        valueAtRisk: 0,
        averageAgeHours: null,
        healthScore: 100
      } satisfies CourierScore);

    current.total += 1;
    if (signal.status.includes("ENTREG")) current.delivered += 1;
    if (signal.status.includes("NOVED")) current.novedades += 1;
    if (signal.status.includes("DEVOL")) current.devoluciones += 1;
    if (isEnRutaOrder(signal.order)) current.enRuta += 1;
    if (signal.severity === "danger" || signal.severity === "warning") {
      current.atRisk += 1;
      current.valueAtRisk += amount(signal.order.total);
    }
    if (signal.ageHours !== null) {
      current.averageAgeHours =
        current.averageAgeHours === null
          ? signal.ageHours
          : Math.round((current.averageAgeHours * (current.total - 1) + signal.ageHours) / current.total);
    }

    accumulator[name] = current;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .map((score) => ({
      ...score,
      healthScore: Math.max(
        0,
        Math.min(
          100,
          100 -
            score.novedades * 10 -
            score.devoluciones * 15 -
            score.atRisk * 8 -
            Math.min(score.averageAgeHours ?? 0, 96) / 6
        )
      )
    }))
    .sort((first, second) => first.healthScore - second.healthScore || second.atRisk - first.atRisk);
}

export function buildRevenueAtRiskByStatus(signals: DropiOrderSignal[]) {
  const grouped = signals
    .filter((signal) => signal.valueAtRisk > 0)
    .reduce<Record<string, DropiStatusRisk>>((accumulator, signal) => {
      const status = signal.riskLabel || signal.status || "Sin datos";
      const current =
        accumulator[status] ??
        ({
          status,
          count: 0,
          value: 0,
          severity: signal.severity
        } satisfies DropiStatusRisk);

      current.count += 1;
      current.value += amount(signal.order.total);
      if (signal.severity === "danger") current.severity = "danger";
      accumulator[status] = current;
      return accumulator;
    }, {});

  return Object.values(grouped)
    .sort((first, second) => second.value - first.value)
    .slice(0, 6);
}

export function severityClasses(severity: DropiSignalSeverity) {
  const classes: Record<DropiSignalSeverity, string> = {
    danger: "border-danger/30 bg-danger/[0.14] text-danger",
    warning: "border-warning/30 bg-warning/[0.14] text-warning",
    primary: "border-primary/30 bg-primary/[0.14] text-primary",
    success: "border-success/30 bg-success/[0.14] text-success",
    neutral: "border-slate-400/20 bg-white/[0.07] text-muted"
  };

  return classes[severity];
}

export function signalValueLabel(signal: DropiOrderSignal) {
  return signal.valueAtRisk ? formatCurrency(signal.valueAtRisk) : formatCurrency(signal.order.total);
}

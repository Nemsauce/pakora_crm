import {
  buildCourierPerformance,
  buildLogisticsPipeline,
  buildLogisticsRiskAlerts,
  buildLogisticsSignal,
  buildOrderIntelligence,
  buildRevenueRiskBuckets,
  classifyLogisticsStage,
  logisticsStageLabel,
  severityClasses,
  signalValueLabel,
  type CourierPerformance,
  type LogisticsPipelineStage,
  type LogisticsRiskAlert,
  type LogisticsSignal,
  type LogisticsStage,
  type RevenueRiskBucket,
  type SignalSeverity
} from "@/lib/order-intelligence";
import type { CountryCode, Order, StatusHistory } from "@/lib/types";

export type DropiLogisticsStage = LogisticsStage;
export type DropiSignalSeverity = SignalSeverity;
export type DropiOrderSignal = LogisticsSignal;
export type DropiRiskAlert = LogisticsRiskAlert;
export type CourierScore = CourierPerformance;
export type DropiPipelineStage = LogisticsPipelineStage;
export type DropiStatusRisk = RevenueRiskBucket;

export { normalizeDropiStatus, formatAge } from "@/lib/order-intelligence";
export { severityClasses, signalValueLabel };

export function classifyDropiStage(value?: string | null) {
  return classifyLogisticsStage(value);
}

export function stageLabel(stage: LogisticsStage) {
  return logisticsStageLabel(stage);
}

export function buildDropiOrderSignal(order: Order, history: StatusHistory[] = []) {
  return buildLogisticsSignal(order, history);
}

export function buildDropiSignals(
  orders: Order[],
  history: StatusHistory[] = [],
  country?: CountryCode | null
) {
  return buildOrderIntelligence(orders, [], history, [], country)
    .map((item) => item.logistics)
    .sort(
      (first, second) =>
        second.riskScore - first.riskScore || second.valueAtRisk - first.valueAtRisk
    );
}

export function buildDropiRiskAlerts(signals: LogisticsSignal[], country?: CountryCode | null) {
  const intelligence = signals.map((signal) => ({
    order: signal.order,
    pendingTasks: [],
    tasks: [],
    comments: [],
    history: [],
    logistics: signal,
    value: Number(signal.order.total ?? 0),
    isAtRisk: signal.valueAtRisk > 0 || signal.order.estado_crm === "novedad" || signal.order.nivel_riesgo === "alto",
    valueAtRisk: signal.valueAtRisk,
    isHighRiskCustomer: signal.order.activo === true && signal.order.nivel_riesgo === "alto",
    isCrmNovedad: signal.order.estado_crm === "novedad",
    isReturned: signal.order.estado_crm === "devolucion" || signal.stage === "devolucion",
    isCanceled: signal.order.estado_crm === "cancelado" || signal.stage === "cancelado",
    isDelivered: signal.order.estado_crm === "entregado" || signal.stage === "entregado",
    latestComment: null
  }));

  return buildLogisticsRiskAlerts(intelligence, country);
}

export function buildDropiPipeline(signals: LogisticsSignal[], country?: CountryCode | null) {
  const intelligence = signals.map((signal) => ({
    order: signal.order,
    pendingTasks: [],
    tasks: [],
    comments: [],
    history: [],
    logistics: signal,
    value: Number(signal.order.total ?? 0),
    isAtRisk: signal.valueAtRisk > 0 || signal.order.estado_crm === "novedad" || signal.order.nivel_riesgo === "alto",
    valueAtRisk: signal.valueAtRisk,
    isHighRiskCustomer: signal.order.activo === true && signal.order.nivel_riesgo === "alto",
    isCrmNovedad: signal.order.estado_crm === "novedad",
    isReturned: signal.order.estado_crm === "devolucion" || signal.stage === "devolucion",
    isCanceled: signal.order.estado_crm === "cancelado" || signal.stage === "cancelado",
    isDelivered: signal.order.estado_crm === "entregado" || signal.stage === "entregado",
    latestComment: null
  }));

  return buildLogisticsPipeline(intelligence, country);
}

export function buildCriticalLogisticsInbox(signals: LogisticsSignal[]) {
  return signals
    .filter((signal) => signal.severity === "danger" || signal.severity === "warning")
    .slice(0, 8);
}

export function buildCourierScores(signals: LogisticsSignal[]) {
  const intelligence = signals.map((signal) => ({
    order: signal.order,
    pendingTasks: [],
    tasks: [],
    comments: [],
    history: [],
    logistics: signal,
    value: Number(signal.order.total ?? 0),
    isAtRisk: signal.valueAtRisk > 0 || signal.order.estado_crm === "novedad" || signal.order.nivel_riesgo === "alto",
    valueAtRisk: signal.valueAtRisk,
    isHighRiskCustomer: signal.order.activo === true && signal.order.nivel_riesgo === "alto",
    isCrmNovedad: signal.order.estado_crm === "novedad",
    isReturned: signal.order.estado_crm === "devolucion" || signal.stage === "devolucion",
    isCanceled: signal.order.estado_crm === "cancelado" || signal.stage === "cancelado",
    isDelivered: signal.order.estado_crm === "entregado" || signal.stage === "entregado",
    latestComment: null
  }));

  return buildCourierPerformance(intelligence);
}

export function buildRevenueAtRiskByStatus(signals: LogisticsSignal[], country?: CountryCode | null) {
  const intelligence = signals.map((signal) => ({
    order: signal.order,
    pendingTasks: [],
    tasks: [],
    comments: [],
    history: [],
    logistics: signal,
    value: Number(signal.order.total ?? 0),
    isAtRisk: signal.valueAtRisk > 0 || signal.order.estado_crm === "novedad" || signal.order.nivel_riesgo === "alto",
    valueAtRisk: signal.valueAtRisk,
    isHighRiskCustomer: signal.order.activo === true && signal.order.nivel_riesgo === "alto",
    isCrmNovedad: signal.order.estado_crm === "novedad",
    isReturned: signal.order.estado_crm === "devolucion" || signal.stage === "devolucion",
    isCanceled: signal.order.estado_crm === "cancelado" || signal.stage === "cancelado",
    isDelivered: signal.order.estado_crm === "entregado" || signal.stage === "entregado",
    latestComment: null
  }));

  return buildRevenueRiskBuckets(intelligence, country);
}

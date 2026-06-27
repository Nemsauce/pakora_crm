import { countryFlag, countryLabel } from "@/lib/country";
import {
  buildOrderIntelligence,
  type OrderIntelligence,
  type SignalSeverity
} from "@/lib/order-intelligence";
import type { CountryCode, Order, StatusHistory } from "@/lib/types";

export type FinanceDatePreset = "all" | "month" | "30d" | "7d" | "custom";

export interface FinanceDateRange {
  preset: FinanceDatePreset;
  from: string;
  to: string;
}

export interface FinanceMetric {
  value: number;
  estimated: boolean;
  missing: number;
}

export interface FinanceRiskBucket {
  id: string;
  label: string;
  count: number;
  value: number;
  severity: SignalSeverity;
  href: string;
}

export interface FinanceAgingBucket {
  id: string;
  label: string;
  count: number;
  value: number;
}

export interface CourierFinanceSummary {
  name: string;
  total: number;
  valueInRoute: number;
  valueAtRisk: number;
  collected: FinanceMetric;
  settled: FinanceMetric;
  estimatedMargin: FinanceMetric;
  returnRate: number;
}

export interface ProductFinanceSummary {
  name: string;
  units: number;
  orders: number;
  grossSales: number;
  valueAtRisk: number;
  estimatedMargin: FinanceMetric;
  lostMargin: FinanceMetric;
}

export interface FinanceCountrySummary {
  country: CountryCode;
  label: string;
  flag: string;
  orders: number;
  cash: {
    grossSales: number;
    deliveredValue: number;
    inRouteValue: number;
    collected: FinanceMetric;
    settled: FinanceMetric;
    pendingCollection: FinanceMetric;
    pendingSettlement: FinanceMetric;
  };
  margin: {
    grossSales: number;
    productCost: FinanceMetric;
    shippingCost: FinanceMetric;
    returnCost: FinanceMetric;
    codFee: FinanceMetric;
    totalCost: FinanceMetric;
    estimatedMargin: FinanceMetric;
    potentialMargin: FinanceMetric;
    lostMargin: FinanceMetric;
  };
  riskBuckets: FinanceRiskBucket[];
  agingBuckets: FinanceAgingBucket[];
  couriers: CourierFinanceSummary[];
  products: ProductFinanceSummary[];
}

export interface FinanceDashboard {
  countries: FinanceCountrySummary[];
  activeCountries: FinanceCountrySummary[];
  range: FinanceDateRange;
}

const countryCodes: CountryCode[] = ["CO", "MX"];

function amount(value?: number | null) {
  return Number(value ?? 0);
}

function hasNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metric(value: number, missing = 0): FinanceMetric {
  return {
    value,
    estimated: missing > 0,
    missing
  };
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
}

function orderDate(order: Order) {
  return order.fecha ?? order.created_at ?? null;
}

function countryFromOrder(order: Order): CountryCode | null {
  return order.pais === "CO" || order.pais === "MX" ? order.pais : null;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function defaultFinanceRange(): FinanceDateRange {
  return {
    preset: "all",
    from: "",
    to: ""
  };
}

export function rangeForPreset(preset: FinanceDatePreset, now = new Date()): FinanceDateRange {
  if (preset === "all" || preset === "custom") return defaultFinanceRange();

  const to = dateOnly(now);
  const from = new Date(now);

  if (preset === "month") {
    from.setDate(1);
  }
  if (preset === "30d") {
    from.setDate(from.getDate() - 29);
  }
  if (preset === "7d") {
    from.setDate(from.getDate() - 6);
  }

  return { preset, from: dateOnly(from), to };
}

function matchesRange(order: Order, range: FinanceDateRange) {
  if (range.preset === "all" || (!range.from && !range.to)) return true;

  const date = timestamp(orderDate(order));
  if (!date) return false;

  const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : 0;
  const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : Infinity;

  return date >= from && date <= to;
}

function sumKnown<T>(items: T[], read: (item: T) => number | null | undefined) {
  return items.reduce(
    (summary, item) => {
      const value = read(item);
      if (hasNumber(value)) {
        summary.value += value;
      } else {
        summary.missing += 1;
      }
      return summary;
    },
    { value: 0, missing: 0 }
  );
}

function costMetric(items: OrderIntelligence[], read: (order: Order) => number | null | undefined) {
  const activeCostOrders = items.filter((item) => item.value > 0);
  const summary = sumKnown(activeCostOrders, (item) => read(item.order));
  return metric(summary.value, summary.missing);
}

function totalCost(item: OrderIntelligence) {
  const fields = [
    item.order.costo_producto,
    item.order.costo_envio,
    item.order.comision_cod,
    item.order.costo_devolucion
  ];
  const missing = fields.filter((value) => !hasNumber(value)).length;
  const value = fields.reduce<number>((total, field) => total + (hasNumber(field) ? field : 0), 0);
  return { value, missing };
}

function orderPotentialMargin(item: OrderIntelligence) {
  const baseCosts = [item.order.costo_producto, item.order.costo_envio, item.order.comision_cod];
  const missing = baseCosts.filter((value) => !hasNumber(value)).length;
  const cost = baseCosts.reduce<number>((total, field) => total + (hasNumber(field) ? field : 0), 0);
  return { value: item.value - cost, missing };
}

function orderEstimatedMargin(item: OrderIntelligence) {
  const settlementBase = hasNumber(item.order.valor_liquidado)
    ? item.order.valor_liquidado
    : hasNumber(item.order.valor_recaudado)
      ? item.order.valor_recaudado
      : item.isDelivered
        ? item.value
        : null;
  const costs = totalCost(item);

  if (!hasNumber(settlementBase)) {
    return { value: 0, missing: costs.missing + 1 };
  }

  return {
    value: settlementBase - costs.value,
    missing: costs.missing
  };
}

function sumMargins(items: OrderIntelligence[], mode: "estimated" | "potential" | "lost") {
  return items.reduce(
    (summary, item) => {
      const margin =
        mode === "estimated"
          ? orderEstimatedMargin(item)
          : orderPotentialMargin(item);

      if (mode === "lost" && !item.isCanceled && !item.isReturned) return summary;

      summary.value += margin.value;
      summary.missing += margin.missing;
      return summary;
    },
    { value: 0, missing: 0 }
  );
}

function financeHref(country: CountryCode, filter: string) {
  return `/ordenes?pais=${country}&filter=${filter}`;
}

function buildRiskBuckets(items: OrderIntelligence[], country: CountryCode) {
  const definitions: Array<{
    id: string;
    label: string;
    filter: string;
    severity: SignalSeverity;
    matcher: (item: OrderIntelligence) => boolean;
  }> = [
    {
      id: "novedad_activa",
      label: "Novedad activa",
      filter: "novedad_dropi",
      severity: "danger",
      matcher: (item) => item.logistics.stage === "novedad_activa"
    },
    {
      id: "sin_movimiento",
      label: "Sin movimiento",
      filter: "sin_movimiento",
      severity: "warning",
      matcher: (item) => item.logistics.reasons.includes("Sin movimiento")
    },
    {
      id: "reclame_oficina",
      label: "Reclame oficina",
      filter: "reclame_oficina",
      severity: "danger",
      matcher: (item) => item.logistics.stage === "reclame_oficina"
    },
    {
      id: "sin_guia",
      label: "Sin guía",
      filter: "sin_guia",
      severity: "warning",
      matcher: (item) => item.logistics.stage === "sin_guia"
    },
    {
      id: "devolucion",
      label: "Devolución",
      filter: "devolucion_dropi",
      severity: "danger",
      matcher: (item) => item.logistics.stage === "devolucion"
    },
    {
      id: "cancelado",
      label: "Cancelado",
      filter: "canceladas",
      severity: "danger",
      matcher: (item) => item.isCanceled
    }
  ];

  return definitions.map<FinanceRiskBucket>((definition) => {
    const matches = items.filter(definition.matcher);
    return {
      id: definition.id,
      label: definition.label,
      count: matches.length,
      value: matches.reduce((total, item) => total + item.value, 0),
      severity: definition.severity,
      href: financeHref(country, definition.filter)
    };
  });
}

function buildAgingBuckets(items: OrderIntelligence[]) {
  const definitions = [
    { id: "0-24", label: "0-24h", min: 0, max: 24 },
    { id: "1-2d", label: "1-2d", min: 24, max: 72 },
    { id: "3-5d", label: "3-5d", min: 72, max: 144 },
    { id: "6-10d", label: "6-10d", min: 144, max: 264 },
    { id: "10d", label: "+10d", min: 264, max: Infinity }
  ];
  const activeMoney = items.filter((item) => !item.isDelivered && !item.isCanceled && !item.isReturned);

  return definitions.map<FinanceAgingBucket>((definition) => {
    const matches = activeMoney.filter((item) => {
      const age = item.logistics.ageHours ?? 0;
      return age >= definition.min && age < definition.max;
    });

    return {
      id: definition.id,
      label: definition.label,
      count: matches.length,
      value: matches.reduce((total, item) => total + item.value, 0)
    };
  });
}

function buildCourierSummaries(items: OrderIntelligence[]) {
  const grouped = items.reduce<Record<string, OrderIntelligence[]>>((accumulator, item) => {
    const name = item.order.transportadora || "Sin transportadora";
    accumulator[name] = [...(accumulator[name] ?? []), item];
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map<CourierFinanceSummary>(([name, group]) => {
      const collected = sumKnown(group, (item) => item.order.valor_recaudado);
      const settled = sumKnown(group, (item) => item.order.valor_liquidado);
      const estimatedMargin = sumMargins(group, "estimated");
      const returned = group.filter((item) => item.isReturned).length;

      return {
        name,
        total: group.length,
        valueInRoute: group
          .filter((item) => item.order.estado_crm === "en_ruta" || item.logistics.stage === "transito" || item.logistics.stage === "ultima_milla")
          .reduce((total, item) => total + item.value, 0),
        valueAtRisk: group.reduce((total, item) => total + item.valueAtRisk, 0),
        collected: metric(collected.value, collected.missing),
        settled: metric(settled.value, settled.missing),
        estimatedMargin: metric(estimatedMargin.value, estimatedMargin.missing),
        returnRate: group.length ? Math.round((returned / group.length) * 100) : 0
      };
    })
    .sort((first, second) => second.valueAtRisk - first.valueAtRisk || second.total - first.total)
    .slice(0, 8);
}

function buildProductSummaries(items: OrderIntelligence[]) {
  const grouped = items.reduce<Record<string, OrderIntelligence[]>>((accumulator, item) => {
    const name = item.order.nombre_producto || "Sin producto";
    accumulator[name] = [...(accumulator[name] ?? []), item];
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map<ProductFinanceSummary>(([name, group]) => {
      const estimatedMargin = sumMargins(group, "estimated");
      const lostMargin = sumMargins(group, "lost");

      return {
        name,
        units: group.reduce((total, item) => total + amount(item.order.cantidad), 0),
        orders: group.length,
        grossSales: group.reduce((total, item) => total + item.value, 0),
        valueAtRisk: group.reduce((total, item) => total + item.valueAtRisk, 0),
        estimatedMargin: metric(estimatedMargin.value, estimatedMargin.missing),
        lostMargin: metric(lostMargin.value, lostMargin.missing)
      };
    })
    .sort((first, second) => second.valueAtRisk - first.valueAtRisk || second.grossSales - first.grossSales)
    .slice(0, 8);
}

function buildCountrySummary(intelligence: OrderIntelligence[], country: CountryCode): FinanceCountrySummary {
  const items = intelligence.filter((item) => countryFromOrder(item.order) === country);
  const deliveredItems = items.filter((item) => item.isDelivered);
  const inRouteItems = items.filter(
    (item) => item.order.estado_crm === "en_ruta" || item.logistics.stage === "transito" || item.logistics.stage === "ultima_milla"
  );
  const collected = sumKnown(items, (item) => item.order.valor_recaudado);
  const settled = sumKnown(items, (item) => item.order.valor_liquidado);
  const productCost = costMetric(items, (order) => order.costo_producto);
  const shippingCost = costMetric(items, (order) => order.costo_envio);
  const returnCost = costMetric(items.filter((item) => item.isReturned), (order) => order.costo_devolucion);
  const codFee = costMetric(items, (order) => order.comision_cod);
  const estimatedMargin = sumMargins(items, "estimated");
  const potentialMargin = sumMargins(items, "potential");
  const lostMargin = sumMargins(items, "lost");
  const deliveredValue = deliveredItems.reduce((total, item) => total + item.value, 0);
  const pendingCollection = Math.max(0, deliveredValue - collected.value);
  const pendingSettlement = Math.max(0, collected.value - settled.value);

  return {
    country,
    label: countryLabel(country),
    flag: countryFlag(country),
    orders: items.length,
    cash: {
      grossSales: items.reduce((total, item) => total + item.value, 0),
      deliveredValue,
      inRouteValue: inRouteItems.reduce((total, item) => total + item.value, 0),
      collected: metric(collected.value, collected.missing),
      settled: metric(settled.value, settled.missing),
      pendingCollection: metric(pendingCollection, collected.missing),
      pendingSettlement: metric(pendingSettlement, settled.missing)
    },
    margin: {
      grossSales: items.reduce((total, item) => total + item.value, 0),
      productCost,
      shippingCost,
      returnCost,
      codFee,
      totalCost: metric(
        productCost.value + shippingCost.value + returnCost.value + codFee.value,
        productCost.missing + shippingCost.missing + returnCost.missing + codFee.missing
      ),
      estimatedMargin: metric(estimatedMargin.value, estimatedMargin.missing),
      potentialMargin: metric(potentialMargin.value, potentialMargin.missing),
      lostMargin: metric(lostMargin.value, lostMargin.missing)
    },
    riskBuckets: buildRiskBuckets(items, country),
    agingBuckets: buildAgingBuckets(items),
    couriers: buildCourierSummaries(items),
    products: buildProductSummaries(items)
  };
}

export function buildFinanceDashboard(
  orders: Order[],
  history: StatusHistory[],
  range: FinanceDateRange,
  country?: CountryCode | null
): FinanceDashboard {
  const scopedOrders = orders.filter((order) => (!country || order.pais === country) && matchesRange(order, range));
  const intelligence = buildOrderIntelligence(scopedOrders, [], history, [], country);
  const countries = countryCodes.map((code) => buildCountrySummary(intelligence, code));

  return {
    countries,
    activeCountries: country ? countries.filter((summary) => summary.country === country) : countries,
    range
  };
}

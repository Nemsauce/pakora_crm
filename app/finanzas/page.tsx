"use client";

import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/Glass";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { useCountry } from "@/components/CountryProvider";
import {
  buildFinanceDashboard,
  defaultFinanceRange,
  rangeForPreset,
  type CourierFinanceSummary,
  type FinanceAgingBucket,
  type FinanceCountrySummary,
  type FinanceDatePreset,
  type FinanceMetric,
  type FinanceRiskBucket,
  type ProductFinanceSummary
} from "@/lib/finance-intelligence";
import { formatMoney, formatToday } from "@/lib/format";
import { severityClasses } from "@/lib/order-intelligence";
import { supabase } from "@/lib/supabase";
import type { CountryCode, Order, StatusHistory } from "@/lib/types";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Landmark,
  Package2,
  Receipt,
  Truck,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface FinanceData {
  orders: Order[];
  history: StatusHistory[];
}

const initialFinanceData: FinanceData = {
  orders: [],
  history: []
};

const presets: Array<{ value: FinanceDatePreset; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "month", label: "Este mes" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "7d", label: "Últimos 7 días" }
];

const csvColumns: Array<keyof Pick<
  Order,
  | "numero_orden"
  | "fecha"
  | "pais"
  | "nombre"
  | "apellido"
  | "telefono"
  | "ciudad"
  | "departamento"
  | "transportadora"
  | "nombre_producto"
  | "total"
  | "costo_producto"
  | "costo_envio"
  | "costo_devolucion"
  | "comision_cod"
  | "valor_recaudado"
  | "valor_liquidado"
  | "estado_dropi"
  | "estado_crm"
  | "estado_recaudo"
  | "estado_liquidacion"
  | "fecha_entrega_real"
  | "fecha_recaudo"
  | "fecha_liquidacion"
>> = [
  "numero_orden",
  "fecha",
  "pais",
  "nombre",
  "apellido",
  "telefono",
  "ciudad",
  "departamento",
  "transportadora",
  "nombre_producto",
  "total",
  "costo_producto",
  "costo_envio",
  "costo_devolucion",
  "comision_cod",
  "valor_recaudado",
  "valor_liquidado",
  "estado_dropi",
  "estado_crm",
  "estado_recaudo",
  "estado_liquidacion",
  "fecha_entrega_real",
  "fecha_recaudo",
  "fecha_liquidacion"
];

function financeOrderDate(order: Order) {
  return order.fecha ?? order.created_at ?? null;
}

function financeTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function orderMatchesFinanceRange(order: Order, range: ReturnType<typeof defaultFinanceRange>) {
  if (range.preset === "all" || (!range.from && !range.to)) return true;

  const date = financeTimestamp(financeOrderDate(order));
  if (!date) return false;

  const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : 0;
  const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : Infinity;

  return date >= from && date <= to;
}

function csvValue(value: Order[keyof Order]) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  return `"${String(value).replaceAll('"', '""')}"`;
}

function buildFinanceCsv(orders: Order[]) {
  const header = csvColumns.join(",");
  const rows = orders.map((order) =>
    csvColumns.map((column) => csvValue(order[column])).join(",")
  );

  return [header, ...rows].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function FinancePage() {
  const { countryMode, concreteCountry } = useCountry();
  const [data, setData] = useState<FinanceData>(initialFinanceData);
  const [range, setRange] = useState(defaultFinanceRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let ordersQuery = supabase.from("orders").select("*").order("fecha", { ascending: false });
      if (concreteCountry) {
        ordersQuery = ordersQuery.eq("pais", concreteCountry);
      }

      const ordersResult = await ordersQuery;
      if (ordersResult.error) throw ordersResult.error;

      const loadedOrders = (ordersResult.data ?? []) as Order[];
      const orderIds = loadedOrders.map((order) => order.id);
      const historyResult = orderIds.length
        ? await supabase
            .from("status_history")
            .select("*")
            .in("order_id", orderIds)
            .order("registrado_en", { ascending: false })
        : { data: [], error: null };

      if (historyResult.error) throw historyResult.error;

      setData({
        orders: loadedOrders,
        history: (historyResult.data ?? []) as StatusHistory[]
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar Finanzas");
    } finally {
      setLoading(false);
    }
  }, [concreteCountry]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("finance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_history" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const finance = useMemo(
    () => buildFinanceDashboard(data.orders, data.history, range, concreteCountry),
    [data.orders, data.history, range, concreteCountry]
  );
  const exportOrders = useMemo(
    () => data.orders.filter((order) => orderMatchesFinanceRange(order, range)),
    [data.orders, range]
  );

  function handlePreset(preset: FinanceDatePreset) {
    setRange(rangeForPreset(preset));
  }

  function handleDateChange(key: "from" | "to", value: string) {
    setRange((current) => ({
      ...current,
      preset: "custom",
      [key]: value
    }));
  }

  function handleExportCsv() {
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filenameCountry = countryMode === "todos" ? "todos" : countryMode;
    const csv = buildFinanceCsv(exportOrders);

    downloadCsv(csv, `pakora-finanzas-${filenameCountry}-${filenameDate}.csv`);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-medium text-primary">{formatToday()}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
            Finanzas COD {countryMode === "todos" ? "" : finance.activeCountries[0]?.label}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Caja, recaudo, margen y dinero en riesgo separados por moneda local.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2 overflow-x-auto">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePreset(preset.value)}
                className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition ${
                  range.preset === preset.value
                    ? "border-primary/30 bg-primary/[0.15] text-primary"
                    : "border-border bg-white/[0.07] text-muted hover:border-primary/30 hover:text-slate-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={range.from}
              onChange={(event) => handleDateChange("from", event.target.value)}
              className="h-10 rounded-2xl border border-border bg-white/[0.07] px-3 text-sm text-slate-50 outline-none backdrop-blur-xl focus:border-primary/50"
            />
            <input
              type="date"
              value={range.to}
              onChange={(event) => handleDateChange("to", event.target.value)}
              className="h-10 rounded-2xl border border-border bg-white/[0.07] px-3 text-sm text-slate-50 outline-none backdrop-blur-xl focus:border-primary/50"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || exportOrders.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/[0.15] px-4 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-primary/[0.22] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <FinanceLoading />
      ) : finance.activeCountries.some((summary) => summary.orders > 0) ? (
        <div className="space-y-8">
          {countryMode === "todos" ? <CountryMoneySplit summaries={finance.activeCountries} /> : null}
          {finance.activeCountries.map((summary) => (
            <CountryFinanceSection key={summary.country} summary={summary} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CircleDollarSign}
          title="Sin datos financieros"
          message="No hay órdenes dentro del país o rango seleccionado."
        />
      )}
    </div>
  );
}

function FinanceLoading() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </section>
      <ListSkeleton rows={6} />
    </div>
  );
}

function CountryMoneySplit({ summaries }: { summaries: FinanceCountrySummary[] }) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={Landmark} title="CO / MX sin mezcla de moneda" />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {summaries.map((summary) => (
          <div key={summary.country} className="rounded-2xl border border-border bg-white/[0.052] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  {summary.flag} {summary.label}
                </p>
                <p className="mt-1 text-xs text-muted">{summary.orders} órdenes en el rango</p>
              </div>
              <p className="text-xl font-bold text-slate-50">
                {formatMoney(summary.cash.grossSales, summary.country)}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniMoney label="Recaudado" value={summary.cash.collected.value} country={summary.country} />
              <MiniMoney label="Riesgo" value={riskTotal(summary)} country={summary.country} />
              <MiniMoney label="Margen" value={summary.margin.estimatedMargin.value} country={summary.country} />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function CountryFinanceSection({ summary }: { summary: FinanceCountrySummary }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">
            {summary.flag} {summary.label}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">Cockpit financiero</h2>
        </div>
        <span className="w-fit rounded-full border border-border bg-white/[0.07] px-3 py-2 text-sm text-muted">
          {summary.orders} órdenes analizadas
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard
          title="Venta bruta"
          value={summary.cash.grossSales}
          country={summary.country}
          icon={CircleDollarSign}
          href={`/ordenes?pais=${summary.country}`}
        />
        <FinanceMetricCard
          title="Entregado"
          value={summary.cash.deliveredValue}
          country={summary.country}
          icon={Package2}
          href={`/ordenes?pais=${summary.country}&filter=entregadas`}
        />
        <FinanceMetricCard
          title="Recaudado"
          metric={summary.cash.collected}
          country={summary.country}
          icon={CreditCard}
        />
        <FinanceMetricCard
          title="Margen estimado"
          metric={summary.margin.estimatedMargin}
          country={summary.country}
          icon={Receipt}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FinancePanel title="Caja COD" icon={Landmark}>
          <MoneyRows
            country={summary.country}
            rows={[
              ["Vendido", summary.cash.grossSales],
              ["En ruta", summary.cash.inRouteValue],
              ["Entregado", summary.cash.deliveredValue],
              ["Recaudado", summary.cash.collected],
              ["Liquidado", summary.cash.settled],
              ["Pendiente recaudo", summary.cash.pendingCollection],
              ["Pendiente liquidación", summary.cash.pendingSettlement]
            ]}
          />
        </FinancePanel>

        <FinancePanel title="Margen" icon={Receipt}>
          <MoneyRows
            country={summary.country}
            rows={[
              ["Venta bruta", summary.margin.grossSales],
              ["Costo producto", summary.margin.productCost],
              ["Envío", summary.margin.shippingCost],
              ["Comisión COD", summary.margin.codFee],
              ["Costo devolución", summary.margin.returnCost],
              ["Costo total", summary.margin.totalCost],
              ["Margen estimado", summary.margin.estimatedMargin],
              ["Margen perdido", summary.margin.lostMargin]
            ]}
          />
        </FinancePanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <RiskMoneyPanel summary={summary} />
        <AgingMoneyPanel summary={summary} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <CourierFinancePanel items={summary.couriers} country={summary.country} />
        <ProductFinancePanel items={summary.products} country={summary.country} />
      </section>
    </section>
  );
}

function FinanceMetricCard({
  title,
  value,
  metric,
  country,
  icon: Icon,
  href
}: {
  title: string;
  value?: number;
  metric?: FinanceMetric;
  country: CountryCode;
  icon: LucideIcon;
  href?: string;
}) {
  const amount = metric?.value ?? value ?? 0;
  const estimated = metric?.estimated ?? false;
  const content = (
    <GlassCard className="group min-h-[7.75rem] p-5" hover={Boolean(href)} variant="metric">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-400/10 bg-white/[0.06] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition group-hover:border-sky-400/30">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-normal text-slate-50">
        {formatMoney(amount, country)}
      </p>
      {estimated ? <p className="mt-2 text-xs text-warning">Estimado incompleto</p> : null}
    </GlassCard>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl">
      {content}
    </Link>
  ) : (
    content
  );
}

function FinancePanel({
  title,
  icon,
  children
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={icon} title={title} />
      <div className="mt-5">{children}</div>
    </GlassCard>
  );
}

function MoneyRows({
  rows,
  country
}: {
  rows: Array<[string, number | FinanceMetric]>;
  country: CountryCode;
}) {
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
        >
          <span className="text-sm text-muted">{label}</span>
          <MoneyValue value={value} country={country} />
        </div>
      ))}
    </div>
  );
}

function MoneyValue({ value, country }: { value: number | FinanceMetric; country: CountryCode }) {
  const metric = typeof value === "number" ? null : value;
  const amount = typeof value === "number" ? value : value.value;

  return (
    <span className="text-right">
      <span className="block text-sm font-semibold text-slate-50">{formatMoney(amount, country)}</span>
      {metric?.estimated ? (
        <span className="mt-1 block text-[11px] text-warning">Estimado incompleto</span>
      ) : null}
    </span>
  );
}

function RiskMoneyPanel({ summary }: { summary: FinanceCountrySummary }) {
  return (
    <FinancePanel title="Dinero en riesgo" icon={AlertTriangle}>
      <div className="space-y-3">
        {summary.riskBuckets.map((bucket) => (
          <Link
            key={bucket.id}
            href={bucket.href}
            className="block rounded-2xl border border-border bg-white/[0.052] p-3 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-50">{bucket.label}</p>
                <p className="mt-1 text-xs text-muted">{bucket.count} pedidos</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses(bucket.severity)}`}>
                {formatMoney(bucket.value, summary.country)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </FinancePanel>
  );
}

function AgingMoneyPanel({ summary }: { summary: FinanceCountrySummary }) {
  const maxValue = Math.max(...summary.agingBuckets.map((bucket) => bucket.value), 1);

  return (
    <FinancePanel title="Aging de dinero" icon={Clock3}>
      <div className="space-y-4">
        {summary.agingBuckets.map((bucket) => {
          const width = `${Math.max(5, Math.round((bucket.value / maxValue) * 100))}%`;
          return (
            <div key={bucket.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-100">{bucket.label}</span>
                <span className="text-muted">
                  {formatMoney(bucket.value, summary.country)} · {bucket.count}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(56,189,248,0.28)]"
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </FinancePanel>
  );
}

function CourierFinancePanel({
  items,
  country
}: {
  items: CourierFinanceSummary[];
  country: CountryCode;
}) {
  return (
    <FinancePanel title="Transportadoras" icon={Truck}>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white/[0.052] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{item.total} pedidos · {item.returnRate}% devolución</p>
                </div>
                <p className="text-right text-sm font-semibold text-slate-50">
                  {formatMoney(item.valueAtRisk, country)}
                  <span className="mt-1 block text-xs font-normal text-muted">en riesgo</span>
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <MiniMoney label="Ruta" value={item.valueInRoute} country={country} />
                <MiniMoney label="Recaudo" value={item.collected.value} country={country} />
                <MiniMoney label="Margen" value={item.estimatedMargin.value} country={country} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sin datos de transportadora.</p>
      )}
    </FinancePanel>
  );
}

function ProductFinancePanel({
  items,
  country
}: {
  items: ProductFinanceSummary[];
  country: CountryCode;
}) {
  return (
    <FinancePanel title="Productos" icon={Boxes}>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white/[0.052] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-50">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{item.orders} pedidos · {item.units} unidades</p>
                </div>
                <p className="text-right text-sm font-semibold text-slate-50">
                  {formatMoney(item.grossSales, country)}
                  <span className="mt-1 block text-xs font-normal text-muted">vendido</span>
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <MiniMoney label="Riesgo" value={item.valueAtRisk} country={country} />
                <MiniMoney label="Margen" value={item.estimatedMargin.value} country={country} />
                <MiniMoney label="Pérdida" value={item.lostMargin.value} country={country} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sin datos de producto.</p>
      )}
    </FinancePanel>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white/[0.07] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
    </div>
  );
}

function MiniMoney({ label, value, country }: { label: string; value: number; country: CountryCode }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.05] px-2 py-2">
      <p className="truncate text-xs font-semibold text-slate-50">{formatMoney(value, country)}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function riskTotal(summary: FinanceCountrySummary) {
  return summary.riskBuckets.reduce((total, bucket) => total + bucket.value, 0);
}

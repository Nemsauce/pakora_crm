"use client";

import { Badge } from "@/components/Badge";
import { CountryBadge } from "@/components/CountryBadge";
import { useCountry } from "@/components/CountryProvider";
import { EmptyState } from "@/components/EmptyState";
import { glassClass } from "@/components/Glass";
import { ListSkeleton } from "@/components/Skeleton";
import {
  buildOrderIntelligence,
  severityClasses,
  type OrderIntelligence
} from "@/lib/order-intelligence";
import {
  formatCurrency,
  fullName,
  isEnRutaOrder,
  normalize,
  orderNumber,
  orderNumberClass
} from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Order, StatusHistory, TaskWithOrder } from "@/lib/types";
import { Boxes, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterKey =
  | "todas"
  | "activas"
  | "en_ruta"
  | "novedad"
  | "riesgo_alto"
  | "entregadas"
  | "canceladas"
  | "sin_movimiento"
  | "reclame_oficina"
  | "novedad_dropi"
  | "devolucion_dropi"
  | "sin_guia";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "activas", label: "Activas" },
  { key: "en_ruta", label: "En Ruta" },
  { key: "novedad", label: "Novedad CRM" },
  { key: "riesgo_alto", label: "Riesgo Alto" },
  { key: "entregadas", label: "Entregadas" },
  { key: "canceladas", label: "Canceladas" },
  { key: "sin_movimiento", label: "Sin movimiento" },
  { key: "reclame_oficina", label: "Reclame oficina" },
  { key: "novedad_dropi", label: "Novedad Dropi" },
  { key: "devolucion_dropi", label: "Devolución" },
  { key: "sin_guia", label: "Sin guía" }
];

export default function OrdersPage() {
  const router = useRouter();
  const { concreteCountry } = useCountry();
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [tasks, setTasks] = useState<TaskWithOrder[]>([]);
  const [pendingTaskCounts, setPendingTaskCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      let ordersQuery = supabase.from("orders").select("*").order("fecha", { ascending: false });

      if (concreteCountry) {
        ordersQuery = ordersQuery.eq("pais", concreteCountry);
      }

      const ordersResult = await ordersQuery;

      const firstError = ordersResult.error;
      if (firstError) throw firstError;

      const loadedOrders = (ordersResult.data ?? []) as Order[];
      const orderIds = loadedOrders.map((order) => order.id);
      const [tasksResult, historyResult] = orderIds.length
        ? await Promise.all([
            supabase
              .from("tasks")
              .select("*")
              .eq("estado", "pendiente")
              .in("order_id", orderIds),
            supabase
              .from("status_history")
              .select("*")
              .in("order_id", orderIds)
              .order("registrado_en", { ascending: false })
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      const scopedError = tasksResult.error ?? historyResult.error;
      if (scopedError) throw scopedError;

      const loadedTasks = ((tasksResult.data ?? []) as TaskWithOrder[]).map((task) => {
        const order = loadedOrders.find((item) => item.id === task.order_id) ?? null;
        return { ...task, order, orders: order };
      });

      const counts = loadedTasks.reduce<
        Record<string, number>
      >((accumulator, task) => {
        accumulator[task.order_id] = (accumulator[task.order_id] ?? 0) + 1;
        return accumulator;
      }, {});

      setOrders(loadedOrders);
      setTasks(loadedTasks);
      setHistory((historyResult.data ?? []) as StatusHistory[]);
      setPendingTaskCounts(counts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las órdenes");
    } finally {
      setLoading(false);
    }
  }, [concreteCountry]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_history" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get("filter");

    if (filters.some((item) => item.key === filterParam)) {
      setFilter(filterParam as FilterKey);
    }
  }, []);

  const intelligenceByOrderId = useMemo(() => {
    const entries = buildOrderIntelligence(orders, tasks, history, [], concreteCountry).map((item) => [
      item.order.id,
      item
    ]);
    return new Map(entries as Array<[string, OrderIntelligence]>);
  }, [orders, tasks, history, concreteCountry]);

  const filteredOrders = useMemo(() => {
    const term = normalize(search);

    return orders.filter((order) => {
      const intelligence = intelligenceByOrderId.get(order.id);
      const signal = intelligence?.logistics;
      const matchesSearch =
        !term ||
        [
          order.nombre,
          order.apellido,
          order.numero_orden,
          order.ciudad,
          order.telefono
        ]
          .map(normalize)
          .some((value) => value.includes(term));

      if (!matchesSearch) return false;

      if (filter === "activas") return order.activo === true;
      if (filter === "en_ruta") return isEnRutaOrder(order);
      if (filter === "novedad") return order.estado_crm === "novedad";
      if (filter === "riesgo_alto") return order.nivel_riesgo === "alto";
      if (filter === "entregadas") return order.estado_crm === "entregado";
      if (filter === "canceladas") return order.estado_crm === "cancelado";
      if (filter === "sin_movimiento") {
        return signal?.reasons.includes("Sin movimiento") ?? false;
      }
      if (filter === "reclame_oficina") return signal?.stage === "reclame_oficina";
      if (filter === "novedad_dropi") return signal?.stage === "novedad_activa";
      if (filter === "devolucion_dropi") return signal?.stage === "devolucion";
      if (filter === "sin_guia") return signal?.stage === "sin_guia";

      return true;
    });
  }, [orders, search, filter, intelligenceByOrderId]);

  function openOrder(orderId: string) {
    router.push(`/ordenes/${orderId}`);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Gestión de pedidos</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">Órdenes</h1>
        </div>

        <div className="relative w-full lg:w-[34rem]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar orden, cliente, ciudad o teléfono"
            className="h-11 w-full rounded-2xl border border-border bg-white/[0.07] px-10 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition placeholder:text-muted focus:border-primary/50"
          />
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => {
          const active = item.key === filter;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-primary/30 bg-primary/[0.15] text-primary"
                  : "border-border bg-white/[0.07] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-primary/30 hover:text-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : filteredOrders.length ? (
        <>
          <section className={`${glassClass("panel", false, "hidden overflow-hidden md:block")}`}>
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-border bg-white/[0.05]">
                <tr className="text-xs font-medium text-muted">
                  <th className="px-4 py-3">Orden</th>
                  <th className="px-4 py-3">País</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Transportadora</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Señal Dropi</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Riesgo</th>
                  <th className="px-4 py-3 text-right">Tareas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const intelligence = intelligenceByOrderId.get(order.id);
                  const actionLabel = visibleActionLabel(intelligence);
                  const valueAtRisk = intelligence?.valueAtRisk ?? 0;

                  return (
                    <tr
                      key={order.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openOrder(order.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") openOrder(order.id);
                      }}
                      className="cursor-pointer transition hover:bg-white/[0.06]"
                    >
                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/ordenes/${order.id}`}
                          className={`font-semibold transition hover:text-primary/80 ${orderNumberClass(order)}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {orderNumber(order)}
                        </Link>
                        <p className="mt-1 text-xs text-muted">{formatCurrency(order.total)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <CountryBadge country={order.pais} />
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-medium text-slate-50">
                        {fullName(order)}
                      </td>
                      <td className="max-w-[15rem] px-4 py-4 align-top text-sm text-muted">
                        <span className="line-clamp-2">{order.nombre_producto || "Sin producto"}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted">
                        {order.ciudad || "Sin ciudad"}
                        <p className="mt-1 text-xs text-muted">{order.departamento || ""}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted">
                        {order.transportadora || "Sin transportadora"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge kind="dropi" value={order.estado_dropi} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <IntelligencePill intelligence={intelligence} />
                      </td>
                      <td className="max-w-[12rem] px-4 py-4 align-top text-sm">
                        {actionLabel ? (
                          <p className="font-medium text-slate-100">{actionLabel}</p>
                        ) : null}
                        {valueAtRisk ? (
                          <p className="mt-1 text-xs text-muted">{formatCurrency(valueAtRisk)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge kind="risk" value={order.nivel_riesgo} />
                      </td>
                      <td className="px-4 py-4 text-right align-top text-sm font-semibold text-slate-50">
                        {pendingTaskCounts[order.id] ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="space-y-3 md:hidden">
            {filteredOrders.map((order) => {
              const intelligence = intelligenceByOrderId.get(order.id);
              const actionLabel = visibleActionLabel(intelligence);
              const valueAtRisk = intelligence?.valueAtRisk ?? 0;

              return (
                <Link
                  key={order.id}
                  href={`/ordenes/${order.id}`}
                  className={glassClass("default", true, "block p-4")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${orderNumberClass(order)}`}>
                        {orderNumber(order)}
                      </p>
                      <h2 className="mt-2 truncate text-sm font-semibold text-slate-50">
                        {fullName(order)}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {order.nombre_producto || "Sin producto"}
                      </p>
                    </div>
                    <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <CountryBadge country={order.pais} />
                    <Badge kind="dropi" value={order.estado_dropi} />
                    <IntelligencePill intelligence={intelligence} />
                    <Badge kind="risk" value={order.nivel_riesgo} />
                    <span className="inline-flex items-center rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      {pendingTaskCounts[order.id] ?? 0} tareas
                    </span>
                  </div>

                  <div className="mt-4 grid gap-1 text-sm text-muted">
                    <span>
                      {order.ciudad || "Sin ciudad"}
                      {order.departamento ? `, ${order.departamento}` : ""}
                    </span>
                    <span>{order.transportadora || "Sin transportadora"}</span>
                    {actionLabel || valueAtRisk ? (
                      <span>
                        {[actionLabel, valueAtRisk ? formatCurrency(valueAtRisk) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </section>
        </>
      ) : (
        <EmptyState
          icon={Boxes}
          title="No hay órdenes"
          message="Ajusta la búsqueda o cambia el filtro seleccionado."
        />
      )}
    </div>
  );
}

function visibleActionLabel(intelligence?: OrderIntelligence) {
  const label = intelligence?.logistics.suggestedAction.label;
  if (!label || label === "Ver orden") return null;
  return label;
}

function IntelligencePill({ intelligence }: { intelligence?: OrderIntelligence }) {
  const signal = intelligence?.logistics;

  if (!signal) {
    return (
      <span className="inline-flex rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
        Sin señal
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${severityClasses(signal.severity)}`}
      title={`${signal.displayStatus} · ${signal.ageLabel}`}
    >
      <span className="truncate">{signal.riskLabel}</span>
      <span className="text-[10px] opacity-80">{signal.ageLabel}</span>
    </span>
  );
}

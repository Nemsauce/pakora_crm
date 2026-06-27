"use client";

import { Badge } from "@/components/Badge";
import { CountryBadge } from "@/components/CountryBadge";
import { useCountry } from "@/components/CountryProvider";
import { EmptyState } from "@/components/EmptyState";
import { glassClass } from "@/components/Glass";
import { ListSkeleton } from "@/components/Skeleton";
import {
  formatCurrency,
  fullName,
  isEnRutaOrder,
  normalize,
  orderNumber
} from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Order, Task } from "@/lib/types";
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
  | "canceladas";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "activas", label: "Activas" },
  { key: "en_ruta", label: "En Ruta" },
  { key: "novedad", label: "Novedad" },
  { key: "riesgo_alto", label: "Riesgo Alto" },
  { key: "entregadas", label: "Entregadas" },
  { key: "canceladas", label: "Canceladas" }
];

export default function OrdersPage() {
  const router = useRouter();
  const { concreteCountry } = useCountry();
  const [orders, setOrders] = useState<Order[]>([]);
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

      const [ordersResult, tasksResult] = await Promise.all([
        ordersQuery,
        supabase.from("tasks").select("id, order_id, estado").eq("estado", "pendiente")
      ]);

      const firstError = ordersResult.error ?? tasksResult.error;
      if (firstError) throw firstError;

      const counts = ((tasksResult.data ?? []) as Pick<Task, "order_id">[]).reduce<
        Record<string, number>
      >((accumulator, task) => {
        accumulator[task.order_id] = (accumulator[task.order_id] ?? 0) + 1;
        return accumulator;
      }, {});

      setOrders((ordersResult.data ?? []) as Order[]);
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

  const filteredOrders = useMemo(() => {
    const term = normalize(search);

    return orders.filter((order) => {
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

      return true;
    });
  }, [orders, search, filter]);

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
                  <th className="px-4 py-3">Envio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Riesgo</th>
                  <th className="px-4 py-3 text-right">Tareas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => (
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
                        className="font-semibold text-primary hover:text-primary/80"
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
                      <Badge kind="risk" value={order.nivel_riesgo} />
                    </td>
                    <td className="px-4 py-4 text-right align-top text-sm font-semibold text-slate-50">
                      {pendingTaskCounts[order.id] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-3 md:hidden">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/ordenes/${order.id}`}
                className={glassClass("default", true, "block p-4")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{orderNumber(order)}</p>
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
                </div>
              </Link>
            ))}
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

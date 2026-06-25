import {
  crmStatusLabels,
  labelFromMap,
  originLabels,
  riskLabels,
  taskStatusLabels,
  taskTypeLabels
} from "@/lib/format";
import type { RiskLevel, TaskStatus, TaskType } from "@/lib/types";

const baseClass =
  "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none";

const riskClasses: Record<RiskLevel, string> = {
  bajo: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  medio: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning",
  alto: "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.15)] text-danger",
  sin_datos: "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted"
};

const taskTypeClasses: Record<TaskType, string> = {
  llamar_confirmacion: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning",
  nota_voz: "border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.15)] text-[#A78BFA]",
  mensaje_confirmacion: "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] text-primary",
  notificar_guia: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  presionar_entrega: "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.15)] text-danger",
  cerrar_orden: "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted",
  manual: "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted"
};

const taskStatusClasses: Record<TaskStatus, string> = {
  pendiente: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning",
  hecha: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  omitida: "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted"
};

const crmStatusClasses: Record<string, string> = {
  nuevo: "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] text-primary",
  contactado: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning",
  confirmado: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  en_ruta: "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] text-primary",
  novedad: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning",
  entregado: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  cancelado: "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.15)] text-danger",
  devolucion: "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.15)] text-danger"
};

const originClasses: Record<string, string> = {
  manual: "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted",
  sheet: "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] text-primary",
  task_completado: "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success",
  automatico: "border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.15)] text-[#A78BFA]"
};

function dropiClass(value?: string | null) {
  const status = (value ?? "").toUpperCase();

  if (status.includes("ENTREG")) {
    return "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.15)] text-success";
  }
  if (status.includes("NOVED") || status.includes("DEVOL")) {
    return "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.15)] text-warning";
  }
  if (status.includes("CANCEL") || status.includes("RECHAZ")) {
    return "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.15)] text-danger";
  }
  if (
    status.includes("ADMITIDA") ||
    status.includes("EN PROCESAMIENTO") ||
    status.includes("EN REPARTO") ||
    status.includes("EN TRANSPORTE") ||
    status.includes("EN BODEGA") ||
    status.includes("EN TERMINAL")
  ) {
    return "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] text-primary";
  }

  return "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted";
}

interface BadgeProps {
  value?: string | null;
  kind: "risk" | "taskType" | "taskStatus" | "crmStatus" | "dropi" | "origin";
  className?: string;
}

export function Badge({ value, kind, className = "" }: BadgeProps) {
  const normalizedValue = value ?? "sin_datos";
  let classes = "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted";
  let label = normalizedValue;

  if (kind === "risk") {
    classes = riskClasses[(normalizedValue as RiskLevel) || "sin_datos"] ?? riskClasses.sin_datos;
    label = labelFromMap(normalizedValue, riskLabels);
  }

  if (kind === "taskType") {
    classes = taskTypeClasses[normalizedValue as TaskType] ?? taskTypeClasses.manual;
    label = labelFromMap(normalizedValue, taskTypeLabels);
  }

  if (kind === "taskStatus") {
    classes = taskStatusClasses[normalizedValue as TaskStatus] ?? taskStatusClasses.pendiente;
    label = labelFromMap(normalizedValue, taskStatusLabels);
  }

  if (kind === "crmStatus") {
    classes =
      crmStatusClasses[normalizedValue] ??
      "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted";
    label = labelFromMap(normalizedValue, crmStatusLabels);
  }

  if (kind === "dropi") {
    classes = dropiClass(value);
    label = value || "Sin estado";
  }

  if (kind === "origin") {
    classes =
      originClasses[normalizedValue] ??
      "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.15)] text-muted";
    label = labelFromMap(normalizedValue, originLabels);
  }

  return <span className={`${baseClass} ${classes} ${className}`}>{label}</span>;
}

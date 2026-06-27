import type { HTMLAttributes } from "react";

type GlassVariant = "default" | "metric" | "task" | "panel" | "control";

const variantClasses: Record<GlassVariant, string> = {
  default: "pakora-glass",
  metric: "pakora-glass pakora-glass-metric",
  task: "pakora-glass pakora-glass-task",
  panel: "pakora-glass pakora-glass-panel",
  control: "pakora-glass pakora-glass-control"
};

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  variant?: GlassVariant;
}

export function glassClass(variant: GlassVariant = "default", hover = false, className = "") {
  return `${variantClasses[variant]} ${hover ? "pakora-glass-hover" : ""} ${className}`.trim();
}

export function GlassCard({
  className = "",
  hover = true,
  variant = "default",
  ...props
}: GlassCardProps) {
  return (
    <div
      className={glassClass(variant, hover, className)}
      {...props}
    />
  );
}

export function GlassPanel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <GlassCard className={className} hover={false} variant="panel" {...props} />;
}

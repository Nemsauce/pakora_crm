import { Badge } from "@/components/Badge";

export function RiskBadge({ value }: { value?: string | null }) {
  return <Badge kind="risk" value={value} />;
}

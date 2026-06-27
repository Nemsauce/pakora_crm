import { Badge } from "@/components/Badge";

export function StatusBadge({ value }: { value?: string | null }) {
  return <Badge kind="crmStatus" value={value} />;
}

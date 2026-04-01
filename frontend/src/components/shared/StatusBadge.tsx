import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS, type ProposalStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ProposalStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant="secondary" className={`${STATUS_COLORS[status]} rounded-md border-0 shadow-sm font-medium`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

import { cn } from "@/lib/utils";
import { STATUS_CLASSES, STATUS_LABELS } from "@/lib/order-utils";

type Props = { status: string; className?: string };

export function OrderStatusBadge({ status, className }: Props) {
  return (
    <span className={cn(
      "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
      STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600",
      className
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

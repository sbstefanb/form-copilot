import type { ReportStatus } from "@/lib/report-types";
import { STATUS_LABELS } from "@/lib/report-types";

const STYLES: Record<ReportStatus, string> = {
  u_izradi: "bg-status-draft text-status-draft-foreground",
  ceka_analizu: "bg-status-pending text-status-pending-foreground",
  zavrsen: "bg-status-done text-status-done-foreground",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

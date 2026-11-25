import type { RunStatus, StepStatus } from "@/lib/types";

type BadgeVariant = RunStatus | StepStatus | "on" | "off";

export default function RunStatusBadge({ status }: { status: BadgeVariant }) {
  return (
    <span className={`badge badge-${status}`}>
      {status}
    </span>
  );
}

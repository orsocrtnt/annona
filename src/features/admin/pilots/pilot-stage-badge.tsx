import type { PilotStage } from "@prisma/client";
import { STAGE_TONE, stageLabel } from "@/features/admin/pilots/pilot-format";
import { cn } from "@/lib/utils";

export function PilotStageBadge({ stage, className }: { stage: PilotStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold leading-none",
        STAGE_TONE[stage],
        className
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}

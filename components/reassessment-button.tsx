"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startReassessment } from "@/lib/actions/reassessment";
import { Button } from "@/components/ui/button";

export function ReassessmentButton({ engagementFrameworkId }: { engagementFrameworkId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await startReassessment({ engagementFrameworkId });
          } catch (err) {
            const digest = (err as { digest?: string } | null)?.digest;
            if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
            toast.error(err instanceof Error ? err.message : "Failed to start reassessment");
          }
        });
      }}
    >
      Start reassessment cycle
    </Button>
  );
}

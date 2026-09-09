import { notFound } from "next/navigation";

import { getCycleContext } from "@/lib/queries";
import { getEnrichedCycleControls } from "@/lib/derived";
import { ImprovementPlanList } from "@/components/improvement-plan-list";

export default async function ImprovementPlanPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const enriched = await getEnrichedCycleControls(cycleId);
  const withGaps = enriched.filter((r) => r.remediation != null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Improvement plan</h1>
        <p className="text-sm text-muted-foreground">
          Every gap on this page was created automatically when a rating produced target &gt; current. Nothing
          here originates as free text.
        </p>
      </div>
      <ImprovementPlanList
        items={withGaps.map((r) => ({
          remediationItemId: r.remediation!.id,
          code: r.control.code,
          name: r.control.name,
          gap: r.gap,
          currentLevel: r.rating?.maturityLevel ?? null,
          targetLevel: r.rating?.targetLevel ?? null,
          owner: r.remediation!.owner ?? "",
          effortEstimate: r.remediation!.effortEstimate ?? "",
          targetQuarter: r.remediation!.targetQuarter ?? "",
          status: r.remediation!.status,
          lifecycleState: r.remediation!.lifecycleState,
          costInternal: r.remediation!.costInternal ?? "",
          costExternalOnceOff: r.remediation!.costExternalOnceOff ?? "",
          costExternalRecurring: r.remediation!.costExternalRecurring ?? "",
          costTooling: r.remediation!.costTooling ?? "",
        }))}
      />
    </div>
  );
}

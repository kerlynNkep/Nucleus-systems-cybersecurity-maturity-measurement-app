import { notFound } from "next/navigation";

import { getCycleContext, getCycleControls } from "@/lib/queries";
import { ValidationList } from "@/components/validation-list";

export default async function ValidationPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const allControls = await getCycleControls(cycleId);
  const submitted = allControls.filter((c) => c.inScope && c.response?.status === "submitted");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessor validation</h1>
        <p className="text-sm text-muted-foreground">
          Accept each response, or flag it for interview. The flagged set becomes the interview agenda.
        </p>
      </div>
      <ValidationList
        items={submitted.map((c) => ({
          cycleControlId: c.cycleControlId,
          code: c.control.code,
          name: c.control.name,
          currentStateNarrative: c.response?.currentStateNarrative ?? "",
          evidenceHeldNarrative: c.response?.evidenceHeldNarrative ?? "",
          decision: c.review?.decision ?? null,
          notes: c.review?.notes ?? "",
        }))}
      />
    </div>
  );
}

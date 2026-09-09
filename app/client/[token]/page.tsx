import { notFound } from "next/navigation";

import { getClientTokenContext, getCycleControls } from "@/lib/queries";
import { ClientQuestionnaire } from "@/components/client-questionnaire";

export default async function ClientQuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenContext = await getClientTokenContext(token);
  if (!tokenContext) notFound();

  const allControls = await getCycleControls(tokenContext.cycleId);
  const inScope = allControls.filter((c) => c.inScope);
  const alreadyLocked = inScope.some((c) => c.response?.status === "submitted");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tokenContext.clientName}</h1>
        <p className="text-sm text-muted-foreground">
          {tokenContext.engagementName} · {tokenContext.frameworkCode} assessment questionnaire
        </p>
      </div>
      <ClientQuestionnaire
        token={token}
        cycleId={tokenContext.cycleId}
        locked={alreadyLocked}
        controls={inScope.map((c) => ({
          cycleControlId: c.cycleControlId,
          code: c.control.code,
          name: c.control.name,
          description: c.control.description,
          domainCode: c.domainCode,
          currentStateNarrative: c.response?.currentStateNarrative ?? "",
          evidenceHeldNarrative: c.response?.evidenceHeldNarrative ?? "",
          evidenceRegisterRef: c.response?.evidenceRegisterRef ?? "",
          status: c.response?.status ?? "draft",
        }))}
      />
    </div>
  );
}

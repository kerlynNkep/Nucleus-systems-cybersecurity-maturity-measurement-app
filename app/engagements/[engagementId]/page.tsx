import Link from "next/link";
import { notFound } from "next/navigation";

import { getEngagementDetail } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReassessmentButton } from "@/components/reassessment-button";

const STATUS_LABEL: Record<string, string> = {
  scoping: "Scoping",
  questionnaire: "Client questionnaire",
  validation: "Assessor validation",
  rating: "Rating",
  complete: "Complete",
};

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = await params;
  const detail = await getEngagementDetail(engagementId);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{detail.engagement.clientName}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.engagement.name} · Assessor: {detail.engagement.assessorName}
        </p>
      </div>

      {detail.engagementFrameworks.map((ef) => {
        const cycles = detail.cyclesByFramework[ef.id] ?? [];
        const latest = cycles[cycles.length - 1];
        return (
          <Card key={ef.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {ef.frameworkCode} — {ef.frameworkName}
                </span>
                {latest?.status === "complete" && (
                  <ReassessmentButton engagementFrameworkId={ef.id} />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {cycles.map((cycle) => (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent/40"
                >
                  <span>Cycle {cycle.cycleNumber}</span>
                  <Badge variant="outline">{STATUS_LABEL[cycle.status] ?? cycle.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

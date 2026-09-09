import Link from "next/link";
import { notFound } from "next/navigation";

import { getCycleContext } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const STAGES = [
  { key: "scoping", label: "1. Scoping", href: (id: string) => `/cycles/${id}/scoping` },
  { key: "client-link", label: "2. Client questionnaire link", href: (id: string) => `/cycles/${id}/client-link` },
  { key: "validation", label: "3. Assessor validation", href: (id: string) => `/cycles/${id}/validation` },
  { key: "rating", label: "4. Rating & rollup", href: (id: string) => `/cycles/${id}/rating` },
  { key: "improvement-plan", label: "5. Improvement plan", href: (id: string) => `/cycles/${id}/improvement-plan` },
  { key: "register", label: "6. Register", href: (id: string) => `/cycles/${id}/register` },
];

export default async function CycleHubPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {ctx.clientName} — Cycle {ctx.cycle.cycleNumber}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ctx.frameworkCode} — {ctx.frameworkName} · Status:{" "}
          <Badge variant="outline">{ctx.cycle.status}</Badge>
        </p>
        {ctx.cycle.cycleNumber > 1 && (
          <Link href={`/cycles/${cycleId}/delta`} className="text-sm text-primary underline-offset-4 hover:underline">
            View delta vs previous cycle
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STAGES.map((stage) => (
          <Link key={stage.key} href={stage.href(cycleId)}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle className="text-base">{stage.label}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

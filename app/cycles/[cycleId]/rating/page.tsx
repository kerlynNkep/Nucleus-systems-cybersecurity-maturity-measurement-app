import { notFound } from "next/navigation";

import { getCycleContext, getMaturityScale } from "@/lib/queries";
import { getRollups } from "@/lib/derived";
import { RatingGrid } from "@/components/rating-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RatingPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const [{ domainRollups, overall, enriched }, scale] = await Promise.all([
    getRollups(cycleId, ctx.frameworkId),
    getMaturityScale(ctx.frameworkId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Rating &amp; rollup</h1>
        <p className="text-sm text-muted-foreground">
          Score, gap, level description and recommendation are all derived — never hand-entered.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {domainRollups.map((d) => (
          <Card key={d.domainId}>
            <CardHeader>
              <CardTitle className="text-sm">
                {d.domainCode} · weight {(d.weight * 100).toFixed(0)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>Current: {d.currentAvg?.toFixed(2) ?? "—"}</p>
              <p>Target: {d.targetAvg?.toFixed(2) ?? "—"}</p>
              <p>Rated: {d.ratedCount} / {d.applicableCount}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="sm:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Weighted overall (Σweight·avg / Σweight — weights need not sum to 1)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Current {overall.currentAvg?.toFixed(2) ?? "—"} → Target {overall.targetAvg?.toFixed(2) ?? "—"} (weight
            sum {overall.weightSum.toFixed(2)})
          </CardContent>
        </Card>
      </div>

      <RatingGrid
        scaleLevels={scale.map((s) => s.levelValue)}
        rows={enriched.map((r) => ({
          cycleControlId: r.cycleControlId,
          code: r.control.code,
          name: r.control.name,
          category: r.control.category,
          inScope: r.inScope,
          maturityLevel: r.rating?.maturityLevel ?? null,
          targetLevel: r.rating?.targetLevel ?? null,
          gap: r.gap,
          levelDescription: r.levelDescription,
          recommendationText: r.recommendationText,
        }))}
      />
    </div>
  );
}

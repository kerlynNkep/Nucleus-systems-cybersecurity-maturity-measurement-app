import { notFound } from "next/navigation";

import { getCycleContext, getPreviousCycleRating } from "@/lib/queries";
import { getEnrichedCycleControls } from "@/lib/derived";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DeltaPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const enriched = await getEnrichedCycleControls(cycleId);
  const rows = await Promise.all(
    enriched
      .filter((r) => r.inScope)
      .map(async (r) => {
        const previous = await getPreviousCycleRating(cycleId, r.control.id);
        const currentLevel = r.rating?.maturityLevel ?? null;
        const previousLevel = previous?.maturityLevel ?? null;
        const change = currentLevel != null && previousLevel != null ? currentLevel - previousLevel : null;
        return { ...r, previousLevel, currentLevel, change };
      }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Delta — cycle {ctx.cycle.cycleNumber} vs cycle {ctx.cycle.cycleNumber - 1}
        </h1>
        <p className="text-sm text-muted-foreground">Change in maturity rating per control since the last cycle.</p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Control</TableHead>
              <TableHead>Previous</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.cycleControlId}>
                <TableCell>
                  {r.control.code} — {r.control.name}
                </TableCell>
                <TableCell>{r.previousLevel ?? "—"}</TableCell>
                <TableCell>{r.currentLevel ?? "—"}</TableCell>
                <TableCell>
                  {r.change == null ? (
                    "—"
                  ) : r.change > 0 ? (
                    <Badge className="bg-green-600 text-white">+{r.change}</Badge>
                  ) : r.change < 0 ? (
                    <Badge variant="destructive">{r.change}</Badge>
                  ) : (
                    <Badge variant="outline">No change</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

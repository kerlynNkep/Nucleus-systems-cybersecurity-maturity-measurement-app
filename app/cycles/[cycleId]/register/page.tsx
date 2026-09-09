import { notFound } from "next/navigation";

import { getCycleContext } from "@/lib/queries";
import { getRegisterEntries } from "@/lib/derived";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TRIGGER_LABEL: Record<string, string> = {
  MANDATE_SHORTFALL: "Mandate shortfall",
  FOUNDATIONAL_ABSENCE: "Foundational absence",
  OVERDUE: "Overdue",
  DEFERRED: "Deferred",
  ACCEPTED: "Accepted",
};

export default async function RegisterPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const entries = await getRegisterEntries(cycleId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Register</h1>
        <p className="text-sm text-muted-foreground">
          A gap lands here when someone decides not to close it — never because someone judged it dangerous. No
          likelihood/impact scoring, no severity field, no free-text entries: every row below is a control gap.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing on the register yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Control</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Gap</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Decision maker</TableHead>
                <TableHead>Review date</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.cycleControlId}>
                  <TableCell>
                    {e.control.code} — {e.control.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TRIGGER_LABEL[e.trigger]}</Badge>
                  </TableCell>
                  <TableCell>{e.gap}</TableCell>
                  <TableCell>{e.remediation?.decision ?? "—"}</TableCell>
                  <TableCell>{e.remediation?.decisionMaker ?? "—"}</TableCell>
                  <TableCell>
                    {e.remediation?.reviewDate ? new Date(e.remediation.reviewDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>{e.remediation?.lifecycleState}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

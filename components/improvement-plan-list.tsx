"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { transitionRemediationLifecycle, updateRemediationItem } from "@/lib/actions/improvement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  remediationItemId: string;
  code: string;
  name: string;
  gap: number | null;
  currentLevel: number | null;
  targetLevel: number | null;
  owner: string;
  effortEstimate: string;
  targetQuarter: string;
  status: "not_started" | "in_progress" | "complete";
  lifecycleState: "assessed" | "remediation_planned" | "deferred" | "accepted" | "registered" | "closed";
  costInternal: string;
  costExternalOnceOff: string;
  costExternalRecurring: string;
  costTooling: string;
};

export function ImprovementPlanList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Item>>(() => Object.fromEntries(items.map((i) => [i.remediationItemId, i])));
  const [decisionForm, setDecisionForm] = useState<{ id: string; toState: "deferred" | "accepted" } | null>(null);
  const [decisionMaker, setDecisionMaker] = useState("");
  const [rationale, setRationale] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [actor, setActor] = useState("Assessor");

  function save(item: Item) {
    startTransition(async () => {
      await updateRemediationItem({
        remediationItemId: item.remediationItemId,
        owner: item.owner,
        effortEstimate: item.effortEstimate,
        targetQuarter: item.targetQuarter,
        status: item.status,
        costInternal: item.costInternal || null,
        costExternalOnceOff: item.costExternalOnceOff || null,
        costExternalRecurring: item.costExternalRecurring || null,
        costTooling: item.costTooling || null,
      });
      toast.success("Saved");
      router.refresh();
    });
  }

  function transition(id: string, toState: Item["lifecycleState"]) {
    startTransition(async () => {
      try {
        await transitionRemediationLifecycle({ remediationItemId: id, toState, actor });
        toast.success(`Moved to ${toState}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Transition failed");
      }
    });
  }

  function submitDecision() {
    if (!decisionForm) return;
    startTransition(async () => {
      try {
        await transitionRemediationLifecycle({
          remediationItemId: decisionForm.id,
          toState: decisionForm.toState,
          actor,
          decisionMaker,
          rationale,
          reviewDate: reviewDate || undefined,
        });
        toast.success(`${decisionForm.toState === "deferred" ? "Deferred" : "Accepted"} — added to the register`);
        setDecisionForm(null);
        setDecisionMaker("");
        setRationale("");
        setReviewDate("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Transition failed");
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No open gaps yet — rate controls to generate remediation items.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 sm:w-64">
        <Label>Acting as</Label>
        <Input value={actor} onChange={(e) => setActor(e.target.value)} />
      </div>

      {items.map((item) => {
        const draft = drafts[item.remediationItemId];
        return (
          <Card key={item.remediationItemId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {item.code} — {item.name} (L{item.currentLevel ?? "?"} → L{item.targetLevel ?? "?"}, gap {item.gap})
                </span>
                <Badge variant="outline">{item.lifecycleState}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Owner" value={draft.owner} onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, owner: v } }))} />
                <Field
                  label="Effort estimate"
                  value={draft.effortEstimate}
                  onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, effortEstimate: v } }))}
                />
                <Field
                  label="Target quarter"
                  value={draft.targetQuarter}
                  onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, targetQuarter: v } }))}
                />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, status: v as Item["status"] } }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Internal cost" value={draft.costInternal} onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, costInternal: v } }))} />
                <Field label="External once-off" value={draft.costExternalOnceOff} onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, costExternalOnceOff: v } }))} />
                <Field label="External recurring" value={draft.costExternalRecurring} onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, costExternalRecurring: v } }))} />
                <Field label="Tooling cost" value={draft.costTooling} onChange={(v) => setDrafts((p) => ({ ...p, [item.remediationItemId]: { ...draft, costTooling: v } }))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => save(draft)}>
                  Save details
                </Button>
                {item.lifecycleState === "assessed" && (
                  <Button size="sm" disabled={isPending} onClick={() => transition(item.remediationItemId, "remediation_planned")}>
                    Plan remediation
                  </Button>
                )}
                {item.lifecycleState === "remediation_planned" && (
                  <>
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setDecisionForm({ id: item.remediationItemId, toState: "deferred" })}>
                      Defer
                    </Button>
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setDecisionForm({ id: item.remediationItemId, toState: "accepted" })}>
                      Accept
                    </Button>
                    <Button size="sm" disabled={isPending} onClick={() => transition(item.remediationItemId, "closed")}>
                      Mark closed
                    </Button>
                  </>
                )}
                {item.lifecycleState === "registered" && (
                  <Button size="sm" disabled={isPending} onClick={() => transition(item.remediationItemId, "closed")}>
                    Close
                  </Button>
                )}
              </div>
              {decisionForm?.id === item.remediationItemId && (
                <Card className="bg-muted/40">
                  <CardContent className="flex flex-col gap-2 pt-4">
                    <p className="text-sm font-medium">
                      {decisionForm.toState === "deferred" ? "Defer" : "Accept"} this gap — this will register it.
                    </p>
                    <Field label="Decision maker" value={decisionMaker} onChange={setDecisionMaker} />
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Rationale</Label>
                      <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:w-48">
                      <Label className="text-xs">Review date</Label>
                      <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={isPending} onClick={submitDecision}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDecisionForm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveControlResponseDraft, submitAndLockQuestionnaire } from "@/lib/actions/questionnaire";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ControlEntry = {
  cycleControlId: string;
  code: string;
  name: string;
  description: string;
  domainCode: string;
  currentStateNarrative: string;
  evidenceHeldNarrative: string;
  evidenceRegisterRef: string;
  status: "draft" | "submitted";
};

export function ClientQuestionnaire({
  token,
  cycleId,
  locked,
  controls,
}: {
  token: string;
  cycleId: string;
  locked: boolean;
  controls: ControlEntry[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, Pick<ControlEntry, "currentStateNarrative" | "evidenceHeldNarrative" | "evidenceRegisterRef">>>(
    () =>
      Object.fromEntries(
        controls.map((c) => [
          c.cycleControlId,
          {
            currentStateNarrative: c.currentStateNarrative,
            evidenceHeldNarrative: c.evidenceHeldNarrative,
            evidenceRegisterRef: c.evidenceRegisterRef,
          },
        ]),
      ),
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(controls.filter((c) => c.currentStateNarrative).map((c) => c.cycleControlId)),
  );
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const completeness = useMemo(() => {
    const done = controls.filter((c) => savedIds.has(c.cycleControlId)).length;
    return { done, total: controls.length };
  }, [controls, savedIds]);

  function saveOne(cycleControlId: string) {
    startTransition(async () => {
      await saveControlResponseDraft({ cycleControlId, ...values[cycleControlId] });
      setSavedIds((prev) => new Set(prev).add(cycleControlId));
      toast.success("Saved");
    });
  }

  function submitAll() {
    if (!name.trim()) {
      toast.error("Enter your name before submitting");
      return;
    }
    startTransition(async () => {
      await submitAndLockQuestionnaire({ cycleId, token, submittedBy: name });
      toast.success("Submitted and locked");
      router.refresh();
    });
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This questionnaire has been submitted and locked. Contact your Nucleus Systems engagement lead if
          something needs to change.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <p className="text-sm">
            Completeness: {completeness.done} / {completeness.total} controls have a saved current-state
            description.
          </p>
        </CardContent>
      </Card>

      {controls.map((c) => (
        <Card key={c.cycleControlId}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                {c.code} — {c.name}
              </span>
              {savedIds.has(c.cycleControlId) && <Badge variant="secondary">Saved</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{c.description}</p>
            <div className="flex flex-col gap-1.5">
              <Label>Describe your current state</Label>
              <Textarea
                value={values[c.cycleControlId]?.currentStateNarrative ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [c.cycleControlId]: { ...prev[c.cycleControlId], currentStateNarrative: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Evidence artefacts you hold</Label>
              <Textarea
                value={values[c.cycleControlId]?.evidenceHeldNarrative ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [c.cycleControlId]: { ...prev[c.cycleControlId], evidenceHeldNarrative: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Evidence register reference</Label>
              <Input
                value={values[c.cycleControlId]?.evidenceRegisterRef ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [c.cycleControlId]: { ...prev[c.cycleControlId], evidenceRegisterRef: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => saveOne(c.cycleControlId)}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit &amp; lock</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Once submitted, your responses become immutable. Any later change requires your Nucleus Systems
            assessor to record it as an amendment with a rationale.
          </p>
          <div className="flex flex-col gap-1.5 sm:w-64">
            <Label>Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Attesting on behalf of the org" />
          </div>
          <div>
            <Button disabled={isPending} onClick={submitAll}>
              Submit &amp; lock
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reviewResponse } from "@/lib/actions/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  cycleControlId: string;
  code: string;
  name: string;
  currentStateNarrative: string;
  evidenceHeldNarrative: string;
  decision: "accepted" | "flagged_for_interview" | null;
  notes: string;
};

export function ValidationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.cycleControlId, i.notes])),
  );

  const flagged = useMemo(() => items.filter((i) => i.decision === "flagged_for_interview"), [items]);

  function decide(cycleControlId: string, decision: "accepted" | "flagged_for_interview") {
    if (!reviewer.trim()) {
      toast.error("Enter your name as reviewer first");
      return;
    }
    startTransition(async () => {
      await reviewResponse({ cycleControlId, decision, reviewer, notes: notes[cycleControlId] });
      toast.success(decision === "accepted" ? "Accepted" : "Flagged for interview");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No submitted responses yet — waiting on the client questionnaire.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 sm:w-64">
        <Label>Reviewer</Label>
        <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All responses ({items.length})</TabsTrigger>
          <TabsTrigger value="agenda">Interview agenda ({flagged.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="flex flex-col gap-4 pt-4">
          {items.map((item) => (
            <ReviewCard
              key={item.cycleControlId}
              item={item}
              notes={notes[item.cycleControlId]}
              onNotesChange={(v) => setNotes((prev) => ({ ...prev, [item.cycleControlId]: v }))}
              onDecide={decide}
              disabled={isPending}
            />
          ))}
        </TabsContent>
        <TabsContent value="agenda" className="flex flex-col gap-4 pt-4">
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged for interview yet.</p>
          ) : (
            flagged.map((item) => (
              <ReviewCard
                key={item.cycleControlId}
                item={item}
                notes={notes[item.cycleControlId]}
                onNotesChange={(v) => setNotes((prev) => ({ ...prev, [item.cycleControlId]: v }))}
                onDecide={decide}
                disabled={isPending}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewCard({
  item,
  notes,
  onNotesChange,
  onDecide,
  disabled,
}: {
  item: Item;
  notes: string;
  onNotesChange: (v: string) => void;
  onDecide: (cycleControlId: string, decision: "accepted" | "flagged_for_interview") => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            {item.code} — {item.name}
          </span>
          {item.decision && (
            <Badge variant={item.decision === "accepted" ? "default" : "destructive"}>
              {item.decision === "accepted" ? "Accepted" : "Flagged"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm">
          <span className="font-medium">Current state: </span>
          {item.currentStateNarrative || "—"}
        </p>
        <p className="text-sm">
          <span className="font-medium">Evidence held: </span>
          {item.evidenceHeldNarrative || "—"}
        </p>
        <Textarea placeholder="Review notes" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" disabled={disabled} onClick={() => onDecide(item.cycleControlId, "accepted")}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={() => onDecide(item.cycleControlId, "flagged_for_interview")}
          >
            Flag for interview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

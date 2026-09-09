"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { finalizeScoping, saveScopingAnswers } from "@/lib/actions/engagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type Question = {
  id: string;
  code: string;
  category: string;
  questionText: string;
  helpText: string | null;
  existingAnswer: boolean | null;
  existingComment: string;
};

type AnswerState = "yes" | "no" | "unanswered";

export function ScopingForm({ cycleId, questions }: { cycleId: string; questions: Question[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() =>
    Object.fromEntries(
      questions.map((q) => [q.id, q.existingAnswer == null ? "unanswered" : q.existingAnswer ? "yes" : "no"]),
    ),
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.existingComment])),
  );
  const [clientUrl, setClientUrl] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions) {
      const list = map.get(q.category) ?? [];
      list.push(q);
      map.set(q.category, list);
    }
    return [...map.entries()];
  }, [questions]);

  function save() {
    startTransition(async () => {
      await saveScopingAnswers({
        cycleId,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id],
          comment: comments[q.id],
        })),
      });
      toast.success("Scoping answers saved");
    });
  }

  function finalize() {
    startTransition(async () => {
      await saveScopingAnswers({
        cycleId,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id],
          comment: comments[q.id],
        })),
      });
      const result = await finalizeScoping({ cycleId });
      const url = `${window.location.origin}/client/${result.token}`;
      setClientUrl(url);
      toast.success("Scope resolved and client link generated");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(([category, qs]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {qs.map((q) => (
              <div key={q.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium">
                  {q.code}. {q.questionText}
                </p>
                {q.helpText && <p className="text-xs text-muted-foreground">{q.helpText}</p>}
                <RadioGroup
                  className="flex gap-4"
                  value={answers[q.id]}
                  onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v as AnswerState }))}
                >
                  <Label className="flex items-center gap-1.5 font-normal">
                    <RadioGroupItem value="yes" /> Yes
                  </Label>
                  <Label className="flex items-center gap-1.5 font-normal">
                    <RadioGroupItem value="no" /> No
                  </Label>
                  <Label className="flex items-center gap-1.5 font-normal">
                    <RadioGroupItem value="unanswered" /> Unanswered
                  </Label>
                </RadioGroup>
                <Textarea
                  placeholder="Assessor comments (optional)"
                  value={comments[q.id]}
                  onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={save} disabled={isPending}>
          Save answers
        </Button>
        <Button onClick={finalize} disabled={isPending}>
          Finalize scoping &amp; generate client link
        </Button>
      </div>

      {clientUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client questionnaire link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Email delivery is out of scope for this prototype — copy this URL to the client yourself.
            </p>
            <code className="mt-2 block break-all rounded-md bg-muted p-2 text-xs">{clientUrl}</code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

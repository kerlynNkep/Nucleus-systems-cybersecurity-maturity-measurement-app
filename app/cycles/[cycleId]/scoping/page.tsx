import { notFound } from "next/navigation";

import { getCycleContext, getCycleScopingAnswers, getScopingQuestions } from "@/lib/queries";
import { ScopingForm } from "@/components/scoping-form";

export default async function ScopingPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const [questions, existingAnswers] = await Promise.all([
    getScopingQuestions(ctx.frameworkId),
    getCycleScopingAnswers(cycleId),
  ]);
  const answerByQuestionId = new Map(existingAnswers.map((a) => [a.scopingQuestionId, a]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Scoping questionnaire</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.frameworkCode} — answers resolve which {ctx.assessmentUnitSingular.toLowerCase()}s stay in scope for{" "}
          {ctx.clientName}. Unanswered questions never auto-exclude anything.
        </p>
      </div>
      <ScopingForm
        cycleId={cycleId}
        questions={questions.map((q) => ({
          id: q.id,
          code: q.code,
          category: q.category,
          questionText: q.questionText,
          helpText: q.helpText,
          existingAnswer: answerByQuestionId.get(q.id)?.answer ?? null,
          existingComment: answerByQuestionId.get(q.id)?.comment ?? "",
        }))}
      />
    </div>
  );
}

import { getFrameworks } from "@/lib/queries";
import { createEngagement } from "@/lib/actions/engagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function NewEngagementPage() {
  const frameworks = await getFrameworks();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createEngagement} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientName">Client organisation</Label>
              <Input id="clientName" name="clientName" required placeholder="Acacia Financial Services Ltd" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="engagementName">Engagement name</Label>
              <Input id="engagementName" name="engagementName" required placeholder="2026 NS-CMMF Assessment" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessorName">Assessor</Label>
              <Input id="assessorName" name="assessorName" required placeholder="Your name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frameworkId">Framework</Label>
              <select
                id="frameworkId"
                name="frameworkId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {frameworks.length === 0 && <option value="">No frameworks loaded — run the loader first</option>}
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name} ({f.version})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={frameworks.length === 0}>
              Create engagement
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

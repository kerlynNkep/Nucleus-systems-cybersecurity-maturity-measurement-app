import Link from "next/link";

import { getEngagements } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const engagements = await getEngagements();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Engagements</h1>
          <p className="text-sm text-muted-foreground">
            Assessor-created engagements across all frameworks currently loaded.
          </p>
        </div>
        <Button asChild>
          <Link href="/engagements/new">New engagement</Link>
        </Button>
      </div>

      {engagements.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No engagements yet. Create one to start a scoping + assessment cycle.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {engagements.map((e) => (
            <Link key={e.id} href={`/engagements/${e.id}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{e.clientName}</span>
                    <Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {e.name} · Assessor: {e.assessorName}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

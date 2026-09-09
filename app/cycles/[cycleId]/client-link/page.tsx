import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getCycleContext, getLatestClientToken } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientLinkPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const ctx = await getCycleContext(cycleId);
  if (!ctx) notFound();

  const token = await getLatestClientToken(cycleId);
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const url = token ? `${protocol}://${host}/client/${token.token}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client questionnaire link</CardTitle>
      </CardHeader>
      <CardContent>
        {url ? (
          <>
            <p className="text-sm text-muted-foreground">
              Send this URL to {ctx.clientName} — no account needed. Email delivery is out of scope for this
              prototype, so the link is only shown here.
            </p>
            <code className="mt-2 block break-all rounded-md bg-muted p-2 text-xs">{url}</code>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No client link yet — finalize scoping first to generate one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

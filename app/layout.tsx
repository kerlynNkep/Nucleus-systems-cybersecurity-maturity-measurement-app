import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nucleus Assessment Platform",
  description: "NS-CMMF maturity & improvement management prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Nucleus Systems <span className="text-muted-foreground font-normal">| Assessment Platform</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}

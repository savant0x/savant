import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Savant Core",
  description: "The proactive AI agent desktop shell",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}

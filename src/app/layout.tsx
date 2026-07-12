import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full" data-theme="dark">
      <body className="h-full bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

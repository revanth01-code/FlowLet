import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowlet",
  description: "Webhook automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/flows" className="nav-brand-container">
            <span className="brand-logo">⚡</span>
            <span className="nav-brand">Flowlet</span>
            <span className="nav-badge">Automations</span>
          </Link>
          <Link href="/flows/new" className="btn btn-primary btn-sm">
            + New Flow
          </Link>
        </nav>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}

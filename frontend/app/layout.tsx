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
          <Link href="/flows" className="nav-brand">
            Flowlet
          </Link>
          <Link href="/flows/new" className="btn btn-sm">
            + New flow
          </Link>
        </nav>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}

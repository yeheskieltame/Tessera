import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tessera — AI-Powered Public Goods Evaluation",
  description:
    "AI agent for public goods data analysis, trust graph evaluation, and mechanism simulation in the Ethereum ecosystem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: "Defend — Know your work. Own your story.",
  description:
    "A calm space to practise explaining your software. Ground your answers in your code, reflect, and try again.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

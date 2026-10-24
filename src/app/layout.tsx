import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { ThemeProvider, type Theme } from "@/components/theme";
import "./globals.css";
import "./experience.css";
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
  const saved = (await cookies()).get("defend_theme")?.value;
  const theme: Theme = saved === "dark" || saved === "light" ? saved : "system";
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}

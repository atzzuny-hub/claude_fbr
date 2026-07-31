import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontSans } from "./fonts";
import "./globals.css";

// 숫자류(수량/참조번호 등) 전용 — --font-mono 토큰, tabular-nums와 함께 컴포넌트에서 적용.
const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "REVE 풀필먼트 어드민",
  description: "동남아 풀필먼트 운영을 위한 REVE 내부 어드민",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

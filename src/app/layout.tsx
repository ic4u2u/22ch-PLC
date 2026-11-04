import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "특수가스 스마트 관제 시스템 (11뱅크 · 22실린더 통합 관제) | QOOTEC & LS XBL-EMTA",
  description:
    "LS ELECTRIC XGB PLC (XBL-EMTA) 연동 11뱅크 · 22실린더(CH-01~22) 특수가스 실시간 압력 모니터링 및 Smart AI 자동 절체 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}

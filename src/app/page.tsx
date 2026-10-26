import React, { Suspense } from "react";
import Dashboard24 from "../components/Dashboard24";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-cyan-300">
            ACSC 22채널 특수가스 스마트 관제 시스템 로딩 중...
          </p>
        </div>
      }
    >
      <Dashboard24 />
    </Suspense>
  );
}

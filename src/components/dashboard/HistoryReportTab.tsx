"use client";

/**
 * 파일명: src/components/dashboard/HistoryReportTab.tsx
 * 역할: [탭 6] ⏪ 과거 이력 타임머신 슬라이더 & 📄 결재란 포함 A4 인쇄용(window.print()) 일간/주간 보고서
 */

import React, { useState } from "react";
import {
  ChannelData,
  HistoryLogItem,
  MonthlySummaryItem,
  LeakTestLogItem,
  downloadUtf8BomCsv,
} from "./types";

interface HistoryReportTabProps {
  channels: ChannelData[];
  historyLogs: HistoryLogItem[];
  monthlySummary: MonthlySummaryItem[];
  leakLogs: LeakTestLogItem[];
  onRefreshHistory: () => void;
}

export default function HistoryReportTab({
  channels,
  historyLogs,
  monthlySummary,
  leakLogs,
  onRefreshHistory,
}: HistoryReportTabProps) {
  const [sliderIdx, setSliderIdx] = useState<number>(
    Math.max(0, historyLogs.length - 1)
  );
  const [reportType, setReportType] = useState<"DAILY" | "WEEKLY">("DAILY");

  const safeIdx = Math.min(
    Math.max(0, sliderIdx),
    Math.max(0, historyLogs.length - 1)
  );
  const selectedSnapshot = historyLogs[safeIdx] || null;

  let snapshotPressures: number[] = channels.map((c) => c.pressureBar);
  let snapshotValves: number[] = channels.map((c) => c.valveState);

  if (selectedSnapshot) {
    try {
      snapshotPressures = JSON.parse(selectedSnapshot.pressures_json);
      snapshotValves = JSON.parse(selectedSnapshot.valves_json);
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* 상단: SQLite 타임라인 슬라이더 되감기 컨트롤 (인쇄 시 숨김) */}
      <div className="no-print rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-cyan-300">
              ⏪ SQLite 22채널 과거 압력 타임머신 되감기 (5초 단위 스냅샷)
            </h3>
            <p className="text-xs text-slate-400">
              슬라이더를 좌우로 움직여 과거 특정 시점의 22채널 압력과 밸브 상태를 즉시 복기할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefreshHistory}
              className="min-h-[40px] rounded-xl bg-slate-800 px-3.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              🔄 최신 이력 새로고침
            </button>
            <button
              type="button"
              onClick={() =>
                downloadUtf8BomCsv(
                  `ACSC_22CH_압력이력_${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    "Timestamp",
                    ...channels.map((c) => `CH${String(c.id).padStart(2, "0")}_${c.gasCode}(bar)`),
                  ],
                  historyLogs.map((h) => {
                    let p: number[] = [];
                    try {
                      p = JSON.parse(h.pressures_json);
                    } catch {}
                    return [h.timestamp, ...Array.from({ length: channels.length }, (_, i) => p[i] ?? 0)];
                  })
                )
              }
              className="min-h-[40px] rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3.5 text-xs font-extrabold text-emerald-300"
            >
              📥 전체 압력 이력 CSV 다운로드
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] rounded-xl bg-cyan-500 px-4 text-xs font-black text-slate-950 hover:bg-cyan-400"
            >
              🖨️ A4 결재 보고서 인쇄 / PDF 저장
            </button>
          </div>
        </div>

        {/* 타임라인 슬라이더 */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400">
              기록 구간: {historyLogs[0]?.timestamp || "현재"} ~{" "}
              {historyLogs[historyLogs.length - 1]?.timestamp || "현재"}
            </span>
            <span className="rounded bg-cyan-500/20 px-2.5 py-1 font-mono text-cyan-300">
              선택 시점: {selectedSnapshot?.timestamp || "실시간 현재 상태"} (
              {historyLogs.length > 0 ? `${safeIdx + 1} / ${historyLogs.length}` : "0"})
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, historyLogs.length - 1)}
            value={safeIdx}
            onChange={(e) => setSliderIdx(Number(e.target.value))}
            className="mt-3 h-2.5 w-full cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* 하단: 결재란 포함 A4 인쇄용 일간/주간 공식 안전점검 보고서 */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 print:border-black print:bg-white print:text-black">
        {/* 보고서 상단 타이틀 & 3단 결재란 */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-700 pb-4 print:border-black">
          <div>
            <div className="no-print mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setReportType("DAILY")}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  reportType === "DAILY"
                    ? "bg-cyan-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                📄 일간(Daily) 안전 보고서
              </button>
              <button
                type="button"
                onClick={() => setReportType("WEEKLY")}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  reportType === "WEEKLY"
                    ? "bg-cyan-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                📑 주간(Weekly) 종합 보고서
              </button>
            </div>
            <h2 className="text-xl font-black">
              [ACSC 22채널 특수가스 스마트 관제]{" "}
              {reportType === "DAILY" ? "일간" : "주간"} 운전 및 안전점검 보고서
            </h2>
            <p className="mt-1 text-xs text-slate-400 print:text-gray-700">
              기준 일시: {selectedSnapshot?.timestamp || "2026-10-26 12:00:00"} | 설비: LS ELECTRIC XGB + XBL-EMTA (22CH / 11BANK)
            </p>
          </div>

          {/* 결재란 테이블 (담당 / 검토 / 승인) */}
          <table className="border-collapse border border-slate-600 text-center text-xs print:border-black">
            <thead>
              <tr className="bg-slate-800 print:bg-gray-200">
                <th className="w-10 border border-slate-600 p-1.5 print:border-black" rowSpan={2}>
                  결<br />재
                </th>
                <th className="w-20 border border-slate-600 p-1.5 print:border-black">담 당</th>
                <th className="w-20 border border-slate-600 p-1.5 print:border-black">검 토</th>
                <th className="w-20 border border-slate-600 p-1.5 print:border-black">승 인</th>
              </tr>
              <tr>
                <td className="h-14 border border-slate-600 print:border-black"></td>
                <td className="h-14 border border-slate-600 print:border-black"></td>
                <td className="h-14 border border-slate-600 print:border-black"></td>
              </tr>
            </thead>
          </table>
        </div>

        {/* 1. 선택 시점 22채널 압력 및 밸브 상태 요약 표 */}
        <h4 className="mt-5 text-sm font-extrabold">
          1. 22채널 특수가스 공급 압력 및 밸브 상태 현황
        </h4>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {channels.map((ch, idx) => {
            const p = Number(snapshotPressures[idx] ?? ch.pressureBar);
            const v = Number(snapshotValves[idx] ?? ch.valveState);
            return (
              <div
                key={ch.id}
                className="rounded-lg border border-slate-700 p-2 text-xs print:border-gray-400"
              >
                <div className="flex justify-between font-bold">
                  <span>{ch.name}</span>
                  <span>{ch.gasCode}</span>
                </div>
                <div className="mt-1 font-mono text-sm font-black">
                  {p.toFixed(1)} bar
                </div>
                <div className="text-[10px] text-slate-400 print:text-gray-600">
                  밸브: {v === 0 ? "OPEN(개방)" : "SHUTOFF(차단)"}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. 월간 가스별 실린더 교체 및 소모량 요약 + 최근 기밀 시험 결과 */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-extrabold">
              2. 당월 특수가스 실린더 교체 및 소모량 집계
            </h4>
            <table className="mt-2 w-full border-collapse border border-slate-700 text-xs print:border-gray-400">
              <thead>
                <tr className="bg-slate-800 print:bg-gray-200">
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">년-월</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">가스명</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">교체 횟수</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">누적 충전량</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.slice(0, 6).map((m, i) => (
                  <tr key={i}>
                    <td className="border border-slate-700 p-1.5 font-mono print:border-gray-400">
                      {m.year_month}
                    </td>
                    <td className="border border-slate-700 p-1.5 font-bold print:border-gray-400">
                      {m.gas_name}
                    </td>
                    <td className="border border-slate-700 p-1.5 font-mono print:border-gray-400">
                      {m.replace_count}회
                    </td>
                    <td className="border border-slate-700 p-1.5 font-mono print:border-gray-400">
                      {m.total_consumed_bar} bar
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="text-sm font-extrabold">
              3. 최근 배관 기밀 시험(Leak Test) 성적 요약
            </h4>
            <table className="mt-2 w-full border-collapse border border-slate-700 text-xs print:border-gray-400">
              <thead>
                <tr className="bg-slate-800 print:bg-gray-200">
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">일시</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">채널</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">ΔP(bar)</th>
                  <th className="border border-slate-700 p-1.5 print:border-gray-400">판정</th>
                </tr>
              </thead>
              <tbody>
                {leakLogs.slice(0, 6).map((l, i) => (
                  <tr key={i}>
                    <td className="border border-slate-700 p-1.5 font-mono print:border-gray-400">
                      {l.timestamp.slice(5, 16)}
                    </td>
                    <td className="border border-slate-700 p-1.5 font-bold print:border-gray-400">
                      CH-{String(l.channel_id).padStart(2, "0")} ({l.gas_name})
                    </td>
                    <td className="border border-slate-700 p-1.5 font-mono print:border-gray-400">
                      {l.delta_pressure} bar
                    </td>
                    <td className="border border-slate-700 p-1.5 font-bold print:border-gray-400">
                      {l.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

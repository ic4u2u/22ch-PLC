"use client";

/**
 * 파일명: src/components/dashboard/BottomLogsSection.tsx
 * 역할: 하단 3대 이력 테이블 & 엑셀(CSV, UTF-8 BOM) 원클릭 다운로드
 *  1) 🚨 실시간 알람 발생/해제 로그
 *  2) 🔄 실린더 자동 교체 및 월간 소모량 집계
 *  3) 🛡️ 관리자 조작 감사 로그 (Audit Trail)
 */

import React from "react";
import {
  AlertItem,
  AuditLogItem,
  ReplacementLogItem,
  MonthlySummaryItem,
  downloadUtf8BomCsv,
} from "./types";

interface BottomLogsSectionProps {
  alerts: AlertItem[];
  replacements: ReplacementLogItem[];
  monthlySummary: MonthlySummaryItem[];
  auditLogs: AuditLogItem[];
  onRefreshAllLogs: () => void;
}

export default function BottomLogsSection({
  alerts,
  replacements,
  monthlySummary,
  auditLogs,
  onRefreshAllLogs,
}: BottomLogsSectionProps) {
  const dateSuffix = new Date().toISOString().slice(0, 10);

  return (
    <section className="no-print mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-200">
          📊 실시간 통합 이력 센터 (알람 · 실린더 자동 교체 집계 · 관리자 감사 로그)
        </h2>
        <button
          type="button"
          onClick={onRefreshAllLogs}
          className="min-h-[38px] rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-cyan-300 hover:bg-slate-800"
        >
          🔄 3대 로그 새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 테이블 1: 🚨 실시간 알람 발생/해제 로그 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold text-rose-300">
              🚨 실시간 알람 발생/해제 로그 ({alerts.length})
            </h3>
            <button
              type="button"
              onClick={() =>
                downloadUtf8BomCsv(
                  `ACSC_실시간알람로그_${dateSuffix}.csv`,
                  ["일시", "등급", "코드", "뱅크/채널", "상세내용"],
                  alerts.map((a) => [
                    a.timestamp,
                    a.level,
                    a.code,
                    a.bankId || (a.channelId ? `CH-${a.channelId}` : "-"),
                    a.message,
                  ])
                )
              }
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-slate-700"
            >
              📥 CSV 다운로드
            </button>
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                현재 발생한 알람이 없습니다. (전 채널 정상)
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-2.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`rounded px-1.5 py-0.5 font-extrabold ${
                        a.level === "DANGER"
                          ? "bg-rose-500/20 text-rose-300"
                          : a.level === "FAULT"
                          ? "bg-purple-500/20 text-purple-300"
                          : a.level === "WARN"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-cyan-500/20 text-cyan-300"
                      }`}
                    >
                      {a.code}
                    </span>
                    <span className="font-mono text-slate-400">{a.timestamp}</span>
                  </div>
                  <p className="mt-1 text-slate-200">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 테이블 2: 🔄 실린더 자동 교체 및 월간 소모량 집계 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold text-amber-300">
              🔄 실린더 자동 교체 & 월간 소모량 집계
            </h3>
            <button
              type="button"
              onClick={() =>
                downloadUtf8BomCsv(
                  `ACSC_실린더교체및소모량_${dateSuffix}.csv`,
                  ["교체일시", "년월", "채널", "가스명", "교체전(bar)", "교체후(bar)", "상승폭(bar)"],
                  replacements.map((r) => [
                    r.timestamp,
                    r.year_month,
                    `CH-${String(r.channel_id).padStart(2, "0")}`,
                    r.gas_name,
                    r.prev_pressure,
                    r.new_pressure,
                    r.delta_pressure,
                  ])
                )
              }
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-slate-700"
            >
              📥 CSV 다운로드
            </button>
          </div>

          {/* 월간 소모량 미니 배지 */}
          {monthlySummary.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
              {monthlySummary.slice(0, 4).map((m, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-200"
                >
                  {m.year_month} {m.gas_name}: {m.replace_count}회 ({m.total_consumed_bar}b)
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 max-h-48 overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-1">일시</th>
                  <th className="py-1">채널/가스</th>
                  <th className="py-1 text-right">전→후(bar)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {replacements.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 font-mono text-slate-400">
                      {r.timestamp.slice(5, 19)}
                    </td>
                    <td className="py-1.5 font-bold text-white">
                      CH{String(r.channel_id).padStart(2, "0")} {r.gas_name}
                    </td>
                    <td className="py-1.5 text-right font-mono text-emerald-300">
                      {r.prev_pressure}→{r.new_pressure} (+{r.delta_pressure})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 테이블 3: 🛡️ 관리자 조작 감사 로그 (Audit Trail) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold text-cyan-300">
              🛡️ 관리자 조작 감사 로그 (Audit Trail)
            </h3>
            <button
              type="button"
              onClick={() =>
                downloadUtf8BomCsv(
                  `ACSC_감사로그_AuditTrail_${dateSuffix}.csv`,
                  ["일시", "실행주체", "작업유형", "대상", "상세내역"],
                  auditLogs.map((l) => [
                    l.timestamp,
                    l.actor,
                    l.action_type,
                    l.target,
                    l.detail,
                  ])
                )
              }
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-slate-700"
            >
              📥 CSV 다운로드
            </button>
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-2.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-300">
                    [{log.actor}] {log.action_type} · {log.target}
                  </span>
                  <span className="font-mono text-slate-400">{log.timestamp}</span>
                </div>
                <p className="mt-1 text-slate-300">{log.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

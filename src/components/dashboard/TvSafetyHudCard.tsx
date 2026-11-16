"use client";

/**
 * 파일명: src/components/dashboard/TvSafetyHudCard.tsx
 * 역할: 4K UHD TV(4열 × 3줄 = 12칸) 대형 실린더뷰의 12번째 우하단 칸을 채우는 '실시간 종합 안전 HUD 카드'
 *  - 삼성 75" DU7200 등 VA·BGR 패널 환경에서도 3~5m 거리에서 한눈에 읽히는 고대비·굵은 폰트 적용
 */

import React from "react";
import {
  ChannelData,
  DiagnosticsData,
  PressureUnit,
  formatChannelCode,
  formatPressureByUnit,
  getUnitLabel,
} from "./types";

interface TvSafetyHudCardProps {
  channels: ChannelData[];
  diagnostics: DiagnosticsData;
  unit: PressureUnit;
  clockText: string;
  onSelectChannel?: (ch: ChannelData) => void;
  onJumpToSpotlight?: () => void;
}

export default function TvSafetyHudCard({
  channels,
  diagnostics,
  unit,
  clockText,
  onSelectChannel,
  onJumpToSpotlight,
}: TvSafetyHudCardProps) {
  const unitLabel = getUnitLabel(unit);

  const supplyCount = channels.filter((c) => c.valveState === 0).length;
  const faultChannels = channels.filter((c) => c.status === "SENSOR_FAULT");
  const warnCount = channels.filter((c) => c.status === "WARN").length;
  const attentionChannels = channels.filter(
    (c) =>
      c.status === "DANGER" ||
      c.status === "SENSOR_FAULT" ||
      (c.valveState === 1 && c.pressureBar <= (c.dangerBar || 15))
  );
  const standbyOkCount = channels.filter(
    (c) =>
      c.valveState === 1 &&
      c.status !== "SENSOR_FAULT" &&
      c.status !== "DANGER" &&
      c.pressureBar > (c.dangerBar || 15)
  ).length;

  const hasUrgent = attentionChannels.length > 0 || !diagnostics.plcConnected;

  return (
    <div
      className={`h-full flex flex-col justify-between rounded-2xl border-2 p-4 shadow-xl transition-all ${
        hasUrgent
          ? "border-rose-500/90 bg-gradient-to-b from-rose-950/40 to-slate-950"
          : "border-cyan-500/70 bg-gradient-to-b from-slate-900 to-slate-950"
      }`}
      style={{ borderTopWidth: "6px" }}
    >
      {/* 1. 상단: HUD 타이틀 & 대형 디지털 시계 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-cyan-500/40 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-cyan-500 px-2.5 py-0.5 text-xs font-black text-slate-950">
            종합 안전 HUD
          </span>
          <span className="text-sm sm:text-base font-black text-white tracking-tight">
            11뱅크 통합 감시
          </span>
        </div>
        <span className="font-mono text-lg sm:text-xl font-black text-cyan-300 tabular-nums">
          {clockText || "--:--:--"}
        </span>
      </div>

      {/* 2. 중단 1: 4칸 고대비 실시간 실린더 집계 */}
      <div className="my-2.5 grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-3 py-2">
          <span className="text-xs font-black text-emerald-200">🟢 공급중</span>
          <span className="font-mono text-xl font-black text-emerald-300">{supplyCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-600 bg-slate-900 px-3 py-2">
          <span className="text-xs font-black text-slate-100">⚪ 예비정상</span>
          <span className="font-mono text-xl font-black text-white">{standbyOkCount}</span>
        </div>
        <div
          className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
            warnCount > 0
              ? "border-amber-400/70 bg-amber-950/50"
              : "border-slate-700 bg-slate-900/70"
          }`}
        >
          <span className="text-xs font-black text-amber-200">🟡 예고주의</span>
          <span
            className={`font-mono text-xl font-black ${
              warnCount > 0 ? "text-amber-300" : "text-slate-400"
            }`}
          >
            {warnCount}
          </span>
        </div>
        <div
          className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
            attentionChannels.length > 0
              ? "border-rose-400/80 bg-rose-950/60 animate-pulse"
              : "border-slate-700 bg-slate-900/70"
          }`}
        >
          <span className="text-xs font-black text-rose-200">🔴 교체·점검</span>
          <span
            className={`font-mono text-xl font-black ${
              attentionChannels.length > 0 ? "text-rose-300" : "text-slate-400"
            }`}
          >
            {attentionChannels.length}
          </span>
        </div>
      </div>

      {/* 3. 중단 2: 우선 확인 실린더 목록 또는 정상 가동 배너 */}
      <div className="rounded-xl border border-slate-700/90 bg-black/50 p-2.5 space-y-1.5">
        {attentionChannels.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-rose-300">
                ⚠️ 우선 점검 ({faultChannels.length > 0 ? `센서 ${faultChannels.length}건 포함` : "빈 통·저압"})
              </span>
              {onJumpToSpotlight && (
                <button
                  type="button"
                  onClick={onJumpToSpotlight}
                  className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white hover:bg-rose-400"
                >
                  집중뷰 ↗
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-[88px] overflow-y-auto pr-0.5">
              {attentionChannels.slice(0, 3).map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelectChannel?.(ch)}
                  className="w-full flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-left text-xs font-bold text-white hover:bg-rose-900/60"
                >
                  <span className="truncate">
                    <span className="font-mono text-rose-300 mr-1.5">
                      {formatChannelCode(ch.id)}
                    </span>
                    {ch.gasName}({ch.side})
                  </span>
                  <span className="font-mono font-black text-amber-300 shrink-0 ml-2">
                    {ch.status === "SENSOR_FAULT"
                      ? "센서점검"
                      : `${formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}${unitLabel}`}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="py-2 text-center text-xs font-black text-emerald-300">
            ✅ 전 뱅크 공급 및 예비통 기밀 정상 · 인터록 대기중
          </div>
        )}
      </div>

      {/* 4. 하단: PLC 통신 상태 & 안전 규격 요약 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800 pt-2 text-[11px] font-bold">
        <span
          className={`inline-flex items-center gap-1.5 ${
            diagnostics.plcConnected ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              diagnostics.plcConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
            }`}
          />
          {diagnostics.plcConnected
            ? `PLC 온라인 (${diagnostics.latencyMs}ms)`
            : "PLC 재연결 대기중"}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-200">
          무중단 절체 350ms · 4K UHD
        </span>
      </div>
    </div>
  );
}

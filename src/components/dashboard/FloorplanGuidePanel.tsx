"use client";

/**
 * 파일명: src/components/dashboard/FloorplanGuidePanel.tsx
 * 역할: 공장 도면 뷰(제3구역 일반수소 우측) 실시간 설비 요약 & 표준 색상·순도 가이드 패널
 *  - 큰 폰트와 KPI 타일 그리드로 빈 공백 없이 꽉 찬 관제 밀도감 제공
 */

import React from "react";
import {
  ChannelData,
  PressureUnit,
  formatChannelCode,
  formatPressureByUnit,
  getUnitLabel,
} from "./types";

interface FloorplanGuidePanelProps {
  channels: ChannelData[];
  unit: PressureUnit;
  onSelectChannel: (ch: ChannelData) => void;
}

export default function FloorplanGuidePanel({
  channels,
  unit,
  onSelectChannel,
}: FloorplanGuidePanelProps) {
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

  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-slate-700/90 bg-slate-900/95 p-4 flex flex-col justify-between gap-3 shadow-lg">
      {/* 1. 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <span className="text-sm sm:text-base font-black text-cyan-300 tracking-tight break-keep">
          🎨 뱅크별 2실린더(A·B) 실시간 관제 요약 &amp; 표준 색상 가이드
        </span>
        <span className="rounded-lg border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-300 break-keep">
          💡 실린더 클릭 → 상세 트렌드 &amp; 영점 보정(⚙️)
        </span>
      </div>

      {/* 2. 실시간 11뱅크 · 22실린더 4칸 KPI 타일 그리드 */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/35 px-3 py-2">
            <span className="text-xs font-extrabold text-emerald-300 break-keep">🟢 공급중</span>
            <span className="font-mono text-lg sm:text-xl font-black text-emerald-300">
              {supplyCount}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2">
            <span className="text-xs font-extrabold text-slate-200 break-keep">⚪ 예비정상</span>
            <span className="font-mono text-lg sm:text-xl font-black text-slate-100">
              {standbyOkCount}
            </span>
          </div>
          <div
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
              warnCount > 0
                ? "border-amber-500/60 bg-amber-950/40"
                : "border-slate-800 bg-slate-900/50"
            }`}
          >
            <span
              className={`text-xs font-extrabold break-keep ${
                warnCount > 0 ? "text-amber-300" : "text-slate-400"
              }`}
            >
              🟡 주의
            </span>
            <span
              className={`font-mono text-lg sm:text-xl font-black ${
                warnCount > 0 ? "text-amber-300" : "text-slate-500"
              }`}
            >
              {warnCount}
            </span>
          </div>
          <div
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
              attentionChannels.length > 0
                ? "border-rose-500/60 bg-rose-950/40"
                : "border-slate-800 bg-slate-900/50"
            }`}
          >
            <span
              className={`text-xs font-extrabold break-keep ${
                attentionChannels.length > 0 ? "text-rose-300" : "text-slate-400"
              }`}
            >
              🔴 교체·점검
            </span>
            <span
              className={`font-mono text-lg sm:text-xl font-black ${
                attentionChannels.length > 0 ? "text-rose-300" : "text-slate-500"
              }`}
            >
              {attentionChannels.length}
            </span>
          </div>
        </div>

        {/* 우선 확인 실린더 바로가기 또는 정상 가동 배너 */}
        {attentionChannels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <span className="text-xs font-black text-rose-300 break-keep">
              ⚠️ 우선 확인 ({faultChannels.length > 0 ? `센서이상 ${faultChannels.length} 포함` : "교체·저압"}):
            </span>
            {attentionChannels.slice(0, 4).map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/60 px-2.5 py-1 text-xs font-bold text-rose-100 hover:bg-rose-900/70 transition-colors"
              >
                <span className="font-mono font-black text-rose-300">
                  {formatChannelCode(ch.id)}
                </span>
                <span>
                  {ch.gasName}({ch.side})
                </span>
                <span className="font-mono text-amber-200">
                  {ch.status === "SENSOR_FAULT"
                    ? "센서점검"
                    : `${formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}${unitLabel}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs font-bold text-emerald-300 break-keep">
            <span>✅ 전 뱅크 공급 및 예비 실린더 기밀 정상 — 무중단 자동절체(Make-Before-Break) 대기 중</span>
            <span className="hidden sm:inline font-mono text-[11px] text-slate-400">
              총 {channels.length}CH 감시중
            </span>
          </div>
        )}
      </div>

      {/* 3. 도면 표준 색상 구분 4종 카드 (상단 포인트 라인 + 큼직한 본문) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-emerald-500/35 border-t-2 border-t-emerald-400 bg-slate-950 p-3">
          <div className="text-xs sm:text-sm font-black text-emerald-400 break-keep">
            🟢 공급중 (초록)
          </div>
          <p className="mt-1 text-xs leading-snug font-medium text-slate-300 break-keep">
            현재 공정 배관으로 가스를 공급 중인 활성 실린더
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-700/80 border-t-2 border-t-slate-400 bg-slate-950 p-3">
          <div className="text-xs sm:text-sm font-black text-slate-200 break-keep">
            ⚪ 예비대기 (슬레이트)
          </div>
          <p className="mt-1 text-xs leading-snug font-medium text-slate-300 break-keep">
            1차측 기밀을 감시하며 자동절체를 대기 중인 예비통
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-amber-500/35 border-t-2 border-t-amber-400 bg-slate-950 p-3">
          <div className="text-xs sm:text-sm font-black text-amber-300 break-keep">
            🟡 주의 / 🔴 빈 통
          </div>
          <p className="mt-1 text-xs leading-snug font-medium text-slate-300 break-keep">
            잔량 부족 또는 예비통 저압 시 안전 인터록 차단
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-cyan-500/30 border-t-2 border-t-cyan-400 bg-slate-950 p-3">
          <div className="text-xs sm:text-sm font-black text-cyan-300 break-keep">
            ┇ 중앙 색상 점선
          </div>
          <p className="mt-1 text-xs leading-snug font-medium text-slate-300 break-keep">
            동일 뱅크의 <strong className="text-white">A(좌·홀수)</strong>와{" "}
            <strong className="text-white">B(우·짝수)</strong> 구분선
          </p>
        </div>
      </div>

      {/* 4. 하단 순도 기호 & 현장 안전 규격 요약 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-slate-300">순도 기호</span>
          <span className="rounded-lg border border-cyan-500/30 bg-slate-800/90 px-2.5 py-1 font-mono font-bold text-cyan-300">
            P- = 99.999% 초고순도
          </span>
          <span className="rounded-lg border border-amber-500/30 bg-slate-800/90 px-2.5 py-1 font-mono font-bold text-amber-300">
            G- = 99.95% 일반순도
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono font-bold">
            C2H2 안전만충 25bar
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono font-bold">
            무중단 절체 350ms 오버랩
          </span>
        </div>
      </div>
    </div>
  );
}

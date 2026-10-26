"use client";

/**
 * 파일명: src/components/dashboard/ChannelGridTab.tsx
 * 역할: [탭 1] 🟢 24채널 그리드 뷰
 *  - 가스 배지, FND 현재 압력, 잔량 게이지 바, 실시간 소진 예상 시간(⏳ 약 X시간 Y분 남음)
 *  - 4~20mA 센서 자가 진단 (SENSOR_FAULT) 보라색 분리 표시 및 오차단 방지 배지
 *  - 원격 밸브 개방/차단 버튼, 클릭 시 SVG 최근 1분 트렌드 & 영점 보정 모달 호출
 */

import React from "react";
import { ChannelData, PressureUnit, formatPressureByUnit, getUnitLabel } from "./types";

interface ChannelGridTabProps {
  channels: ChannelData[];
  unit: PressureUnit;
  isUnlocked: boolean;
  onToggleValve: (channelId: number, nextValveState: number) => void;
  onSelectChannel: (ch: ChannelData) => void;
  onRequestPin: () => void;
}

export default function ChannelGridTab({
  channels,
  unit,
  isUnlocked,
  onToggleValve,
  onSelectChannel,
  onRequestPin,
}: ChannelGridTabProps) {
  const unitLabel = getUnitLabel(unit);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {channels.map((ch) => {
        const pct = Math.max(
          0,
          Math.min(100, (ch.pressureBar / (ch.maxBar || 150)) * 100)
        );

        // 상태별 테두리 및 배경 스타일 (SENSOR_FAULT는 보라색으로 엄격 분리)
        let cardBorder = "border-slate-800 bg-slate-900/85";
        let badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
        let statusLabel = "정상 공급";
        let barColor = "bg-emerald-500";

        if (ch.status === "SENSOR_FAULT") {
          cardBorder = "border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-500/15";
          badgeStyle = "bg-purple-500/30 text-purple-200 border-purple-400 animate-pulse";
          statusLabel = "⚡ SENSOR_FAULT";
          barColor = "bg-purple-500";
        } else if (ch.status === "SHUTOFF") {
          cardBorder = "border-slate-700 bg-slate-900/50 opacity-80";
          badgeStyle = "bg-slate-700 text-slate-300 border-slate-600";
          statusLabel = "🔒 밸브 차단됨";
          barColor = "bg-slate-600";
        } else if (ch.status === "DANGER") {
          cardBorder = "border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-500/15";
          badgeStyle = "bg-rose-500/30 text-rose-200 border-rose-400 animate-pulse";
          statusLabel = "🚨 위험 저압";
          barColor = "bg-rose-500";
        } else if (ch.status === "WARN") {
          cardBorder = "border-amber-500/80 bg-amber-950/20";
          badgeStyle = "bg-amber-500/25 text-amber-200 border-amber-400/50";
          statusLabel = "⚠️ 교체 주의";
          barColor = "bg-amber-400";
        }

        return (
          <div
            key={ch.id}
            className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-all hover:border-cyan-500/60 ${cardBorder}`}
          >
            {/* 상단: 채널 번호, 가스 배지, 설정(⚙️) 아이콘 */}
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-slate-300">
                    {ch.name}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    {ch.bankId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectChannel(ch)}
                  title="트렌드 차트 & 정밀 영점 보정 (⚙️)"
                  className="min-h-[34px] min-w-[34px] rounded-lg bg-slate-800/80 px-2 text-xs text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
                >
                  📈⚙️
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white"
                  style={{ backgroundColor: ch.color || "#0284c7" }}
                >
                  {ch.gasName}
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${badgeStyle}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* 중앙: FND 디지털 숫자판 (클릭 시 1분 트렌드 차트 모달) */}
              <div
                onClick={() => onSelectChannel(ch)}
                className="mt-3 cursor-pointer rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-right shadow-inner"
              >
                {ch.status === "SENSOR_FAULT" ? (
                  <div>
                    <div className="font-mono text-lg font-black text-purple-300">
                      FAULT ({ch.rawBar} bar)
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-purple-400">
                      {ch.faultReason || "4~20mA 센서 신호 이상 (밸브 오차단 방지됨)"}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-end gap-1.5">
                    <span className="font-mono text-3xl font-black tracking-tight text-white">
                      {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
                    </span>
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {unitLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* 게이지 바 */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* 실시간 소진 예상 시간 & 보정 오프셋 표시 */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate font-medium text-slate-300">
                  ⏳ {ch.remainingText}
                </span>
                {ch.calibrationOffset !== 0 && (
                  <span className="font-mono text-amber-300">
                    보정 {ch.calibrationOffset > 0 ? `+${ch.calibrationOffset}` : ch.calibrationOffset}b
                  </span>
                )}
              </div>
            </div>

            {/* 하단: 원격 밸브 차단/개방 버튼 (모바일 터치 최소 44px 높이) */}
            <div className="mt-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  if (!isUnlocked) {
                    onRequestPin();
                    return;
                  }
                  onToggleValve(ch.id, ch.valveState === 0 ? 1 : 0);
                }}
                className={`min-h-[44px] w-full rounded-xl px-3 py-2 text-xs font-extrabold transition-all ${
                  ch.valveState === 0
                    ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 hover:bg-rose-500 hover:text-white hover:border-rose-400"
                    : "bg-rose-500/25 border border-rose-500/60 text-rose-200 hover:bg-emerald-500 hover:text-slate-950"
                }`}
              >
                {ch.valveState === 0
                  ? "🟢 밸브 OPEN (클릭 시 차단)"
                  : "🔴 밸브 SHUTOFF (클릭 시 개방)"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

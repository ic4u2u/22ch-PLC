"use client";

/**
 * 파일명: src/components/dashboard/WallboardView.tsx
 * 역할: [탭 4 & ?view=wallboard 전용 뷰] 📺 대형 전광판 TV 뷰 (2번 모니터 DP 출력용)
 *  - 위험(DANGER) 및 센서고장(SENSOR_FAULT) 채널 상단 중앙 초대형 스포트라이트 확대 표시
 *  - 1) 가스캐비넷 5CH (10실린더: CH01~CH10) vs 2) 오토체인지 6CH (12실린더: CH11~CH22) 구역 분리 표시
 */

import React from "react";
import {
  ChannelData,
  DiagnosticsData,
  PressureUnit,
  formatPressureByUnit,
  getBankFacilityMeta,
  getUnitLabel,
} from "./types";

interface WallboardViewProps {
  channels: ChannelData[];
  unit: PressureUnit;
  diagnostics: DiagnosticsData;
  isStandaloneWallboard: boolean;
  onExitWallboard?: () => void;
}

export default function WallboardView({
  channels,
  unit,
  diagnostics,
  isStandaloneWallboard,
  onExitWallboard,
}: WallboardViewProps) {
  const unitLabel = getUnitLabel(unit);

  const cabinetChannels = channels.filter((c) => c.id <= 10);
  const autoChangeChannels = channels.filter((c) => c.id >= 11);

  // 위험(DANGER), 센서고장(SENSOR_FAULT), 주의(WARN) 우선순위 스포트라이트 채널 추출
  const spotlightChannels = channels.filter(
    (c) =>
      c.status === "DANGER" ||
      c.status === "SENSOR_FAULT" ||
      c.status === "WARN"
  );

  const renderWallboardCard = (ch: ChannelData) => {
    const bankNum = Math.ceil(ch.id / 2);
    const meta = getBankFacilityMeta(bankNum);
    let boxStyle = "border-slate-800 bg-slate-900/90 text-white";
    let numColor = "text-emerald-400";

    if (ch.status === "SENSOR_FAULT") {
      boxStyle = "border-purple-500 bg-purple-950/40";
      numColor = "text-purple-300";
    } else if (ch.status === "DANGER") {
      boxStyle = "border-rose-500 bg-rose-950/40 animate-pulse";
      numColor = "text-rose-400";
    } else if (ch.status === "WARN") {
      boxStyle = "border-amber-500/80 bg-amber-950/30";
      numColor = "text-amber-300";
    } else if (ch.status === "SHUTOFF") {
      boxStyle = "border-slate-800 bg-slate-950 opacity-60";
      numColor = "text-slate-500";
    }

    return (
      <div
        key={ch.id}
        className={`rounded-2xl border-2 p-3.5 transition-all ${boxStyle}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-xs sm:text-sm font-black text-slate-200">
            {ch.side}통 · CH-{String(ch.id).padStart(2, "0")}
          </span>
          <span
            className="rounded px-2 py-0.5 text-[11px] font-extrabold text-white"
            style={{ backgroundColor: ch.color || "#0284c7" }}
          >
            {ch.gasCode}
          </span>
        </div>
        <div className="mt-2 text-right font-mono">
          {ch.status === "SENSOR_FAULT" ? (
            <div className="text-xl sm:text-2xl font-black text-purple-300">
              SENSOR FAULT
            </div>
          ) : (
            <div className={`text-3xl sm:text-4xl font-black tracking-tight ${numColor}`}>
              {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
              <span className="ml-1 text-xs font-bold text-slate-400">
                {unitLabel}
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate font-semibold text-slate-300">
            {meta.facilityBadge}
          </span>
          <span className="font-mono font-bold">
            {ch.valveState === 0 ? "OPEN" : "SHUTOFF"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[82vh] rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* 전광판 상단 타이틀 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-cyan-500 px-3 py-1.5 text-sm font-black text-slate-950">
            MONITOR 2 · WALLBOARD
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            ACSC 22채널 특수가스 실시간 통합 전광판 (가스캐비넷 5CH · 오토체인지 6CH)
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm font-bold">
            <span
              className={`h-3 w-3 rounded-full ${
                diagnostics.plcConnected
                  ? "bg-emerald-400 animate-ping"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-slate-200">
              PLC {diagnostics.protocol} · {diagnostics.latencyMs}ms
            </span>
          </div>
          {isStandaloneWallboard && onExitWallboard && (
            <button
              type="button"
              onClick={onExitWallboard}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              🎛️ 조작 대시보드 탭 표시
            </button>
          )}
        </div>
      </div>

      {/* 상단 중앙 스포트라이트 영역 */}
      {spotlightChannels.length > 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/50 via-slate-900 to-purple-950/50 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-black text-rose-300">
              <span className="animate-bounce">🚨</span>
              <span>
                집중 감시 스포트라이트 (위험 저압 / 4~20mA 센서 고장 채널 즉시 조치 요망)
              </span>
            </div>
            <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-extrabold text-rose-200">
              총 {spotlightChannels.length}개 채널 경보 중
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {spotlightChannels.slice(0, 6).map((ch) => {
              const isFault = ch.status === "SENSOR_FAULT";
              const isDanger = ch.status === "DANGER";
              const bankNum = Math.ceil(ch.id / 2);
              const meta = getBankFacilityMeta(bankNum);
              return (
                <div
                  key={ch.id}
                  className={`flex items-center justify-between rounded-2xl border-2 p-4 ${
                    isFault
                      ? "border-purple-400 bg-purple-950/60"
                      : isDanger
                      ? "border-rose-500 bg-rose-950/60 animate-pulse"
                      : "border-amber-400 bg-amber-950/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-black/50 px-2 py-0.5 text-xs font-black text-sky-300">
                        {meta.facilityBadge}
                      </span>
                      <span className="font-mono text-base font-black text-white">
                        {ch.name}
                      </span>
                    </div>
                    <div className="mt-1 text-base font-extrabold text-white">
                      {ch.gasName}
                    </div>
                    <div className="mt-1 text-xs font-bold text-rose-200">
                      {isFault
                        ? `⚡ ${ch.faultReason || "4~20mA 센서 점검 필요"}`
                        : `⏳ ${ch.remainingText}`}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    {isFault ? (
                      <div className="text-3xl font-black text-purple-300">
                        FAULT
                        <div className="text-xs font-normal text-purple-200">
                          Raw: {ch.rawBar}b
                        </div>
                      </div>
                    ) : (
                      <div className="text-4xl sm:text-5xl font-black tracking-tighter text-white">
                        {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
                        <span className="ml-1 text-base text-cyan-300">
                          {unitLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-3">
          <span className="text-sm font-extrabold text-emerald-300">
            ✅ 전 채널(CH01~CH22) 특수가스 공급 압력 및 센서 루프 정상 가동 중
          </span>
          <span className="font-mono text-xs text-emerald-400">
            11뱅크 Smart AI 자동 절체 대기 정상
          </span>
        </div>
      )}

      {/* 1) 가스캐비넷 5CH (10 실린더: CH01~CH10) */}
      <div className="mt-5 rounded-2xl border border-sky-500/40 bg-sky-950/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm sm:text-base font-black text-sky-300">
            🗄️ 1) 가스캐비넷 5CH (모두 A/B 구성 · 10 실린더 : P-CH4, G-CH4, P-H2, MIX(Ar+H2), C2H2)
          </span>
          <span className="font-mono text-xs text-sky-400">CH-01 ~ CH-10</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {cabinetChannels.map(renderWallboardCard)}
        </div>
      </div>

      {/* 2) 오토체인지 6CH (12 실린더: CH11~CH22) */}
      <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm sm:text-base font-black text-emerald-300">
            🔄 2) 오토체인지 6CH (모두 A/B 구성 · 12 실린더 : P-N2, G-N2, He, Ar, O2, G-H2)
          </span>
          <span className="font-mono text-xs text-emerald-400">CH-11 ~ CH-22</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {autoChangeChannels.map(renderWallboardCard)}
        </div>
      </div>
    </div>
  );
}

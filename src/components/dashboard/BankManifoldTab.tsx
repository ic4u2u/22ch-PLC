"use client";

/**
 * 파일명: src/components/dashboard/BankManifoldTab.tsx
 * 역할: [탭 2] 🔀 12뱅크 A/B 매니폴드 뷰 (미팅 스펙 0902_0910 완벽 반영)
 *  - 좌우 A/B 실린더 + 중앙 POU 공급 화살표
 *  - 0:Auto / 1:Smart AI / 2:Dual / 3:Moni 4대 운전 모드 선택
 *  - RUN Time(4.0~6.0s), MX / AI N초, 출력전압(12.0~15.0V) 0.1단위 정밀 조절
 *  - 예비통 빈 상태 사전 경고 배지 (STANDBY_EMPTY_WARN)
 */

import React from "react";
import {
  BankConfig,
  ChannelData,
  PressureUnit,
  formatPressureByUnit,
  getUnitLabel,
} from "./types";

interface BankManifoldTabProps {
  banks: BankConfig[];
  channels: ChannelData[];
  unit: PressureUnit;
  isUnlocked: boolean;
  onUpdateBank: (
    bankId: string,
    updates: Partial<BankConfig>,
    detail: string
  ) => void;
  onRequestPin: () => void;
}

const MODE_LABELS: { mode: 0 | 1 | 2 | 3; label: string }[] = [
  { mode: 0, label: "0: Auto" },
  { mode: 1, label: "1: Smart AI" },
  { mode: 2, label: "2: Dual" },
  { mode: 3, label: "3: Moni" },
];

export default function BankManifoldTab({
  banks,
  channels,
  unit,
  isUnlocked,
  onUpdateBank,
  onRequestPin,
}: BankManifoldTabProps) {
  const unitLabel = getUnitLabel(unit);

  const handleParamAdjust = (
    bank: BankConfig,
    field: "runTimeSec" | "mxFixedSec" | "outputVoltage",
    delta: number,
    min: number,
    max: number,
    label: string
  ) => {
    if (!isUnlocked) {
      onRequestPin();
      return;
    }
    const cur = Number(bank[field] || 0);
    const next = Number(Math.max(min, Math.min(max, cur + delta)).toFixed(1));
    onUpdateBank(
      bank.id,
      { [field]: next },
      `${bank.id} ${label} 변경 (${cur.toFixed(1)} → ${next.toFixed(1)})`
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {banks.map((bank) => {
        const chA = channels[bank.chA - 1];
        const chB = channels[bank.chB - 1];
        const isAActive = bank.activeSide !== "B";
        const isDual = bank.mode === 2;

        return (
          <div
            key={bank.id}
            className={`rounded-2xl border p-4 transition-all ${
              bank.standbyEmptyWarn
                ? "border-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/10"
                : "border-slate-800 bg-slate-900/90"
            }`}
          >
            {/* 상단: 뱅크명, 가스 종류, 사전 경고 배지 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 font-mono text-xs font-black text-cyan-300">
                  {bank.id}
                </span>
                <span className="text-sm font-extrabold text-white">
                  {bank.gasName}
                </span>
              </div>
              {bank.standbyEmptyWarn ? (
                <span className="rounded-lg border border-amber-400 bg-amber-500/25 px-2 py-0.5 text-[11px] font-extrabold text-amber-200 animate-pulse">
                  ⚠️ 예비통 빈 상태 (STANDBY_EMPTY_WARN)
                </span>
              ) : (
                <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  {bank.standbyReady ? "✅ 예비통 Standby 대기 완료" : "🔄 매니폴드 정상"}
                </span>
              )}
            </div>

            {/* 좌우 A/B 실린더 + 중앙 POU 공급 화살표 다이어그램 */}
            <div className="mt-3 grid grid-cols-3 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
              {/* 좌측 A 실린더 */}
              <div
                className={`rounded-xl border p-2.5 text-center ${
                  isAActive || isDual
                    ? "border-emerald-500/60 bg-emerald-950/25"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="text-[11px] font-extrabold text-slate-300">
                  실린더 A (CH{String(bank.chA).padStart(2, "0")})
                </div>
                <div className="mt-1 font-mono text-lg font-black text-white">
                  {chA ? formatPressureByUnit(chA.pressureBar, unit, chA.maxBar) : "0"}{" "}
                  <span className="text-[10px] text-cyan-400">{unitLabel}</span>
                </div>
                <div className="mt-1 text-[10px] font-bold text-emerald-300">
                  {isDual ? "🟢 동시공급(Dual)" : isAActive ? "🟢 주 공급(Active)" : "🟡 예비(Standby)"}
                </div>
              </div>

              {/* 중앙 POU 공급 화살표 */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-black text-cyan-300">
                  ⬆️ POU 라인 공급
                </div>
                <div className="mt-1.5 font-mono text-sm font-black text-emerald-400">
                  {isDual
                    ? "A ➔ POU ⬅ B"
                    : isAActive
                    ? "A ━━━▶ POU"
                    : "POU ◀━━━ B"}
                </div>
                {bank.switchingRemainingSec !== null &&
                  bank.switchingRemainingSec !== undefined && (
                    <div className="mt-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                      절체 지연 {bank.switchingRemainingSec}s
                    </div>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    if (!isUnlocked) return onRequestPin();
                    const nextSide = isAActive ? "B" : "A";
                    onUpdateBank(
                      bank.id,
                      { activeSide: nextSide },
                      `${bank.id} 수동 주 공급 라인 전환 (${bank.activeSide} → ${nextSide})`
                    );
                  }}
                  className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
                >
                  🔄 A/B 수동전환
                </button>
              </div>

              {/* 우측 B 실린더 */}
              <div
                className={`rounded-xl border p-2.5 text-center ${
                  !isAActive || isDual
                    ? "border-emerald-500/60 bg-emerald-950/25"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="text-[11px] font-extrabold text-slate-300">
                  실린더 B (CH{String(bank.chB).padStart(2, "0")})
                </div>
                <div className="mt-1 font-mono text-lg font-black text-white">
                  {chB ? formatPressureByUnit(chB.pressureBar, unit, chB.maxBar) : "0"}{" "}
                  <span className="text-[10px] text-cyan-400">{unitLabel}</span>
                </div>
                <div className="mt-1 text-[10px] font-bold text-amber-300">
                  {isDual ? "🟢 동시공급(Dual)" : !isAActive ? "🟢 주 공급(Active)" : "🟡 예비(Standby)"}
                </div>
              </div>
            </div>

            {/* 4대 운전 모드 선택 (0:Auto / 1:Smart AI / 2:Dual / 3:Moni) */}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {MODE_LABELS.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => {
                    if (!isUnlocked) return onRequestPin();
                    onUpdateBank(
                      bank.id,
                      { mode: m.mode },
                      `${bank.id} 운전 모드 변경 → ${m.label}`
                    );
                  }}
                  className={`min-h-[38px] rounded-xl text-xs font-extrabold transition-all ${
                    bank.mode === m.mode
                      ? "bg-cyan-500 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* 0.1 단위 정밀 파라미터 조절 (RUN Time 4.0~6.0s, MX / AI N초, 출력전압 12.0~15.0V) */}
            <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
              {/* RUN Time (4.0 ~ 6.0s) */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">⏱️ RUN Time (4.0~6.0s)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleParamAdjust(bank, "runTimeSec", -0.1, 4.0, 6.0, "RUN Time")
                    }
                    className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                  >
                    -0.1
                  </button>
                  <span className="w-14 text-center font-mono font-bold text-cyan-300">
                    {Number(bank.runTimeSec).toFixed(1)}s
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleParamAdjust(bank, "runTimeSec", +0.1, 4.0, 6.0, "RUN Time")
                    }
                    className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                  >
                    +0.1
                  </button>
                </div>
              </div>

              {/* MX 고정 지연시간 / Smart AI 실시간 N초 */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  🧠 {bank.mode === 1 ? "Smart AI 산출 N초" : "Auto 고정 MX초"}
                </span>
                {bank.mode === 1 ? (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono font-extrabold text-emerald-300">
                    AI N = {Number(bank.computedAiN || 1.8).toFixed(1)}s (dP/dt 실시간)
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleParamAdjust(
                          bank,
                          "mxFixedSec",
                          -0.1,
                          0.5,
                          Number((bank.runTimeSec - 0.5).toFixed(1)),
                          "MX 지연시간"
                        )
                      }
                      className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                    >
                      -0.1
                    </button>
                    <span className="w-14 text-center font-mono font-bold text-amber-300">
                      {Number(bank.mxFixedSec).toFixed(1)}s
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleParamAdjust(
                          bank,
                          "mxFixedSec",
                          +0.1,
                          0.5,
                          Number((bank.runTimeSec - 0.5).toFixed(1)),
                          "MX 지연시간"
                        )
                      }
                      className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                    >
                      +0.1
                    </button>
                  </div>
                )}
              </div>

              {/* 출력전압 (12.0 ~ 15.0V) */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">⚡ 출력전압 (12.0~15.0V)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleParamAdjust(bank, "outputVoltage", -0.1, 12.0, 15.0, "출력전압")
                    }
                    className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                  >
                    -0.1
                  </button>
                  <span className="w-14 text-center font-mono font-bold text-indigo-300">
                    {Number(bank.outputVoltage).toFixed(1)}V
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleParamAdjust(bank, "outputVoltage", +0.1, 12.0, 15.0, "출력전압")
                    }
                    className="h-7 w-8 rounded bg-slate-800 font-bold hover:bg-slate-700"
                  >
                    +0.1
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

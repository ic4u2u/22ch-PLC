"use client";

/**
 * 파일명: src/components/dashboard/BankManifoldTab.tsx
 * 역할: [탭 2] 🔀 11뱅크 A/B 매니폴드 뷰 (가스캐비넷 5CH / 오토체인지 6CH 구역 분리 UI/UX)
 *  - 1) 가스캐비넷 5CH (모두 A/B 구성 · 10개 실린더: BANK-01 ~ BANK-05)
 *  - 2) 오토체인지 6CH (모두 A/B 구성 · 12개 실린더: BANK-06 ~ BANK-11)
 *  - 좌우 A/B 실린더 + 중앙 POU 공급 화살표 + 0:Auto / 1:Smart AI / 2:Dual / 3:Moni 4모드 제어
 */

import React, { useState } from "react";
import {
  BankConfig,
  ChannelData,
  PressureUnit,
  formatPressureByUnit,
  getBankFacilityMeta,
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
  const [zoneFilter, setZoneFilter] = useState<"ALL" | "CABINET" | "AUTO_CHANGE">(
    "ALL"
  );
  const unitLabel = getUnitLabel(unit);

  const cabinetBanks = banks.filter((b) => b.bankNumber <= 5);
  const autoChangeBanks = banks.filter((b) => b.bankNumber >= 6);

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

  const renderBankCard = (bank: BankConfig) => {
    const chA = channels[bank.chA - 1];
    const chB = channels[bank.chB - 1];
    const isAActive = bank.activeSide !== "B";
    const isDual = bank.mode === 2;
    const meta = getBankFacilityMeta(bank.bankNumber);
    const isCabinet = meta.zone === "CABINET";

    return (
      <div
        key={bank.id}
        className={`rounded-2xl border p-4 transition-all ${
          bank.standbyEmptyWarn
            ? "border-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/10"
            : isCabinet
            ? "border-sky-500/35 bg-slate-900/95"
            : "border-emerald-500/35 bg-slate-900/95"
        }`}
      >
        {/* 상단: 설비 배지(캐비넷/오토체인지), 뱅크명, 가스 종류, 예비통 상태 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-lg border px-2 py-0.5 text-[11px] font-black ${
                isCabinet
                  ? "bg-sky-500/20 border-sky-400/50 text-sky-200"
                  : "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
              }`}
            >
              {meta.facilityBadge}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-black text-cyan-300">
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
              {bank.standbyReady ? "✅ 예비통 대기 완료" : "🔄 매니폴드 정상"}
            </span>
          )}
        </div>

        {/* 좌우 A/B 실린더 + 중앙 POU 공급 화살표 다이어그램 */}
        <div className="mt-3 grid grid-cols-3 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
          {/* 좌측 A실린더 [CH-홀수] */}
          <div
            className={`rounded-xl border p-2.5 text-center ${
              isAActive || isDual
                ? "border-emerald-500/60 bg-emerald-950/25"
                : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <div className="text-[11px] font-extrabold text-blue-200">
              A실린더 [CH-{String(bank.chA).padStart(2, "0")}]
            </div>
            <div className="mt-1 font-mono tabular-nums text-lg font-black text-white">
              {chA ? formatPressureByUnit(chA.pressureBar, unit, chA.maxBar) : "0"}{" "}
              <span className="text-[10px] text-cyan-400">{unitLabel}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold text-emerald-300">
              {isDual
                ? "🟢 동시공급 (Dual)"
                : isAActive
                ? "🟢 공급중 (OPEN)"
                : "⚪ 예비대기 (CLOSE)"}
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
                  `${bank.id} 수동 공급 실린더 전환 (${bank.activeSide}실린더 → ${nextSide}실린더)`
                );
              }}
              className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
            >
              🔄 A/B 수동 절체
            </button>
          </div>

          {/* 우측 B실린더 [CH-짝수] */}
          <div
            className={`rounded-xl border p-2.5 text-center ${
              !isAActive || isDual
                ? "border-emerald-500/60 bg-emerald-950/25"
                : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <div className="text-[11px] font-extrabold text-teal-200">
              B실린더 [CH-{String(bank.chB).padStart(2, "0")}]
            </div>
            <div className="mt-1 font-mono tabular-nums text-lg font-black text-white">
              {chB ? formatPressureByUnit(chB.pressureBar, unit, chB.maxBar) : "0"}{" "}
              <span className="text-[10px] text-cyan-400">{unitLabel}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold text-amber-300">
              {isDual
                ? "🟢 동시공급 (Dual)"
                : !isAActive
                ? "🟢 공급중 (OPEN)"
                : "⚪ 예비대기 (CLOSE)"}
            </div>
          </div>
        </div>

        {/* 4대 운전 모드 선택 */}
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

        {/* 0.1 단위 정밀 파라미터 조절 */}
        <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
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
  };

  return (
    <div className="space-y-5">
      {/* 상단 구역 선택 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-2.5">
        <button
          type="button"
          onClick={() => setZoneFilter("ALL")}
          className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs sm:text-sm font-extrabold transition-all ${
            zoneFilter === "ALL"
              ? "bg-cyan-500 text-slate-950 shadow"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          📊 전체 11뱅크 (22실린더)
        </button>
        <button
          type="button"
          onClick={() => setZoneFilter("CABINET")}
          className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs sm:text-sm font-extrabold transition-all ${
            zoneFilter === "CABINET"
              ? "bg-sky-500 text-slate-950 shadow"
              : "bg-slate-800 text-sky-300 hover:bg-slate-700"
          }`}
        >
          🗄️ 제1구역: 가스캐비닛 5뱅크 (BANK-01~05 · 10실린더)
        </button>
        <button
          type="button"
          onClick={() => setZoneFilter("AUTO_CHANGE")}
          className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs sm:text-sm font-extrabold transition-all ${
            zoneFilter === "AUTO_CHANGE"
              ? "bg-emerald-500 text-slate-950 shadow"
              : "bg-slate-800 text-emerald-300 hover:bg-slate-700"
          }`}
        >
          🔄 제2·3구역: 오토체인지 6뱅크 (BANK-06~11 · 12실린더)
        </button>
      </div>

      {/* 제1구역: 가스캐비닛 5뱅크 (10실린더) */}
      {(zoneFilter === "ALL" || zoneFilter === "CABINET") && (
        <section className="rounded-3xl border-2 border-sky-500/40 bg-sky-950/10 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 pb-2.5">
            <span className="text-sm sm:text-base font-extrabold text-sky-300">
              🗄️ 제1구역: 가스캐비닛 5뱅크 (GC-01~05 · 10실린더 : P-CH4, G-CH4, P-H2, MIX, C2H2)
            </span>
            <span className="font-mono text-xs text-slate-400">
              BANK-01 ~ BANK-05 (CH-01 ~ CH-10)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cabinetBanks.map(renderBankCard)}
          </div>
        </section>
      )}

      {/* 제2·3구역: 오토체인지 6뱅크 (12실린더) */}
      {(zoneFilter === "ALL" || zoneFilter === "AUTO_CHANGE") && (
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-950/10 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-2.5">
            <span className="text-sm sm:text-base font-extrabold text-emerald-300">
              🔄 제2·3구역: 오토체인지 6뱅크 (ACM-01~06 · 12실린더 : P-N2, G-N2, He, Ar, O2, G-H2)
            </span>
            <span className="font-mono text-xs text-slate-400">
              BANK-06 ~ BANK-11 (CH-11 ~ CH-22)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {autoChangeBanks.map(renderBankCard)}
          </div>
        </section>
      )}
    </div>
  );
}

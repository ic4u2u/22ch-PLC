"use client";

/**
 * 파일명: src/components/dashboard/GasFilterBar.tsx
 * 역할: 모니터링 시스템 전용 스마트 가스 선택 필터 & 전체 안전 상태 요약 바
 *  - 전체 11뱅크 모니터링이 기본이며, 원하는 가스(1~11번 뱅크)만 다중 선택해 확대 모니터링 가능
 *  - 일부 가스만 필터링 중에도 나머지 뱅크의 위험/센서고장 발생 시 상단에서 즉시 감지 가능
 */

import React from "react";
import { ChannelData } from "./types";

export interface BankPairItem {
  bankNum: number;
  bankId: string;
  chA: ChannelData;
  chB: ChannelData;
}

interface GasFilterBarProps {
  allPairs: BankPairItem[];
  selectedBankNums: number[]; // 빈 배열이면 '전체 11뱅크' 표시
  onChangeSelectedBanks: (next: number[]) => void;
  onJumpToSpotlight?: () => void;
}

export default function GasFilterBar({
  allPairs,
  selectedBankNums,
  onChangeSelectedBanks,
  onJumpToSpotlight,
}: GasFilterBarProps) {
  const isAll = selectedBankNums.length === 0;

  // 전체 11뱅크 백그라운드 안전 상태 집계 (필터 중에도 사각지대 방지)
  const alarmBanks = allPairs.filter(
    (p) =>
      p.chA.status === "DANGER" ||
      p.chB.status === "DANGER" ||
      p.chA.status === "SENSOR_FAULT" ||
      p.chB.status === "SENSOR_FAULT" ||
      (p.chA.valveState === 1 && p.chA.pressureBar <= p.chA.dangerBar) ||
      (p.chB.valveState === 1 && p.chB.pressureBar <= p.chB.dangerBar)
  );
  const warnBanks = allPairs.filter(
    (p) =>
      !alarmBanks.some((a) => a.bankNum === p.bankNum) &&
      (p.chA.status === "WARN" || p.chB.status === "WARN")
  );

  const toggleBank = (bankNum: number) => {
    if (selectedBankNums.includes(bankNum)) {
      onChangeSelectedBanks(selectedBankNums.filter((n) => n !== bankNum));
    } else {
      const next = [...selectedBankNums, bankNum].sort((a, b) => a - b);
      // 11개 모두 선택하면 자동으로 '전체' 상태로 정규화
      onChangeSelectedBanks(next.length === allPairs.length ? [] : next);
    }
  };

  const isCabinetPreset =
    selectedBankNums.length === 5 &&
    [1, 2, 3, 4, 5].every((n) => selectedBankNums.includes(n));
  const isAutoPreset =
    selectedBankNums.length === 6 &&
    [6, 7, 8, 9, 10, 11].every((n) => selectedBankNums.includes(n));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-3 py-2.5 space-y-2">
      {/* 1행: 빠른 구역 프리셋 + 전체 11뱅크 안전 상태 요약 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black text-cyan-300 mr-1 break-keep">
            🎯 가스 선택 모니터링:
          </span>
          <button
            type="button"
            onClick={() => onChangeSelectedBanks([])}
            className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
              isAll
                ? "bg-cyan-500 text-slate-950 shadow"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            전체 ({allPairs.length}뱅크)
          </button>
          <button
            type="button"
            onClick={() => onChangeSelectedBanks([1, 2, 3, 4, 5])}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              isCabinetPreset
                ? "bg-sky-500 text-slate-950 shadow"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            제1구역: 캐비닛 (1~5)
          </button>
          <button
            type="button"
            onClick={() => onChangeSelectedBanks([6, 7, 8, 9, 10, 11])}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              isAutoPreset
                ? "bg-emerald-500 text-slate-950 shadow"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            제2·3구역: 오토체인지 (6~11)
          </button>
          {alarmBanks.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onChangeSelectedBanks(alarmBanks.map((b) => b.bankNum))
              }
              className="rounded-lg border border-rose-500/60 bg-rose-500/20 px-2.5 py-1 text-xs font-black text-rose-200 hover:bg-rose-500/35 animate-pulse"
            >
              ⚠️ 경보·교체대상만 ({alarmBanks.length})
            </button>
          )}
        </div>

        {/* 백그라운드 전체 11뱅크 안전 상태 배지 */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
            정상 {allPairs.length - alarmBanks.length - warnBanks.length}
          </span>
          {warnBanks.length > 0 && (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-amber-300">
              주의 {warnBanks.length}
            </span>
          )}
          {alarmBanks.length > 0 && (
            <button
              type="button"
              onClick={onJumpToSpotlight}
              className="rounded-md border border-rose-500/60 bg-rose-500/20 px-2 py-0.5 text-rose-200 hover:bg-rose-500/40"
              title="경보 집중뷰로 즉시 이동"
            >
              🚨 위험·교체 {alarmBanks.length}
            </button>
          )}
        </div>
      </div>

      {/* 2행: 개별 1~11번 뱅크 다중 선택 칩 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {allPairs.map((pair) => {
          const selected = selectedBankNums.includes(pair.bankNum);
          const hasAlarm = alarmBanks.some((a) => a.bankNum === pair.bankNum);
          const hasWarn = warnBanks.some((w) => w.bankNum === pair.bankNum);

          return (
            <button
              key={pair.bankId}
              type="button"
              onClick={() => toggleBank(pair.bankNum)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-extrabold transition-all ${
                selected
                  ? "border-cyan-400 bg-cyan-500/25 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                  : hasAlarm
                  ? "border-rose-500/70 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60"
                  : hasWarn
                  ? "border-amber-500/60 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50"
                  : "border-slate-700/80 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: pair.chA.color || "#38bdf8" }}
              />
              <span className="font-mono">{pair.bankNum}B</span>
              <span>{pair.chA.gasName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

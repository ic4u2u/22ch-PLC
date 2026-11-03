"use client";

/**
 * 파일명: src/components/dashboard/ChannelGridTab.tsx
 * 역할: [탭 1] 🟢 22채널 그리드 뷰 (가스캐비넷 5CH[10통] / 오토체인지 6CH[12통] 구역 분리 & 최신 가스통 일러스트 UI/UX)
 *  - 1) 가스캐비넷 5CH (모두 A/B 구성 · 10개 실린더: P-CH4, G-CH4, P-H2, MIX(Ar+H2), C2H2)
 *  - 2) 오토체인지 6CH (모두 A/B 구성 · 12개 실린더: P-N2, G-N2, He, Ar, O2, G-H2)
 *  - 친숙한 A/B 가스통 물높이 잔량 그래픽 + 자동절체기 + 피그테일 호스 + PV/SV 디지털 계기판 + OPEN/CLOSE 원클릭 제어 탑재
 */

import React, { useState } from "react";
import { ChannelData, PressureUnit } from "./types";
import CylinderPairCard from "./CylinderSvgGraphic";

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
  const [zoneFilter, setZoneFilter] = useState<"ALL" | "CABINET" | "AUTO_CHANGE">(
    "ALL"
  );

  // 1) 가스캐비넷 5CH (CH-01 ~ CH-10, 10개 실린더)
  const cabinetChannels = channels.filter((c) => c.id <= 10);
  // 2) 오토체인지 6CH (CH-11 ~ CH-22, 12개 실린더)
  const autoChangeChannels = channels.filter((c) => c.id >= 11);

  const countIssues = (list: ChannelData[]) =>
    list.filter(
      (c) =>
        c.status === "DANGER" ||
        c.status === "WARN" ||
        c.status === "SENSOR_FAULT"
    ).length;

  const cabIssueCount = countIssues(cabinetChannels);
  const autoIssueCount = countIssues(autoChangeChannels);

  // A/B 2개 실린더씩 묶어서 뱅크(라인) 단위로 그룹핑하는 헬퍼
  const buildBankPairs = (list: ChannelData[]) => {
    const pairs: {
      bankNum: number;
      bankId: string;
      chA: ChannelData;
      chB: ChannelData;
    }[] = [];
    for (let i = 0; i < list.length; i += 2) {
      const chA = list[i];
      const chB = list[i + 1];
      if (chA && chB) {
        const bankNum = Math.ceil(chA.id / 2);
        pairs.push({
          bankNum,
          bankId: chA.bankId,
          chA,
          chB,
        });
      }
    }
    return pairs;
  };

  const cabinetPairs = buildBankPairs(cabinetChannels);
  const autoChangePairs = buildBankPairs(autoChangeChannels);

  return (
    <div className="space-y-5">
      {/* 상단: [가스캐비넷 5CH(10통)] vs [오토체인지 6CH(12통)] 한눈에 보는 요약 & 구역 필터 바 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 필터 카드 1: 전체 11뱅크 (22실린더) */}
        <button
          type="button"
          onClick={() => setZoneFilter("ALL")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
            zoneFilter === "ALL"
              ? "border-cyan-400 bg-cyan-950/35 shadow-lg shadow-cyan-500/10"
              : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-cyan-500 px-2.5 py-0.5 text-xs font-black text-slate-950">
                전체 통합 보기
              </span>
              <span className="text-sm font-extrabold text-white">
                총 11채널(뱅크) · 22개 가스통
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              가스캐비넷 5세트(10통) + 오토체인지 6세트(12통) 실린더 그래픽 뷰
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-black text-cyan-300">22 CH</div>
            <div className="text-[11px] text-slate-400">A/B 가스통 모식도</div>
          </div>
        </button>

        {/* 필터 카드 2: 1) 가스캐비넷 5CH (10 실린더) */}
        <button
          type="button"
          onClick={() => setZoneFilter("CABINET")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
            zoneFilter === "CABINET"
              ? "border-sky-400 bg-sky-950/40 shadow-lg shadow-sky-500/15"
              : "border-slate-800 bg-slate-900/80 hover:border-sky-500/50"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-sky-500/25 border border-sky-400/50 px-2.5 py-0.5 text-xs font-black text-sky-200">
                🗄️ 1) 가스캐비넷 5CH
              </span>
              {cabIssueCount > 0 ? (
                <span className="rounded bg-amber-500/25 px-2 py-0.5 text-[11px] font-extrabold text-amber-300">
                  ⚠️ 주의/경보 {cabIssueCount}건
                </span>
              ) : (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  ✅ 전체 정상
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300 font-semibold">
              P-CH4 · G-CH4 · P-H2 · MIX(Ar+H2) · C2H2
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-black text-sky-300">10 통</div>
            <div className="text-[11px] text-slate-400">CH01 ~ CH10</div>
          </div>
        </button>

        {/* 필터 카드 3: 2) 오토체인지 6CH (12 실린더) */}
        <button
          type="button"
          onClick={() => setZoneFilter("AUTO_CHANGE")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
            zoneFilter === "AUTO_CHANGE"
              ? "border-emerald-400 bg-emerald-950/40 shadow-lg shadow-emerald-500/15"
              : "border-slate-800 bg-slate-900/80 hover:border-emerald-500/50"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-500/25 border border-emerald-400/50 px-2.5 py-0.5 text-xs font-black text-emerald-200">
                🔄 2) 오토체인지 6CH
              </span>
              {autoIssueCount > 0 ? (
                <span className="rounded bg-purple-500/30 px-2 py-0.5 text-[11px] font-extrabold text-purple-200">
                  ⚡ 점검 {autoIssueCount}건
                </span>
              ) : (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  ✅ 전체 정상
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300 font-semibold">
              P-N2 · G-N2 · He · Ar · O2 · G-H2(H2저장소)
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-black text-emerald-300">12 통</div>
            <div className="text-[11px] text-slate-400">CH11 ~ CH22</div>
          </div>
        </button>
      </div>

      {/* =====================================================================
          구역 1 : 🗄️ 1) 가스캐비넷 5CH (모두 A/B 구성 · 총 10개 실린더 일러스트)
         ===================================================================== */}
      {(zoneFilter === "ALL" || zoneFilter === "CABINET") && (
        <section className="rounded-3xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl bg-sky-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950 shadow">
                🗄️ 1) 가스캐비넷 구역 (5CH · 10실린더)
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                가연성 특수가스 방폭 캐비넷 5칸 — A/B 실린더 물높이 게이지 & PV/SV 실시간 감시
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-sky-300 font-bold">
                PLC 센서: 1~2단 AD08A · 밸브: 본체 P40~P49
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {cabinetPairs.map((pair) => (
              <CylinderPairCard
                key={pair.bankId}
                bankNum={pair.bankNum}
                bankId={pair.bankId}
                chA={pair.chA}
                chB={pair.chB}
                unit={unit}
                isUnlocked={isUnlocked}
                onToggleValve={onToggleValve}
                onSelectChannel={onSelectChannel}
                onRequestPin={onRequestPin}
              />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          구역 2 : 🔄 2) 오토체인지 6CH (모두 A/B 구성 · 총 12개 실린더 일러스트)
         ===================================================================== */}
      {(zoneFilter === "ALL" || zoneFilter === "AUTO_CHANGE") && (
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl bg-emerald-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950 shadow">
                🔄 2) 오토체인지 구역 (6CH · 12실린더)
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                자동절체기 매니폴드 5세트 + H2 저장소 1세트 — A/B 실린더 물높이 게이지 & PV/SV 실시간 감시
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-emerald-300 font-bold">
                PLC 센서: 2~3단 AD08A · 밸브: 본체 P4A~4B & 4단 RY16A
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {autoChangePairs.map((pair) => (
              <CylinderPairCard
                key={pair.bankId}
                bankNum={pair.bankNum}
                bankId={pair.bankId}
                chA={pair.chA}
                chB={pair.chB}
                unit={unit}
                isUnlocked={isUnlocked}
                onToggleValve={onToggleValve}
                onSelectChannel={onSelectChannel}
                onRequestPin={onRequestPin}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

/**
 * 파일명: src/components/dashboard/ChannelGridTab.tsx
 * 역할: [탭 1] 🟢 22채널 그리드 뷰 (가스캐비넷 5CH[10통] / 오토체인지 6CH[12통] 구역 분리 & A/B 페어 UI/UX)
 *  - 1) 가스캐비넷 5CH (모두 A/B 구성 · 10개 실린더: P-CH4, G-CH4, P-H2, MIX(Ar+H2), C2H2)
 *  - 2) 오토체인지 6CH (모두 A/B 구성 · 12개 실린더: P-N2, G-N2, He, Ar, O2, G-H2)
 *  - 구역 필터(전체 / 가스캐비넷만 / 오토체인지만) 및 A/B 통합 카드 레이아웃으로 한눈에 파악 지원
 */

import React, { useState } from "react";
import {
  ChannelData,
  PressureUnit,
  formatPressureByUnit,
  getBankFacilityMeta,
  getUnitLabel,
} from "./types";

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
  const unitLabel = getUnitLabel(unit);

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

  // 개별 실린더(A 또는 B) 렌더링 카드
  const renderCylinderCard = (ch: ChannelData) => {
    const pct = Math.max(
      0,
      Math.min(100, (ch.pressureBar / (ch.maxBar || 150)) * 100)
    );

    let cardBorder = "border-slate-800 bg-slate-950/90";
    let badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    let statusLabel = "정상 공급";
    let barColor = "bg-emerald-500";

    if (ch.status === "SENSOR_FAULT") {
      cardBorder =
        "border-purple-500 bg-purple-950/35 shadow-lg shadow-purple-500/15";
      badgeStyle =
        "bg-purple-500/30 text-purple-200 border-purple-400 animate-pulse";
      statusLabel = "⚡ 센서 점검";
      barColor = "bg-purple-500";
    } else if (ch.status === "SHUTOFF") {
      cardBorder = "border-slate-700 bg-slate-900/50 opacity-80";
      badgeStyle = "bg-slate-700 text-slate-300 border-slate-600";
      statusLabel = "🔒 밸브 차단";
      barColor = "bg-slate-600";
    } else if (ch.status === "DANGER") {
      cardBorder = "border-rose-500 bg-rose-950/35 shadow-lg shadow-rose-500/15";
      badgeStyle = "bg-rose-500/30 text-rose-200 border-rose-400 animate-pulse";
      statusLabel = "🚨 위험 저압";
      barColor = "bg-rose-500";
    } else if (ch.status === "WARN") {
      cardBorder = "border-amber-500/80 bg-amber-950/25";
      badgeStyle = "bg-amber-500/25 text-amber-200 border-amber-400/50";
      statusLabel = "⚠️ 교체 주의";
      barColor = "bg-amber-400";
    }

    return (
      <div
        key={ch.id}
        className={`flex flex-col justify-between rounded-xl border p-3 transition-all hover:border-cyan-400/70 ${cardBorder}`}
      >
        <div>
          {/* 상단: A/B 실린더 구분 배지 + 상태 + 상세설정 버튼 */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-xs font-black ${
                  ch.side === "A"
                    ? "bg-blue-500/25 text-blue-200 border border-blue-400/40"
                    : "bg-teal-500/25 text-teal-200 border border-teal-400/40"
                }`}
              >
                {ch.side}통 · CH-{String(ch.id).padStart(2, "0")}
              </span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${badgeStyle}`}
              >
                {statusLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectChannel(ch)}
              title="트렌드 차트 & 정밀 영점 보정 (⚙️)"
              className="min-h-[30px] rounded-lg bg-slate-800 px-2 text-[11px] font-bold text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
            >
              📈⚙️
            </button>
          </div>

          {/* 중앙: 디지털 압력 숫자판 */}
          <div
            onClick={() => onSelectChannel(ch)}
            className="mt-2.5 cursor-pointer rounded-xl border border-slate-800/90 bg-slate-900/90 px-3 py-2 text-right shadow-inner"
          >
            {ch.status === "SENSOR_FAULT" ? (
              <div>
                <div className="font-mono text-base font-black text-purple-300">
                  FAULT ({ch.rawBar} bar)
                </div>
                <div className="mt-0.5 truncate text-[10px] font-bold text-purple-400">
                  {ch.faultReason || "4~20mA 센서 신호 이상"}
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
                </span>
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {unitLabel}
                </span>
              </div>
            )}
          </div>

          {/* 잔량 게이지 바 */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* 잔여 시간 & 영점 보정값 */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate font-medium text-slate-300">
              ⏳ {ch.remainingText}
            </span>
            {ch.calibrationOffset !== 0 && (
              <span className="font-mono text-amber-300">
                보정{" "}
                {ch.calibrationOffset > 0
                  ? `+${ch.calibrationOffset}`
                  : ch.calibrationOffset}
                b
              </span>
            )}
          </div>
        </div>

        {/* 하단: 원격 밸브 제어 버튼 */}
        <button
          type="button"
          onClick={() => {
            if (!isUnlocked) {
              onRequestPin();
              return;
            }
            onToggleValve(ch.id, ch.valveState === 0 ? 1 : 0);
          }}
          className={`mt-2.5 min-h-[40px] w-full rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition-all ${
            ch.valveState === 0
              ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 hover:bg-rose-500 hover:text-white"
              : "bg-rose-500/25 border border-rose-500/60 text-rose-200 hover:bg-emerald-500 hover:text-slate-950"
          }`}
        >
          {ch.valveState === 0
            ? "🟢 밸브 OPEN (클릭 시 차단)"
            : "🔴 밸브 SHUTOFF (클릭 시 개방)"}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 상단: [가스캐비넷 5CH(10통)] vs [오토체인지 6CH(12통)] 한눈에 보는 요약 & 필터 바 */}
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
                총 11채널(뱅크) · 22개 실린더
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              가스캐비넷 5세트(10통) + 오토체인지 6세트(12통) 한눈에 보기
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-black text-cyan-300">22 CH</div>
            <div className="text-[11px] text-slate-400">전부 A/B 구성</div>
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
          구역 1 : 🗄️ 1) 가스캐비넷 5CH (모두 A/B 구성 · 총 10개 실린더)
         ===================================================================== */}
      {(zoneFilter === "ALL" || zoneFilter === "CABINET") && (
        <section className="rounded-3xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl bg-sky-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950 shadow">
                🗄️ 1) 가스캐비넷 구역 (5CH · 10실린더)
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                가연성 특수가스 방폭 캐비넷 5칸 (모두 A통·B통 2실린더 구성)
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-sky-300 font-bold">
                PLC 센서: 1~2단 AD08A · 밸브: 본체 P40~P49
              </span>
            </div>
          </div>

          {/* 5개 가스캐비넷 (각 캐비넷 안에 A통 + B통 나란히 배치) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cabinetPairs.map((pair) => {
              const meta = getBankFacilityMeta(pair.bankNum);
              return (
                <div
                  key={pair.bankId}
                  className="rounded-2xl border border-sky-500/30 bg-slate-900/95 p-3.5 shadow-md"
                >
                  {/* 캐비넷 상단 타이틀 바 */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-xs font-black text-sky-200">
                        {meta.facilityBadge}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-extrabold text-white"
                        style={{ backgroundColor: pair.chA.color || "#0284c7" }}
                      >
                        {pair.chA.gasName}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {meta.purityType}
                    </span>
                  </div>

                  {/* 좌측 A통 / 우측 B통 2열 배치 */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {renderCylinderCard(pair.chA)}
                    {renderCylinderCard(pair.chB)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          구역 2 : 🔄 2) 오토체인지 6CH (모두 A/B 구성 · 총 12개 실린더)
         ===================================================================== */}
      {(zoneFilter === "ALL" || zoneFilter === "AUTO_CHANGE") && (
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl bg-emerald-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950 shadow">
                🔄 2) 오토체인지 구역 (6CH · 12실린더)
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                자동절체기 매니폴드 5세트 + H2 저장소 1세트 (모두 A통·B통 2실린더 구성)
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-emerald-300 font-bold">
                PLC 센서: 2~3단 AD08A · 밸브: 본체 P4A~4B & 4단 RY16A
              </span>
            </div>
          </div>

          {/* 6개 오토체인지 세트 (각 매니폴드 안에 A통 + B통 나란히 배치) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {autoChangePairs.map((pair) => {
              const meta = getBankFacilityMeta(pair.bankNum);
              const isH2Room = pair.bankNum === 11;
              return (
                <div
                  key={pair.bankId}
                  className={`rounded-2xl border p-3.5 shadow-md ${
                    isH2Room
                      ? "border-purple-500/40 bg-purple-950/15"
                      : "border-emerald-500/30 bg-slate-900/95"
                  }`}
                >
                  {/* 오토체인지 상단 타이틀 바 */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-xs font-black ${
                          isH2Room
                            ? "bg-purple-500/25 border-purple-400/50 text-purple-200"
                            : "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                        }`}
                      >
                        {meta.facilityBadge}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-extrabold text-white"
                        style={{ backgroundColor: pair.chA.color || "#059669" }}
                      >
                        {pair.chA.gasName}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {meta.purityType}
                    </span>
                  </div>

                  {/* 좌측 A통 / 우측 B통 2열 배치 */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {renderCylinderCard(pair.chA)}
                    {renderCylinderCard(pair.chB)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

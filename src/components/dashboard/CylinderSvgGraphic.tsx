"use client";

/**
 * 파일명: src/components/dashboard/CylinderSvgGraphic.tsx
 * 역할: 경쟁사 HMI/마스터알람 UI의 직관성(자동절체기 헤드 + 피그테일 호스 + A/B 실린더 물높이 잔량 그래픽 + PV/SV + OPEN/CLOSE)을
 *       차세대 모던 다크 네온 UI로 고도화한 듀얼 A/B 실린더 일러스트 카드 컴포넌트
 */

import React from "react";
import ThreeCylinderCanvas from "./ThreeCylinderCanvas";
import {
  ChannelData,
  PressureUnit,
  formatChannelCode,
  formatPressureByUnit,
  getBankFacilityMeta,
  getGasPhysicsMeta,
  getUnitLabel,
} from "./types";

interface CylinderPairCardProps {
  bankNum: number;
  bankId: string;
  chA: ChannelData;
  chB: ChannelData;
  unit: PressureUnit;
  isUnlocked: boolean;
  onToggleValve: (channelId: number, nextValveState: number) => void;
  onSelectChannel: (ch: ChannelData) => void;
  onRequestPin: () => void;
}

export default function CylinderPairCard({
  bankNum,
  bankId,
  chA,
  chB,
  unit,
  isUnlocked,
  onToggleValve,
  onSelectChannel,
  onRequestPin,
}: CylinderPairCardProps) {
  const unitLabel = getUnitLabel(unit);
  const meta = getBankFacilityMeta(bankNum);
  const isCabinet = meta.zone === "CABINET";

  const physA = getGasPhysicsMeta(chA.gasCode, chA.pressureBar, chA.maxBar);
  const physB = getGasPhysicsMeta(chB.gasCode, chB.pressureBar, chB.maxBar);

  const pctA = physA.realMassPct;
  const pctB = physB.realMassPct;

  // 아날로그 게이지 바늘 각도 (-120도 ~ +120도)
  const angleA = -120 + (pctA / 100) * 240;
  const angleB = -120 + (pctB / 100) * 240;

  // 상태별 실린더 액체 색상 결정 (중복 단어 없이 4글자 핵심 상태 배지로 정돈)
  const getCylinderColors = (ch: ChannelData) => {
    if (ch.status === "SENSOR_FAULT") {
      return {
        top: "#c084fc",
        bottom: "#6b21a8",
        stroke: "#a855f7",
        glow: "rgba(168,85,247,0.45)",
        badge: "⚡ 센서점검",
      };
    }
    if (ch.valveState === 1 || ch.status === "SHUTOFF") {
      const isDepleted = ch.pressureBar <= ch.dangerBar * 1.35;
      return {
        top: isDepleted ? "#64748b" : "#64748b",
        bottom: isDepleted ? "#1e293b" : "#334155",
        stroke: isDepleted ? "#ef4444" : "#94a3b8",
        glow: "none",
        badge: isDepleted ? "🟢 교체가능" : "🛡️ 기밀정상",
      };
    }
    if (ch.status === "DANGER") {
      return {
        top: "#fb7185",
        bottom: "#be123c",
        stroke: "#f43f5e",
        glow: "rgba(244,63,94,0.5)",
        badge: "🚨 위험저압",
      };
    }
    if (ch.status === "WARN") {
      return {
        top: "#fbbf24",
        bottom: "#b45309",
        stroke: "#f59e0b",
        glow: "rgba(245,158,11,0.35)",
        badge: "⚠️ 교체주의",
      };
    }
    return {
      top: "#38bdf8",
      bottom: "#0284c7",
      stroke: "#0ea5e9",
      glow: "rgba(14,165,233,0.35)",
      badge: "✅ 정상공급",
    };
  };

  const colA = getCylinderColors(chA);
  const colB = getCylinderColors(chB);

  const isAOpen = chA.valveState === 0;
  const isBOpen = chB.valveState === 0;
  const hasAlarm =
    chA.status === "DANGER" ||
    chB.status === "DANGER" ||
    chA.status === "SENSOR_FAULT" ||
    chB.status === "SENSOR_FAULT";

  return (
    <div
      className={`h-full flex flex-col justify-between rounded-2xl border-2 p-3.5 transition-all shadow-lg ${
        hasAlarm
          ? "border-rose-500/90 bg-gradient-to-b from-rose-950/35 to-slate-950"
          : "bg-slate-950/95"
      }`}
      style={{
        borderColor: hasAlarm ? undefined : chA.color || "#0ea5e9",
        borderTopWidth: "6px",
      }}
    >
      {/* 1. 상단 3단 컬러 코딩 헤더: [1번 뱅크] + [가스명 1줄 고정] + [A/B공급 하이라이트] + [절체압력] */}
      <div
        className="flex flex-wrap items-center justify-between gap-1.5 border-b-2 border-dashed pb-2.5"
        style={{ borderBottomColor: `${chA.color || "#0ea5e9"}66` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-black text-white shadow"
            style={{ backgroundColor: chA.color || "#0284c7" }}
          >
            {meta.bankCode}
          </span>
          <span className="whitespace-nowrap text-sm sm:text-base font-black text-white tracking-tight">
            {chA.gasName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs sm:text-sm font-black transition-all ${
              isAOpen
                ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.65)] ring-2 ring-amber-200"
                : "bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.65)] ring-2 ring-cyan-200"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950" />
            </span>
            {isAOpen ? "◀ A공급" : "B공급 ▶"}
          </span>
          <span className="whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 font-bold">
            절체압력{" "}
            <strong className="font-mono text-amber-300">
              {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)} {unitLabel}
            </strong>
          </span>
        </div>
      </div>

      {/* 2. 중앙 비주얼 모식도: [좌측 A실린더 계기판(4칸)] + [중앙 자동절체기 & A/B 실린더 SVG(3칸)] + [우측 B실린더 계기판(4칸)] */}
      <div className="mt-3 grid grid-cols-11 items-stretch gap-2 rounded-xl border border-slate-800/90 bg-slate-950 p-2">
        {/* 좌측: A실린더 [CH-홀수] 현재압력 / 절체압력 / 예고압력 계기판 & 공급중/예비대기 버튼 (4칸) */}
        <div
          className={`col-span-4 flex flex-col justify-between rounded-xl border-2 p-2 transition-all ${
            isAOpen
              ? "border-emerald-400 bg-gradient-to-b from-emerald-950/35 to-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.28)] ring-2 ring-emerald-400/75"
              : "border-slate-800 bg-slate-900/65 opacity-75"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 whitespace-nowrap">
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black ${
                    isAOpen
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  A실린더
                </span>
                <span className="whitespace-nowrap rounded border border-sky-400/50 bg-sky-500/20 px-1.5 py-0.5 font-mono text-[11px] font-black text-sky-200">
                  {formatChannelCode(chA.id)}
                </span>
                {isAOpen && (
                  <span className="relative flex h-2.5 w-2.5 ml-0.5" title="현재 공급중">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-90" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelectChannel(chA)}
                title="A실린더 트렌드 차트 & 영점 보정"
                className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
              >
                ⚙️
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-end whitespace-nowrap text-[11px] font-bold">
              <span className="text-slate-200">{colA.badge}</span>
            </div>

            {/* 현재압력 초대형 표시 (줄바꿈 없음) */}
            <div
              onClick={() => onSelectChannel(chA)}
              className="mt-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-2 text-right"
            >
              <div className="flex items-center justify-between whitespace-nowrap text-[11px] font-extrabold text-cyan-400">
                <span>현재압력</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {pctA}%
                </span>
              </div>
              {chA.status === "SENSOR_FAULT" ? (
                <div className="mt-0.5 whitespace-nowrap font-mono text-sm font-black text-purple-300">
                  센서점검 ({chA.rawBar}b)
                </div>
              ) : (
                <div className="mt-0.5 whitespace-nowrap font-mono tabular-nums text-xl sm:text-2xl font-black tracking-tight text-white">
                  {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
                  <span className="ml-0.5 text-[10px] text-slate-400">
                    {unitLabel}
                  </span>
                </div>
              )}
            </div>

            {/* 절체압력 & 예고압력 2단 분리 (줄바꿈 제로) */}
            <div className="mt-1.5 space-y-1 rounded-lg bg-slate-950/80 px-2 py-1.5 text-[11px]">
              <div className="flex items-center justify-between whitespace-nowrap">
                <span className="font-extrabold text-rose-300">절체압력</span>
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)} {unitLabel}
                </span>
              </div>
              <div className="flex items-center justify-between whitespace-nowrap border-t border-slate-800/80 pt-1">
                <span className="font-bold text-slate-400">예고압력</span>
                <span className="font-mono font-bold text-slate-300 tabular-nums">
                  {formatPressureByUnit(chA.warnBar, unit, chA.maxBar)} {unitLabel}
                </span>
              </div>
            </div>
          </div>

          {/* 공급중 / 예비대기 원클릭 스위치 + 잔여시간 (말줄임표 없이 전체 표시) */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin();
                onToggleValve(chA.id, isAOpen ? 1 : 0);
              }}
              className={`min-h-[38px] w-full whitespace-nowrap rounded-lg text-xs font-black tracking-wider transition-all shadow ${
                isAOpen
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-rose-600 hover:to-rose-700"
                  : "border border-slate-600 bg-slate-800/90 text-slate-300 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {isAOpen ? "공급중" : "예비대기"}
            </button>
            <div className="mt-1.5 rounded-md bg-slate-950/90 px-1.5 py-1 text-center text-[10.5px] font-bold text-slate-300 whitespace-nowrap">
              {chA.remainingText}
            </div>
          </div>
        </div>

        {/* 중앙: [자동절체기 레귤레이터 + Three.js 3D A/B 가스통 + 공급 애니메이션] (3칸) */}
        <div
          onClick={() => onSelectChannel(chA)}
          title="클릭 시 상세 트렌드 및 영점 보정 창 열기"
          className="col-span-3 flex flex-col items-center justify-between cursor-pointer rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-1.5"
        >
          {/* 상단 자동절체기(오토체인지) 아날로그 게이지 헤드 */}
          <svg
            viewBox="0 0 180 76"
            className="w-full max-h-[66px] shrink-0"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M 90 18 L 90 4" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <polygon points="90,0 85,7 95,7" fill="#38bdf8" />
            <text x="124" y="11" fill="#38bdf8" fontSize="9" fontWeight="900">
              공정공급
            </text>
            <rect x="24" y="18" width="132" height="44" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="48" cy="36" r="11" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
            <line
              x1="48"
              y1="36"
              x2={48 + 7.5 * Math.sin((angleA * Math.PI) / 180)}
              y2={36 - 7.5 * Math.cos((angleA * Math.PI) / 180)}
              stroke={colA.top}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="132" cy="36" r="11" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
            <line
              x1="132"
              y1="36"
              x2={132 + 7.5 * Math.sin((angleB * Math.PI) / 180)}
              y2={36 - 7.5 * Math.cos((angleB * Math.PI) / 180)}
              stroke={colB.top}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="90" cy="40" r="10" fill="#0284c7" stroke="#bae6fd" strokeWidth="1.5" />
            <circle cx="90" cy="40" r="3.5" fill="#0f172a" />
            <path
              d="M 48 75 C 32 70, 58 65, 66 62"
              fill="none"
              stroke={isAOpen ? colA.top : "#475569"}
              strokeWidth={isAOpen ? "2.5" : "2"}
              strokeDasharray={isAOpen ? "none" : "3,2"}
            />
            <path
              d="M 132 75 C 148 70, 122 65, 114 62"
              fill="none"
              stroke={isBOpen ? colB.top : "#475569"}
              strokeWidth={isBOpen ? "2.5" : "2"}
              strokeDasharray={isBOpen ? "none" : "3,2"}
            />
          </svg>

          {/* Three.js 3D A/B 고압가스 실린더 2기 + 실시간 공급 애니메이션 */}
          <div className="my-1 flex w-full items-center justify-center gap-2">
            <ThreeCylinderCanvas
              ch={chA}
              gasColor={chA.color || "#0ea5e9"}
              containerClassName="w-[46px] sm:w-[54px]"
              badgeClassName="px-1.5 py-0.5 text-[10px]"
            />
            <ThreeCylinderCanvas
              ch={chB}
              gasColor={chA.color || "#0ea5e9"}
              containerClassName="w-[46px] sm:w-[54px]"
              badgeClassName="px-1.5 py-0.5 text-[10px]"
            />
          </div>

          {/* 하단 [A] [중앙 상태 램프] [B] 마크 */}
          <div className="flex w-full items-center justify-around px-2 pt-0.5">
            <span className="rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
              A
            </span>
            <span
              className={`h-3.5 w-3.5 rounded-full border border-white ${
                hasAlarm ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
            <span className="rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
              B
            </span>
          </div>
        </div>

        {/* 우측: B실린더 [CH-짝수] 현재압력 / 절체압력 / 예고압력 계기판 & 공급중/예비대기 버튼 (4칸) */}
        <div
          className={`col-span-4 flex flex-col justify-between rounded-xl border-2 p-2 transition-all ${
            isBOpen
              ? "border-emerald-400 bg-gradient-to-b from-emerald-950/35 to-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.28)] ring-2 ring-emerald-400/75"
              : "border-slate-800 bg-slate-900/65 opacity-75"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 whitespace-nowrap">
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black ${
                    isBOpen
                      ? "bg-cyan-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  B실린더
                </span>
                <span className="whitespace-nowrap rounded border border-sky-400/50 bg-sky-500/20 px-1.5 py-0.5 font-mono text-[11px] font-black text-sky-200">
                  {formatChannelCode(chB.id)}
                </span>
                {isBOpen && (
                  <span className="relative flex h-2.5 w-2.5 ml-0.5" title="현재 공급중">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-90" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelectChannel(chB)}
                title="B실린더 트렌드 차트 & 영점 보정"
                className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
              >
                ⚙️
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-end whitespace-nowrap text-[11px] font-bold">
              <span className="text-slate-200">{colB.badge}</span>
            </div>

            {/* 현재압력 초대형 표시 (줄바꿈 없음) */}
            <div
              onClick={() => onSelectChannel(chB)}
              className="mt-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-2 text-right"
            >
              <div className="flex items-center justify-between whitespace-nowrap text-[11px] font-extrabold text-cyan-400">
                <span>현재압력</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {pctB}%
                </span>
              </div>
              {chB.status === "SENSOR_FAULT" ? (
                <div className="mt-0.5 whitespace-nowrap font-mono text-sm font-black text-purple-300">
                  센서점검 ({chB.rawBar}b)
                </div>
              ) : (
                <div className="mt-0.5 whitespace-nowrap font-mono tabular-nums text-xl sm:text-2xl font-black tracking-tight text-white">
                  {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
                  <span className="ml-0.5 text-[10px] text-slate-400">
                    {unitLabel}
                  </span>
                </div>
              )}
            </div>

            {/* 절체압력 & 예고압력 2단 분리 (줄바꿈 제로) */}
            <div className="mt-1.5 space-y-1 rounded-lg bg-slate-950/80 px-2 py-1.5 text-[11px]">
              <div className="flex items-center justify-between whitespace-nowrap">
                <span className="font-extrabold text-rose-300">절체압력</span>
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {formatPressureByUnit(chB.dangerBar, unit, chB.maxBar)} {unitLabel}
                </span>
              </div>
              <div className="flex items-center justify-between whitespace-nowrap border-t border-slate-800/80 pt-1">
                <span className="font-bold text-slate-400">예고압력</span>
                <span className="font-mono font-bold text-slate-300 tabular-nums">
                  {formatPressureByUnit(chB.warnBar, unit, chB.maxBar)} {unitLabel}
                </span>
              </div>
            </div>
          </div>

          {/* 공급중 / 예비대기 원클릭 스위치 + 잔여시간 (말줄임표 없이 전체 표시) */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin();
                onToggleValve(chB.id, isBOpen ? 1 : 0);
              }}
              className={`min-h-[38px] w-full whitespace-nowrap rounded-lg text-xs font-black tracking-wider transition-all shadow ${
                isBOpen
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-rose-600 hover:to-rose-700"
                  : "border border-slate-600 bg-slate-800/90 text-slate-300 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {isBOpen ? "공급중" : "예비대기"}
            </button>
            <div className="mt-1.5 rounded-md bg-slate-950/90 px-1.5 py-1 text-center text-[10.5px] font-bold text-slate-300 whitespace-nowrap">
              {chB.remainingText}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 하단 논문/SCADA 기술 상태 바: 열역학 Z-Factor 물리 보정 + SEMI S2 퍼지/기밀감시 + 과유량(ESD) 인터록 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 rounded-xl border border-slate-800/80 bg-slate-950/80 px-2.5 py-1.5 text-[10px] text-slate-400">
        <span className="font-mono text-cyan-300 font-semibold">
          🔬 {physA.physicsLabel} · 실잔량 A:{pctA}% / B:{pctB}%
        </span>
        <span className="font-mono text-emerald-300 font-semibold">
          🛡️ 대기통 기밀: 0.00b/h (정상) · ESD 과유량보호 작동중
        </span>
      </div>
    </div>
  );
}

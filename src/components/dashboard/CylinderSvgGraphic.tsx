"use client";

/**
 * 파일명: src/components/dashboard/CylinderSvgGraphic.tsx
 * 역할: 경쟁사 HMI/마스터알람 UI의 직관성(자동절체기 헤드 + 피그테일 호스 + A/B 실린더 물높이 잔량 그래픽 + PV/SV + OPEN/CLOSE)을
 *       차세대 모던 다크 네온 UI로 고도화한 듀얼 A/B 실린더 일러스트 카드 컴포넌트
 */

import React from "react";
import {
  ChannelData,
  PressureUnit,
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

  // 상태별 실린더 액체 색상 결정
  const getCylinderColors = (ch: ChannelData) => {
    if (ch.status === "SENSOR_FAULT") {
      return {
        top: "#c084fc",
        bottom: "#6b21a8",
        stroke: "#a855f7",
        glow: "rgba(168,85,247,0.45)",
        badge: "⚡ 센서이상",
      };
    }
    if (ch.valveState === 1 || ch.status === "SHUTOFF") {
      const isDepleted = ch.pressureBar <= ch.dangerBar * 1.35;
      return {
        top: isDepleted ? "#64748b" : "#64748b",
        bottom: isDepleted ? "#1e293b" : "#334155",
        stroke: isDepleted ? "#ef4444" : "#94a3b8",
        glow: "none",
        badge: isDepleted ? "🟢 퍼지완료·교체가능" : "🛡️ 예비대기(기밀정상)",
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
      badge: "정상 공급",
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
      className={`rounded-2xl border-2 p-3.5 transition-all shadow-lg ${
        hasAlarm
          ? "border-rose-500/90 bg-gradient-to-b from-rose-950/30 to-slate-900"
          : "bg-slate-900/95"
      }`}
      style={{
        borderColor: hasAlarm ? undefined : chA.color || "#0ea5e9",
        borderTopWidth: "6px",
      }}
    >
      {/* 1. 상단 헤더: 설비 구분(캐비넷/오토체인지) + 가스 이름표 + 설정압력(SV) */}
      <div
        className="flex flex-wrap items-center justify-between gap-1.5 border-b-2 border-dashed pb-2.5"
        style={{ borderBottomColor: `${chA.color || "#0ea5e9"}66` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-lg border px-2 py-0.5 text-[11px] font-black ${
              isCabinet
                ? "bg-sky-500/20 border-sky-400/50 text-sky-200"
                : "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
            }`}
          >
            {meta.facilityBadge}
          </span>
          <span
            className="rounded-lg px-2.5 py-0.5 text-xs sm:text-sm font-black text-white shadow tracking-tight"
            style={{ backgroundColor: chA.color || "#0284c7" }}
          >
            {chA.gasName} (A·B 2통 세트)
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span
            className={`rounded px-2 py-0.5 font-extrabold ${
              isAOpen
                ? "bg-sky-500/25 text-sky-300 border border-sky-400/50"
                : "bg-teal-500/25 text-teal-300 border border-teal-400/50"
            }`}
          >
            {isAOpen ? "◀ A통 공급중 (B대기)" : "B통 공급중 (A대기) ▶"}
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 font-bold">
            절체SV:{" "}
            <strong className="text-amber-300">
              {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)} {unitLabel}
            </strong>
          </span>
        </div>
      </div>

      {/* 2. 중앙 비주얼 모식도: [좌측 A-Cylinder 계기판] + [중앙 자동절체기 & A/B 가스통 SVG] + [우측 B-Cylinder 계기판] */}
      <div className="mt-3 grid grid-cols-12 items-stretch gap-2 rounded-xl border border-slate-800/90 bg-slate-950 p-2.5">
        {/* 좌측: A-Cylinder PV / SV 디지털 계기판 & OPEN/CLOSE 버튼 (4칸) */}
        <div className="col-span-4 flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-950">
                A-Cylinder
              </span>
              <button
                type="button"
                onClick={() => onSelectChannel(chA)}
                title="A통 트렌드 차트 & 영점 보정"
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
              >
                ⚙️
              </button>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              CH-{String(chA.id).padStart(2, "0")} · {colA.badge}
            </div>

            {/* PV (현재 압력) 초대형 표시 */}
            <div
              onClick={() => onSelectChannel(chA)}
              className="mt-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-2 text-right"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-cyan-400">
                <span>PV</span>
                <span>현재압력</span>
              </div>
              {chA.status === "SENSOR_FAULT" ? (
                <div className="mt-0.5 font-mono text-sm font-black text-purple-300">
                  FAULT ({chA.rawBar}b)
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-xl sm:text-2xl font-black tracking-tight text-white">
                  {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
                  <span className="ml-0.5 text-[10px] text-slate-400">
                    {unitLabel}
                  </span>
                </div>
              )}
            </div>

            {/* SV (설정 경보 압력) 표시 */}
            <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-950/70 px-2 py-1 font-mono text-[11px]">
              <span className="font-bold text-slate-400">SV (기준)</span>
              <span className="font-bold text-amber-300">
                {formatPressureByUnit(chA.warnBar, unit, chA.maxBar)} {unitLabel}
              </span>
            </div>
          </div>

          {/* OPEN / CLOSE 원클릭 스위치 + 잔여시간 */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin();
                onToggleValve(chA.id, isAOpen ? 1 : 0);
              }}
              className={`min-h-[38px] w-full rounded-lg font-mono text-xs font-black tracking-wider transition-all shadow ${
                isAOpen
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-rose-600 hover:to-rose-700"
                  : "border border-rose-500/60 bg-rose-950/50 text-rose-300 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {isAOpen ? "OPEN" : "CLOSE"}
            </button>
            <div className="mt-1 truncate text-center text-[10px] font-semibold text-slate-400">
              {chA.remainingText}
            </div>
          </div>
        </div>

        {/* 중앙: 경쟁사 1+2번 스타일 [자동절체기 레귤레이터 + 피그테일 호스 + A/B 가스통 물높이 SVG 일러스트] (4칸) */}
        <div
          onClick={() => onSelectChannel(chA)}
          title="클릭 시 상세 트렌드 및 영점 보정 창 열기"
          className="col-span-4 flex flex-col items-center justify-between cursor-pointer rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-1.5"
        >
          <svg
            viewBox="0 0 180 220"
            className="h-full w-full max-h-[210px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* A통 액체 그라데이션 */}
              <linearGradient id={`gradA-${bankId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colA.top} />
                <stop offset="100%" stopColor={colA.bottom} />
              </linearGradient>
              {/* B통 액체 그라데이션 */}
              <linearGradient id={`gradB-${bankId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colB.top} />
                <stop offset="100%" stopColor={colB.bottom} />
              </linearGradient>
              {/* A통 클립 패스 */}
              <clipPath id={`clipA-${bankId}`}>
                <path d="M 22 108 Q 22 92 37 92 L 53 92 Q 68 92 68 108 L 68 192 Q 68 198 62 198 L 28 198 Q 22 198 22 192 Z" />
              </clipPath>
              {/* B통 클립 패스 */}
              <clipPath id={`clipB-${bankId}`}>
                <path d="M 112 108 Q 112 92 127 92 L 143 92 Q 158 92 158 108 L 158 192 Q 158 198 152 198 L 118 198 Q 112 198 112 192 Z" />
              </clipPath>
            </defs>

            {/* 상단 POU 공급 출구 화살표 */}
            <path
              d="M 90 18 L 90 4"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <polygon points="90,0 85,7 95,7" fill="#38bdf8" />
            <text
              x="124"
              y="11"
              fill="#38bdf8"
              fontSize="9"
              fontWeight="900"
            >
              POU 공급
            </text>

            {/* 상단 자동절체기(오토체인지/매니폴드 컨트롤러) 박스 */}
            <rect
              x="24"
              y="18"
              width="132"
              height="46"
              rx="6"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* 좌측 A 아날로그 압력 게이지 */}
            <circle
              cx="48"
              cy="36"
              r="12"
              fill="#0f172a"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <line
              x1="48"
              y1="36"
              x2={48 + 8 * Math.sin((angleA * Math.PI) / 180)}
              y2={36 - 8 * Math.cos((angleA * Math.PI) / 180)}
              stroke={colA.top}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* 우측 B 아날로그 압력 게이지 */}
            <circle
              cx="132"
              cy="36"
              r="12"
              fill="#0f172a"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <line
              x1="132"
              y1="36"
              x2={132 + 8 * Math.sin((angleB * Math.PI) / 180)}
              y2={36 - 8 * Math.cos((angleB * Math.PI) / 180)}
              stroke={colB.top}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* 중앙 절체 레귤레이터 핸들 */}
            <circle
              cx="90"
              cy="41"
              r="11"
              fill="#0284c7"
              stroke="#bae6fd"
              strokeWidth="1.5"
            />
            <circle cx="90" cy="41" r="4" fill="#0f172a" />

            {/* 피그테일(Pigtail) 고압 호스 곡선 (A통 -> 절체기, B통 -> 절체기) */}
            <path
              d="M 45 78 C 20 72, 62 68, 66 64"
              fill="none"
              stroke={isAOpen ? colA.top : "#475569"}
              strokeWidth={isAOpen ? "3" : "2"}
              strokeDasharray={isAOpen ? "none" : "3,2"}
            />
            <path
              d="M 135 78 C 160 72, 118 68, 114 64"
              fill="none"
              stroke={isBOpen ? colB.top : "#475569"}
              strokeWidth={isBOpen ? "3" : "2"}
              strokeDasharray={isBOpen ? "none" : "3,2"}
            />

            {/* ================= 좌측 A 가스통 (A-Cylinder) ================= */}
            {/* 황동 밸브 넥 & 핸들 */}
            <rect x="39" y="76" width="12" height="7" rx="1.5" fill="#eab308" />
            <rect x="41" y="83" width="8" height="9" fill="#94a3b8" />
            <ellipse
              cx="45"
              cy="74"
              rx="8"
              ry="2.5"
              fill={isAOpen ? "#38bdf8" : "#64748b"}
            />

            {/* A 가스통 빈 배경 몸통 */}
            <path
              d="M 22 108 Q 22 92 37 92 L 53 92 Q 68 92 68 108 L 68 192 Q 68 198 62 198 L 28 198 Q 22 198 22 192 Z"
              fill="#0f172a"
              stroke={colA.stroke}
              strokeWidth="2"
            />

            {/* A 가스통 실시간 잔량 물높이 채움 */}
            <g clipPath={`url(#clipA-${bankId})`}>
              <rect
                x="20"
                y={198 - (106 * pctA) / 100}
                width="50"
                height={(106 * pctA) / 100 + 4}
                fill={`url(#gradA-${bankId})`}
              />
              {/* 물결 하이라이트 선 */}
              <line
                x1="20"
                y1={198 - (106 * pctA) / 100}
                x2="70"
                y2={198 - (106 * pctA) / 100}
                stroke="#ffffff"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
            </g>

            {/* A 가스통 외곽선 및 눈금선 */}
            <path
              d="M 22 108 Q 22 92 37 92 L 53 92 Q 68 92 68 108 L 68 192 Q 68 198 62 198 L 28 198 Q 22 198 22 192 Z"
              fill="none"
              stroke={colA.stroke}
              strokeWidth="2"
            />
            {/* 가스통 입체 광택 효과 */}
            <line
              x1="29"
              y1="104"
              x2="29"
              y2="188"
              stroke="#ffffff"
              strokeOpacity="0.22"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              x="45"
              y="150"
              fill="#ffffff"
              fontSize="12"
              fontWeight="900"
              textAnchor="middle"
              style={{ textShadow: "0 1px 4px #000" }}
            >
              {pctA}%
            </text>

            {/* ================= 우측 B 가스통 (B-Cylinder) ================= */}
            {/* 황동 밸브 넥 & 핸들 */}
            <rect x="129" y="76" width="12" height="7" rx="1.5" fill="#eab308" />
            <rect x="131" y="83" width="8" height="9" fill="#94a3b8" />
            <ellipse
              cx="135"
              cy="74"
              rx="8"
              ry="2.5"
              fill={isBOpen ? "#38bdf8" : "#64748b"}
            />

            {/* B 가스통 빈 배경 몸통 */}
            <path
              d="M 112 108 Q 112 92 127 92 L 143 92 Q 158 92 158 108 L 158 192 Q 158 198 152 198 L 118 198 Q 112 198 112 192 Z"
              fill="#0f172a"
              stroke={colB.stroke}
              strokeWidth="2"
            />

            {/* B 가스통 실시간 잔량 물높이 채움 */}
            <g clipPath={`url(#clipB-${bankId})`}>
              <rect
                x="110"
                y={198 - (106 * pctB) / 100}
                width="50"
                height={(106 * pctB) / 100 + 4}
                fill={`url(#gradB-${bankId})`}
              />
              <line
                x1="110"
                y1={198 - (106 * pctB) / 100}
                x2="160"
                y2={198 - (106 * pctB) / 100}
                stroke="#ffffff"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
            </g>

            {/* B 가스통 외곽선 및 입체 광택 */}
            <path
              d="M 112 108 Q 112 92 127 92 L 143 92 Q 158 92 158 108 L 158 192 Q 158 198 152 198 L 118 198 Q 112 198 112 192 Z"
              fill="none"
              stroke={colB.stroke}
              strokeWidth="2"
            />
            <line
              x1="119"
              y1="104"
              x2="119"
              y2="188"
              stroke="#ffffff"
              strokeOpacity="0.22"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              x="135"
              y="150"
              fill="#ffffff"
              fontSize="12"
              fontWeight="900"
              textAnchor="middle"
              style={{ textShadow: "0 1px 4px #000" }}
            >
              {pctB}%
            </text>

            {/* 하단 경쟁사 1번 스타일: [A] [중앙 상태 램프] [B] 마크 */}
            <rect
              x="31"
              y="202"
              width="28"
              height="16"
              rx="3"
              fill="#facc15"
              stroke="#0f172a"
            />
            <text
              x="45"
              y="214"
              fill="#0f172a"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
            >
              A
            </text>

            {/* 중앙 상태 표시 램프 (정상: 에메랄드, 경보: 레드 점멸) */}
            <circle
              cx="90"
              cy="210"
              r="8"
              fill={hasAlarm ? "#f43f5e" : "#10b981"}
              stroke="#ffffff"
              strokeWidth="1.5"
            />

            <rect
              x="121"
              y="202"
              width="28"
              height="16"
              rx="3"
              fill="#facc15"
              stroke="#0f172a"
            />
            <text
              x="135"
              y="214"
              fill="#0f172a"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
            >
              B
            </text>
          </svg>
        </div>

        {/* 우측: B-Cylinder PV / SV 디지털 계기판 & OPEN/CLOSE 버튼 (4칸) */}
        <div className="col-span-4 flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-950">
                B-Cylinder
              </span>
              <button
                type="button"
                onClick={() => onSelectChannel(chB)}
                title="B통 트렌드 차트 & 영점 보정"
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-cyan-500 hover:text-slate-950"
              >
                ⚙️
              </button>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              CH-{String(chB.id).padStart(2, "0")} · {colB.badge}
            </div>

            {/* PV (현재 압력) 초대형 표시 */}
            <div
              onClick={() => onSelectChannel(chB)}
              className="mt-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-2 text-right"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-cyan-400">
                <span>PV</span>
                <span>현재압력</span>
              </div>
              {chB.status === "SENSOR_FAULT" ? (
                <div className="mt-0.5 font-mono text-sm font-black text-purple-300">
                  FAULT ({chB.rawBar}b)
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-xl sm:text-2xl font-black tracking-tight text-white">
                  {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
                  <span className="ml-0.5 text-[10px] text-slate-400">
                    {unitLabel}
                  </span>
                </div>
              )}
            </div>

            {/* SV (설정 경보 압력) 표시 */}
            <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-950/70 px-2 py-1 font-mono text-[11px]">
              <span className="font-bold text-slate-400">SV (기준)</span>
              <span className="font-bold text-amber-300">
                {formatPressureByUnit(chB.warnBar, unit, chB.maxBar)} {unitLabel}
              </span>
            </div>
          </div>

          {/* OPEN / CLOSE 원클릭 스위치 + 잔여시간 */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin();
                onToggleValve(chB.id, isBOpen ? 1 : 0);
              }}
              className={`min-h-[38px] w-full rounded-lg font-mono text-xs font-black tracking-wider transition-all shadow ${
                isBOpen
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-rose-600 hover:to-rose-700"
                  : "border border-rose-500/60 bg-rose-950/50 text-rose-300 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {isBOpen ? "OPEN" : "CLOSE"}
            </button>
            <div className="mt-1 truncate text-center text-[10px] font-semibold text-slate-400">
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

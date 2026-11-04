"use client";

/**
 * 파일명: src/components/dashboard/WallboardCompactCard.tsx
 * 역할: 대형 벽걸이 TV 전광판 전용 멀티 뷰 카드 모음
 *  1) OneScreenCylinderCard : 1920x1080 1화면에 11뱅크(상단 캐비넷 5칸 + 하단 오토체인지 6칸 = 22실린더)를
 *                             스크롤 없이 한눈에 보여주는 고밀도 A/B 가스통 그래픽 카드
 *  2) MasterAlarmCard       : 경쟁사 2번(벽걸이 가스 마스터 알람) 스타일의 A/B 실린더 + 초대형 PV/SV 전광판 카드
 */

import React from "react";
import {
  ChannelData,
  PressureUnit,
  formatChannelCode,
  formatPressureByUnit,
  getBankFacilityMeta,
  getGasPhysicsMeta,
  getUnitLabel,
} from "./types";

interface CardCommonProps {
  bankNum: number;
  bankId: string;
  chA: ChannelData;
  chB: ChannelData;
  unit: PressureUnit;
  isUnlocked?: boolean;
  fontScale?: "NORMAL" | "LARGE";
  onToggleValve?: (channelId: number, nextValveState: number) => void;
  onSelectChannel?: (ch: ChannelData) => void;
  onRequestPin?: () => void;
}

function getCylinderVisual(ch: ChannelData) {
  const phys = getGasPhysicsMeta(ch.gasCode, ch.pressureBar, ch.maxBar);
  const pct = phys.realMassPct;
  if (ch.status === "SENSOR_FAULT") {
    return {
      pct,
      zFactor: phys.zFactor,
      physicsLabel: phys.physicsLabel,
      top: "#c084fc",
      bottom: "#6b21a8",
      stroke: "#a855f7",
      text: "text-purple-300",
      badge: "센서점검",
    };
  }
  if (ch.valveState === 1 || ch.status === "SHUTOFF") {
    const isDepleted = ch.pressureBar <= ch.dangerBar * 1.35;
    return {
      pct,
      zFactor: phys.zFactor,
      physicsLabel: phys.physicsLabel,
      top: "#475569",
      bottom: "#1e293b",
      stroke: isDepleted ? "#ef4444" : "#64748b",
      text: isDepleted ? "text-rose-300" : "text-slate-300",
      badge: isDepleted ? "교체요망" : "예비대기",
    };
  }
  if (ch.status === "DANGER") {
    return {
      pct,
      zFactor: phys.zFactor,
      physicsLabel: phys.physicsLabel,
      top: "#fb7185",
      bottom: "#be123c",
      stroke: "#f43f5e",
      text: "text-rose-400",
      badge: "위험",
    };
  }
  if (ch.status === "WARN") {
    return {
      pct,
      zFactor: phys.zFactor,
      physicsLabel: phys.physicsLabel,
      top: "#fbbf24",
      bottom: "#b45309",
      stroke: "#f59e0b",
      text: "text-amber-300",
      badge: "주의",
    };
  }
  return {
    pct,
    zFactor: phys.zFactor,
    physicsLabel: phys.physicsLabel,
    top: "#38bdf8",
    bottom: "#0284c7",
    stroke: "#0ea5e9",
    text: "text-emerald-300",
    badge: "정상",
  };
}

/**
 * 1. [1화면 전체 한눈에 보기용] 고밀도 A/B 가스통 그래픽 카드 (상단 5열 / 하단 6열 최적화)
 */
export function OneScreenCylinderCard({
  bankNum,
  bankId,
  chA,
  chB,
  unit,
  isUnlocked = false,
  fontScale = "NORMAL",
  onToggleValve,
  onSelectChannel,
  onRequestPin,
}: CardCommonProps) {
  const unitLabel = getUnitLabel(unit);
  const meta = getBankFacilityMeta(bankNum);
  const isCabinet = meta.zone === "CABINET";

  const visA = getCylinderVisual(chA);
  const visB = getCylinderVisual(chB);
  const isAOpen = chA.valveState === 0;
  const isBOpen = chB.valveState === 0;

  const hasDanger = chA.status === "DANGER" || chB.status === "DANGER";
  const hasFault =
    chA.status === "SENSOR_FAULT" || chB.status === "SENSOR_FAULT";
  const hasWarn = chA.status === "WARN" || chB.status === "WARN";

  const angleA = -120 + (visA.pct / 100) * 240;
  const angleB = -120 + (visB.pct / 100) * 240;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border-2 p-2.5 transition-all shadow-md ${
        hasDanger
          ? "border-rose-500 bg-gradient-to-b from-rose-950/50 to-slate-950 animate-pulse"
          : hasFault
          ? "border-purple-500 bg-gradient-to-b from-purple-950/45 to-slate-950"
          : hasWarn
          ? "border-amber-500/80 bg-gradient-to-b from-amber-950/30 to-slate-950"
          : "bg-slate-900/95"
      }`}
      style={{
        borderColor:
          hasDanger || hasFault || hasWarn ? undefined : chA.color || "#0ea5e9",
        borderTopWidth: "5px",
      }}
    >
      {/* 상단: [뱅크 명칭] + [설비 호기] + [가스명] + [절체압력] */}
      <div
        className="flex items-center justify-between gap-1 border-b-2 border-dashed pb-1.5"
        style={{ borderBottomColor: `${chA.color || "#0ea5e9"}66` }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black text-white whitespace-nowrap"
            style={{ backgroundColor: chA.color || "#0284c7" }}
          >
            {meta.bankCode}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black whitespace-nowrap ${
              isCabinet
                ? "bg-sky-500/25 text-sky-200 border border-sky-400/40"
                : "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
            }`}
          >
            {isCabinet
              ? `캐비닛 ${bankNum}호`
              : bankNum === 11
              ? "수소저장소"
              : `오토 ${bankNum - 5}호`}
          </span>
          <span className="truncate text-[11px] font-black text-white whitespace-nowrap">
            {chA.gasName}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold text-amber-300 whitespace-nowrap">
          절체압력{" "}
          {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)}
          {unitLabel}
        </span>
      </div>

      {/* 중단: [좌 A실린더 현재압력/공급중] + [중앙 자동절체기 & A/B 실린더 SVG] + [우 B실린더 현재압력/공급중] */}
      <div className="mt-1.5 grid grid-cols-12 items-center gap-1">
        {/* 좌측 A실린더 [CH-홀수] 요약 */}
        <div
          className={`col-span-4 flex flex-col justify-between rounded-xl border p-1.5 transition-all ${
            isAOpen
              ? "border-sky-400/80 bg-sky-950/25 shadow-[0_0_10px_rgba(56,189,248,0.12)]"
              : "border-slate-800 bg-slate-950/90 opacity-85"
          }`}
        >
          <div className="flex items-center justify-between gap-0.5">
            <span className="rounded bg-amber-400 px-1 py-0.2 text-[9px] font-black text-slate-950 whitespace-nowrap">
              A실린더
            </span>
            <span className="font-mono text-[9px] font-bold text-sky-300 whitespace-nowrap">
              {formatChannelCode(chA.id)}
            </span>
          </div>
          <div
            onClick={() => onSelectChannel?.(chA)}
            className="my-1 cursor-pointer overflow-hidden text-right font-mono"
          >
            <div className="text-[9px] font-black text-cyan-400 whitespace-nowrap">현재압력</div>
            {chA.status === "SENSOR_FAULT" ? (
              <div className="text-xs font-black text-purple-300 whitespace-nowrap">센서점검</div>
            ) : (
              <div
                className={`${
                  fontScale === "LARGE"
                    ? "text-base sm:text-lg"
                    : "text-sm sm:text-base"
                } font-black tabular-nums leading-none tracking-tighter whitespace-nowrap ${visA.text}`}
              >
                {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
              </div>
            )}
            <div className="mt-0.5 flex items-center justify-between text-[8px] text-rose-300/90 whitespace-nowrap">
              <span>절체압력</span>
              <span>{formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)}</span>
            </div>
            <div className="flex items-center justify-between text-[8px] text-amber-300/90 whitespace-nowrap">
              <span>예고압력</span>
              <span>{formatPressureByUnit(chA.warnBar, unit, chA.maxBar)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isUnlocked) return onRequestPin?.();
              onToggleValve?.(chA.id, isAOpen ? 1 : 0);
            }}
            className={`w-full rounded py-1 text-[9.5px] font-black transition-all whitespace-nowrap ${
              isAOpen
                ? "bg-sky-500 text-slate-950 hover:bg-rose-500 hover:text-white"
                : "border border-slate-600 bg-slate-800/90 text-slate-300 hover:bg-emerald-500 hover:text-slate-950"
            }`}
          >
            {isAOpen ? "공급중" : "예비대기"}
          </button>
        </div>

        {/* 중앙 A/B 가스통 + 레귤레이터 + 피그테일 호스 일러스트 */}
        <div
          onClick={() => onSelectChannel?.(chA)}
          className="col-span-4 flex items-center justify-center cursor-pointer"
        >
          <svg
            viewBox="0 0 140 165"
            className="h-[124px] w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id={`wbA-${bankId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={visA.top} />
                <stop offset="100%" stopColor={visA.bottom} />
              </linearGradient>
              <linearGradient id={`wbB-${bankId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={visB.top} />
                <stop offset="100%" stopColor={visB.bottom} />
              </linearGradient>
              <clipPath id={`wbClipA-${bankId}`}>
                <rect x="14" y="64" width="42" height="78" rx="10" />
              </clipPath>
              <clipPath id={`wbClipB-${bankId}`}>
                <rect x="84" y="64" width="42" height="78" rx="10" />
              </clipPath>
            </defs>

            {/* 상단 자동절체기 박스 & 게이지 2개 */}
            <rect
              x="20"
              y="6"
              width="100"
              height="32"
              rx="5"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <circle cx="38" cy="22" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.2" />
            <line
              x1="38"
              y1="22"
              x2={38 + 6 * Math.sin((angleA * Math.PI) / 180)}
              y2={22 - 6 * Math.cos((angleA * Math.PI) / 180)}
              stroke={visA.top}
              strokeWidth="1.8"
            />
            <circle cx="102" cy="22" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.2" />
            <line
              x1="102"
              y1="22"
              x2={102 + 6 * Math.sin((angleB * Math.PI) / 180)}
              y2={22 - 6 * Math.cos((angleB * Math.PI) / 180)}
              stroke={visB.top}
              strokeWidth="1.8"
            />
            <circle cx="70" cy="22" r="8" fill="#0284c7" stroke="#bae6fd" strokeWidth="1.2" />

            {/* 피그테일 호스 */}
            <path
              d="M 35 52 C 18 47, 50 43, 54 38"
              fill="none"
              stroke={isAOpen ? visA.top : "#475569"}
              strokeWidth={isAOpen ? "2.5" : "1.5"}
              strokeDasharray={isAOpen ? "none" : "2,2"}
            />
            <path
              d="M 105 52 C 122 47, 90 43, 86 38"
              fill="none"
              stroke={isBOpen ? visB.top : "#475569"}
              strokeWidth={isBOpen ? "2.5" : "1.5"}
              strokeDasharray={isBOpen ? "none" : "2,2"}
            />

            {/* A 가스통 황동 밸브 & 몸통 */}
            <rect x="30" y="52" width="10" height="12" rx="1.5" fill="#eab308" />
            <rect
              x="14"
              y="64"
              width="42"
              height="78"
              rx="10"
              fill="#0f172a"
              stroke={visA.stroke}
              strokeWidth="2"
            />
            <g clipPath={`url(#wbClipA-${bankId})`}>
              <rect
                x="12"
                y={142 - (78 * visA.pct) / 100}
                width="46"
                height={(78 * visA.pct) / 100 + 4}
                fill={`url(#wbA-${bankId})`}
              />
            </g>
            <rect
              x="14"
              y="64"
              width="42"
              height="78"
              rx="10"
              fill="none"
              stroke={visA.stroke}
              strokeWidth="2"
            />
            <text
              x="35"
              y="108"
              fill="#ffffff"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {visA.pct}%
            </text>

            {/* B 가스통 황동 밸브 & 몸통 */}
            <rect x="100" y="52" width="10" height="12" rx="1.5" fill="#eab308" />
            <rect
              x="84"
              y="64"
              width="42"
              height="78"
              rx="10"
              fill="#0f172a"
              stroke={visB.stroke}
              strokeWidth="2"
            />
            <g clipPath={`url(#wbClipB-${bankId})`}>
              <rect
                x="82"
                y={142 - (78 * visB.pct) / 100}
                width="46"
                height={(78 * visB.pct) / 100 + 4}
                fill={`url(#wbB-${bankId})`}
              />
            </g>
            <rect
              x="84"
              y="64"
              width="42"
              height="78"
              rx="10"
              fill="none"
              stroke={visB.stroke}
              strokeWidth="2"
            />
            <text
              x="105"
              y="108"
              fill="#ffffff"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {visB.pct}%
            </text>

            {/* 하단 [A] 🟢 [B] 마크 */}
            <rect x="23" y="146" width="24" height="15" rx="2.5" fill="#facc15" />
            <text x="35" y="157" fill="#0f172a" fontSize="10" fontWeight="900" textAnchor="middle">
              A
            </text>
            <circle
              cx="70"
              cy="153"
              r="6.5"
              fill={hasDanger || hasFault ? "#f43f5e" : "#10b981"}
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <rect x="93" y="146" width="24" height="15" rx="2.5" fill="#facc15" />
            <text x="105" y="157" fill="#0f172a" fontSize="10" fontWeight="900" textAnchor="middle">
              B
            </text>
          </svg>
        </div>

        {/* 우측 B실린더 [CH-짝수] 요약 */}
        <div
          className={`col-span-4 flex flex-col justify-between rounded-xl border p-1.5 transition-all ${
            isBOpen
              ? "border-sky-400/80 bg-sky-950/25 shadow-[0_0_10px_rgba(56,189,248,0.12)]"
              : "border-slate-800 bg-slate-950/90 opacity-85"
          }`}
        >
          <div className="flex items-center justify-between gap-0.5">
            <span className="rounded bg-amber-400 px-1 py-0.2 text-[9px] font-black text-slate-950 whitespace-nowrap">
              B실린더
            </span>
            <span className="font-mono text-[9px] font-bold text-sky-300 whitespace-nowrap">
              {formatChannelCode(chB.id)}
            </span>
          </div>
          <div
            onClick={() => onSelectChannel?.(chB)}
            className="my-1 cursor-pointer overflow-hidden text-right font-mono"
          >
            <div className="text-[9px] font-black text-cyan-400 whitespace-nowrap">현재압력</div>
            {chB.status === "SENSOR_FAULT" ? (
              <div className="text-xs font-black text-purple-300 whitespace-nowrap">센서점검</div>
            ) : (
              <div
                className={`${
                  fontScale === "LARGE"
                    ? "text-base sm:text-lg"
                    : "text-sm sm:text-base"
                } font-black tabular-nums leading-none tracking-tighter whitespace-nowrap ${visB.text}`}
              >
                {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
              </div>
            )}
            <div className="mt-0.5 flex items-center justify-between text-[8px] text-rose-300/90 whitespace-nowrap">
              <span>절체압력</span>
              <span>{formatPressureByUnit(chB.dangerBar, unit, chB.maxBar)}</span>
            </div>
            <div className="flex items-center justify-between text-[8px] text-amber-300/90 whitespace-nowrap">
              <span>예고압력</span>
              <span>{formatPressureByUnit(chB.warnBar, unit, chB.maxBar)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isUnlocked) return onRequestPin?.();
              onToggleValve?.(chB.id, isBOpen ? 1 : 0);
            }}
            className={`w-full rounded py-1 text-[9.5px] font-black transition-all whitespace-nowrap ${
              isBOpen
                ? "bg-sky-500 text-slate-950 hover:bg-rose-500 hover:text-white"
                : "border border-slate-600 bg-slate-800/90 text-slate-300 hover:bg-emerald-500 hover:text-slate-950"
            }`}
          >
            {isBOpen ? "공급중" : "예비대기"}
          </button>
        </div>
      </div>

      {/* 하단: A/B실린더 잔여 사용시간 요약 (2열 분리로 텍스트 겹침 방지) */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 px-0.5 font-mono">
        <span className="truncate text-left whitespace-nowrap">A실린더: {chA.remainingText}</span>
        <span className="truncate text-right whitespace-nowrap">B실린더: {chB.remainingText}</span>
      </div>
    </div>
  );
}

/**
 * 2. [마스터 알람 벽걸이 모니터 스타일] 초대형 현재압력 / 절체압력 / 예고압력 + A/B 실린더 계기판 카드
 *    (모든 용어를 순수 한글 단일 단어로 통일하고 줄바꿈 없이 한 줄에 표시)
 */
export function MasterAlarmCard({
  bankNum,
  bankId,
  chA,
  chB,
  unit,
  isUnlocked = false,
  onToggleValve,
  onSelectChannel,
  onRequestPin,
}: CardCommonProps) {
  const unitLabel = getUnitLabel(unit);
  const meta = getBankFacilityMeta(bankNum);
  const visA = getCylinderVisual(chA);
  const visB = getCylinderVisual(chB);
  const isAOpen = chA.valveState === 0;
  const isBOpen = chB.valveState === 0;

  return (
    <div
      className="rounded-2xl border-2 bg-slate-900/95 p-3 shadow-xl"
      style={{
        borderColor: chA.color || "#0ea5e9",
        borderTopWidth: "6px",
      }}
    >
      {/* 상단: [뱅크 명칭] + [가스명] + [설비 호기] + [절체압력] (줄바꿈 없이 한 줄) */}
      <div
        className="flex items-center justify-between gap-1.5 border-b-2 border-dashed pb-2 text-xs font-bold overflow-hidden"
        style={{ borderBottomColor: `${chA.color || "#0ea5e9"}66` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-black text-white whitespace-nowrap"
            style={{ backgroundColor: chA.color || "#0284c7" }}
          >
            {meta.bankCode}
          </span>
          <span className="truncate text-sm font-extrabold text-white whitespace-nowrap">
            {chA.gasName}
          </span>
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-cyan-300 whitespace-nowrap">
            {meta.shortBadge}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs text-amber-300 whitespace-nowrap">
          절체압력 :{" "}
          <strong>
            {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)} {unitLabel}
          </strong>
        </span>
      </div>

      {/* 본문: 좌측 A실린더/B실린더 그래픽 & 우측 초대형 현재압력/절체압력/예고압력 디지털 패널 */}
      <div className="mt-2.5 grid grid-cols-12 gap-2.5 items-stretch">
        {/* 좌측: A실린더 [CH-홀수] / B실린더 [CH-짝수] 그래픽 박스 */}
        <div className="col-span-7 rounded-xl border border-slate-700/90 bg-slate-950 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-200 border-b border-slate-800/80 pb-1">
            <span className="text-sky-300 whitespace-nowrap">
              A실린더 <code className="text-[10px] text-amber-300">[{formatChannelCode(chA.id)}]</code>
            </span>
            <span className="font-mono text-[10px] text-emerald-300 whitespace-nowrap">
              {isAOpen ? "◀ A실린더 공급중" : "B실린더 공급중 ▶"}
            </span>
            <span className="text-teal-300 whitespace-nowrap">
              B실린더 <code className="text-[10px] text-amber-300">[{formatChannelCode(chB.id)}]</code>
            </span>
          </div>

          {/* 중앙: [좌측 A실린더 수치] — [중앙 A/B 실린더] — [우측 B실린더 수치] (3단 분리) */}
          <div className="my-2 flex items-center justify-between gap-1.5 px-0.5">
            {/* A실린더 압력 숫자 (좌측 정렬 & 활성 공급 시 네온 테두리) */}
            <div
              onClick={() => onSelectChannel?.(chA)}
              className={`flex-1 min-w-0 cursor-pointer rounded-lg border px-2 py-1.5 text-left font-mono transition-all ${
                isAOpen
                  ? "border-sky-400/80 bg-sky-950/25 shadow-[0_0_12px_rgba(56,189,248,0.12)]"
                  : "border-slate-800/90 bg-slate-900/80 opacity-85"
              }`}
            >
              <div className="text-[9px] font-bold text-slate-300 whitespace-nowrap">
                A실린더 · {formatChannelCode(chA.id)}
              </div>
              <div
                className={`text-lg sm:text-xl font-black tabular-nums leading-tight tracking-tighter whitespace-nowrap ${
                  isAOpen ? "text-white" : "text-slate-400"
                }`}
              >
                {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
              </div>
              <div className="text-[10px] font-bold text-cyan-400 whitespace-nowrap">
                {unitLabel} ({visA.pct}%)
              </div>
            </div>

            {/* 중앙 쌍둥이 미니 가스통 물높이 */}
            <div className="shrink-0 flex flex-col items-center px-1">
              <div className="h-1.5 w-10 rounded-t bg-slate-600 mb-0.5" />
              <div className="flex items-center gap-1.5">
                {[
                  { id: `maA-${bankId}`, vis: visA, open: isAOpen, label: "A" },
                  { id: `maB-${bankId}`, vis: visB, open: isBOpen, label: "B" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className={`relative h-16 w-6 overflow-hidden rounded-t-lg rounded-b border-2 bg-slate-900 ${
                      item.open
                        ? "border-sky-400 shadow-sm shadow-sky-500/30"
                        : "border-slate-600 opacity-80"
                    }`}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                      style={{
                        height: `${item.vis.pct}%`,
                        background: `linear-gradient(180deg, ${item.vis.top}, ${item.vis.bottom})`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-black text-white drop-shadow">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* B실린더 압력 숫자 (우측 정렬 & 활성 공급 시 네온 테두리) */}
            <div
              onClick={() => onSelectChannel?.(chB)}
              className={`flex-1 min-w-0 cursor-pointer rounded-lg border px-2 py-1.5 text-right font-mono transition-all ${
                isBOpen
                  ? "border-sky-400/80 bg-sky-950/25 shadow-[0_0_12px_rgba(56,189,248,0.12)]"
                  : "border-slate-800/90 bg-slate-900/80 opacity-85"
              }`}
            >
              <div className="text-[9px] font-bold text-slate-300 whitespace-nowrap">
                B실린더 · {formatChannelCode(chB.id)}
              </div>
              <div
                className={`text-lg sm:text-xl font-black tabular-nums leading-tight tracking-tighter whitespace-nowrap ${
                  isBOpen ? "text-white" : "text-slate-400"
                }`}
              >
                {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
              </div>
              <div className="text-[10px] font-bold text-cyan-400 whitespace-nowrap">
                {unitLabel} ({visB.pct}%)
              </div>
            </div>
          </div>

          {/* 하단 공급중 / 예비대기 대형 버튼 & 상태 텍스트 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!isUnlocked) return onRequestPin?.();
                  onToggleValve?.(chA.id, isAOpen ? 1 : 0);
                }}
                className={`w-full rounded-lg py-1.5 text-xs font-black transition-all whitespace-nowrap ${
                  isAOpen
                    ? "bg-sky-500 text-white shadow"
                    : "border border-slate-600 bg-slate-900 text-slate-400"
                }`}
              >
                {isAOpen ? "공급중" : "예비대기"}
              </button>
              <div className="mt-1 truncate text-center text-[10px] text-slate-400 font-mono whitespace-nowrap">
                A실린더: {chA.remainingText}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  if (!isUnlocked) return onRequestPin?.();
                  onToggleValve?.(chB.id, isBOpen ? 1 : 0);
                }}
                className={`w-full rounded-lg py-1.5 text-xs font-black transition-all whitespace-nowrap ${
                  isBOpen
                    ? "bg-sky-500 text-white shadow"
                    : "border border-slate-600 bg-slate-900 text-slate-400"
                }`}
              >
                {isBOpen ? "공급중" : "예비대기"}
              </button>
              <div className="mt-1 truncate text-center text-[10px] text-slate-400 font-mono whitespace-nowrap">
                B실린더: {chB.remainingText}
              </div>
            </div>
          </div>
        </div>

        {/* 우측: 초대형 현재압력 / 가로 잔량 바 / 절체압력 / 예고압력 계기판 (5칸) */}
        <div className="col-span-5 rounded-xl border border-slate-700/90 bg-slate-950 p-2.5 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-1">
            <div className="shrink-0">
              <div className="text-sm font-black text-cyan-300 whitespace-nowrap">현재압력</div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                공급중 ({isAOpen ? "A실린더" : "B실린더"})
              </div>
            </div>
            <div className="font-mono tabular-nums text-2xl sm:text-3xl font-black tracking-tight text-white whitespace-nowrap">
              {formatPressureByUnit(
                isAOpen ? chA.pressureBar : chB.pressureBar,
                unit,
                chA.maxBar
              )}
              <span className="ml-1 text-[11px] text-slate-400">{unitLabel}</span>
            </div>
          </div>

          {/* 가로형 파란색/청록색 잔량 게이지 바 */}
          <div className="my-1.5">
            <div className="relative h-5 w-full overflow-hidden rounded-lg bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${isAOpen ? visA.pct : visB.pct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-amber-300 drop-shadow whitespace-nowrap">
                실잔량 {isAOpen ? visA.pct : visB.pct}%
              </span>
            </div>
          </div>

          {/* 하단: 절체압력 & 예고압력 2줄 분리 표기 (줄바꿈 없음) */}
          <div className="border-t border-slate-800 pt-1.5 space-y-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xs font-black text-rose-300 whitespace-nowrap">절체압력</span>
              <span className="font-mono tabular-nums text-lg sm:text-xl font-black text-rose-300 whitespace-nowrap">
                {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)}
                <span className="ml-1 text-[10px] text-slate-400">{unitLabel}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xs font-black text-amber-300 whitespace-nowrap">예고압력</span>
              <span className="font-mono tabular-nums text-base sm:text-lg font-black text-amber-300 whitespace-nowrap">
                {formatPressureByUnit(chA.warnBar, unit, chA.maxBar)}
                <span className="ml-1 text-[10px] text-slate-400">{unitLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

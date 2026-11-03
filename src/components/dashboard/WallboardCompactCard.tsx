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
  formatPressureByUnit,
  getBankFacilityMeta,
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
  const pct = Math.max(
    0,
    Math.min(100, Math.round((ch.pressureBar / (ch.maxBar || 150)) * 100))
  );
  if (ch.status === "SENSOR_FAULT") {
    return {
      pct,
      top: "#c084fc",
      bottom: "#6b21a8",
      stroke: "#a855f7",
      text: "text-purple-300",
      badge: "FAULT",
    };
  }
  if (ch.valveState === 1 || ch.status === "SHUTOFF") {
    return {
      pct,
      top: "#475569",
      bottom: "#1e293b",
      stroke: "#64748b",
      text: "text-slate-400",
      badge: "CLOSE",
    };
  }
  if (ch.status === "DANGER") {
    return {
      pct,
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
      top: "#fbbf24",
      bottom: "#b45309",
      stroke: "#f59e0b",
      text: "text-amber-300",
      badge: "주의",
    };
  }
  return {
    pct,
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
          : isCabinet
          ? "border-sky-500/40 bg-slate-900/95 hover:border-sky-400"
          : "border-emerald-500/40 bg-slate-900/95 hover:border-emerald-400"
      }`}
    >
      {/* 상단: 설비 번호 + 가스명 + SV 기준값 */}
      <div className="flex items-center justify-between gap-1 border-b border-slate-800/90 pb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${
              isCabinet
                ? "bg-sky-500/25 text-sky-200 border border-sky-400/40"
                : "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
            }`}
          >
            {isCabinet ? `캐비넷#${bankNum}` : bankNum === 11 ? "H2저장소" : `오토#${bankNum - 5}`}
          </span>
          <span
            className="truncate rounded px-1.5 py-0.5 text-[11px] font-black text-white"
            style={{ backgroundColor: chA.color || "#0284c7" }}
          >
            {chA.gasName}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold text-amber-300">
          {isAOpen ? "◀A공급" : "B공급▶"} · SV{" "}
          {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)}
          {unitLabel}
        </span>
      </div>

      {/* 중단: [좌 A통 PV/OPEN] + [중앙 자동절체기 & A/B 가스통 SVG] + [우 B통 PV/OPEN] */}
      <div className="mt-1.5 grid grid-cols-12 items-center gap-1">
        {/* 좌측 A통 요약 */}
        <div className="col-span-4 flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-1.5">
          <div className="flex items-center justify-between">
            <span className="rounded bg-amber-400 px-1 py-0.2 font-mono text-[9px] font-black text-slate-950">
              A통
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              CH{String(chA.id).padStart(2, "0")}
            </span>
          </div>
          <div
            onClick={() => onSelectChannel?.(chA)}
            className="my-1 cursor-pointer text-right font-mono"
          >
            <div className="text-[8px] font-bold text-cyan-400">PV 현재</div>
            {chA.status === "SENSOR_FAULT" ? (
              <div className="text-xs font-black text-purple-300">FAULT</div>
            ) : (
              <div
                className={`${
                  fontScale === "LARGE" ? "text-xl" : "text-base sm:text-lg"
                } font-black leading-none tracking-tight ${visA.text}`}
              >
                {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isUnlocked) return onRequestPin?.();
              onToggleValve?.(chA.id, isAOpen ? 1 : 0);
            }}
            className={`w-full rounded py-1 font-mono text-[10px] font-black transition-all ${
              isAOpen
                ? "bg-sky-500 text-slate-950 hover:bg-rose-500 hover:text-white"
                : "border border-rose-500/60 bg-rose-950/60 text-rose-300 hover:bg-emerald-500 hover:text-slate-950"
            }`}
          >
            {isAOpen ? "OPEN" : "CLOSE"}
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

        {/* 우측 B통 요약 */}
        <div className="col-span-4 flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-1.5">
          <div className="flex items-center justify-between">
            <span className="rounded bg-amber-400 px-1 py-0.2 font-mono text-[9px] font-black text-slate-950">
              B통
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              CH{String(chB.id).padStart(2, "0")}
            </span>
          </div>
          <div
            onClick={() => onSelectChannel?.(chB)}
            className="my-1 cursor-pointer text-right font-mono"
          >
            <div className="text-[8px] font-bold text-cyan-400">PV 현재</div>
            {chB.status === "SENSOR_FAULT" ? (
              <div className="text-xs font-black text-purple-300">FAULT</div>
            ) : (
              <div
                className={`${
                  fontScale === "LARGE" ? "text-xl" : "text-base sm:text-lg"
                } font-black leading-none tracking-tight ${visB.text}`}
              >
                {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isUnlocked) return onRequestPin?.();
              onToggleValve?.(chB.id, isBOpen ? 1 : 0);
            }}
            className={`w-full rounded py-1 font-mono text-[10px] font-black transition-all ${
              isBOpen
                ? "bg-sky-500 text-slate-950 hover:bg-rose-500 hover:text-white"
                : "border border-rose-500/60 bg-rose-950/60 text-rose-300 hover:bg-emerald-500 hover:text-slate-950"
            }`}
          >
            {isBOpen ? "OPEN" : "CLOSE"}
          </button>
        </div>
      </div>

      {/* 하단: A/B 잔여 사용시간 요약 */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-0.5">
        <span className="truncate">A: {chA.remainingText}</span>
        <span className="font-mono text-slate-500">{unitLabel}</span>
        <span className="truncate">B: {chB.remainingText}</span>
      </div>
    </div>
  );
}

/**
 * 2. [경쟁사 2번 마스터 알람 벽걸이 모니터 스타일] 초대형 PV / SV + A/B 실린더 계기판 카드
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
    <div className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 p-3 shadow-xl">
      {/* 상단: 가스명 & 설정압력(SV) */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2 text-xs font-bold">
        <div className="flex items-center gap-2">
          <span className="text-slate-300">
            가스명 : <strong className="text-white text-sm">{chA.gasName}</strong>
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300">
            {meta.facilityBadge}
          </span>
        </div>
        <span className="font-mono text-amber-300">
          설정압력(SV) : {formatPressureByUnit(chA.warnBar, unit, chA.maxBar)} {unitLabel}
        </span>
      </div>

      {/* 본문: 좌측 A/B 실린더 그래픽 & 우측 초대형 PV/SV 디지털 패널 */}
      <div className="mt-2.5 grid grid-cols-12 gap-2.5 items-stretch">
        {/* 좌측: 경쟁사 2번 사진 좌측과 동일한 A-Cylinder / B-Cylinder 그래픽 박스 */}
        <div className="col-span-6 rounded-xl border border-slate-700/90 bg-slate-950 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-black text-slate-200">
            <span>A-Cylinder</span>
            <span>B-Cylinder</span>
          </div>

          <div className="my-2 grid grid-cols-12 items-center gap-1">
            {/* A 압력 숫자 */}
            <div
              onClick={() => onSelectChannel?.(chA)}
              className="col-span-4 cursor-pointer text-center font-mono"
            >
              <div className="text-2xl sm:text-3xl font-black text-white">
                {formatPressureByUnit(chA.pressureBar, unit, chA.maxBar)}
              </div>
              <div className="text-[10px] text-slate-400">{unitLabel}</div>
            </div>

            {/* 중앙 쌍둥이 미니 가스통 물높이 */}
            <div className="col-span-4 flex items-center justify-center gap-2">
              {[
                { id: `maA-${bankId}`, vis: visA },
                { id: `maB-${bankId}`, vis: visB },
              ].map((item) => (
                <div
                  key={item.id}
                  className="relative h-20 w-7 overflow-hidden rounded-t-xl rounded-b-md border-2 border-slate-400 bg-slate-900"
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                    style={{
                      height: `${item.vis.pct}%`,
                      background: `linear-gradient(180deg, ${item.vis.top}, ${item.vis.bottom})`,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* B 압력 숫자 */}
            <div
              onClick={() => onSelectChannel?.(chB)}
              className="col-span-4 cursor-pointer text-center font-mono"
            >
              <div className="text-2xl sm:text-3xl font-black text-white">
                {formatPressureByUnit(chB.pressureBar, unit, chB.maxBar)}
              </div>
              <div className="text-[10px] text-slate-400">{unitLabel}</div>
            </div>
          </div>

          {/* 하단 OPEN / CLOSE 대형 버튼 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin?.();
                onToggleValve?.(chA.id, isAOpen ? 1 : 0);
              }}
              className={`rounded-lg py-1.5 font-mono text-xs font-black ${
                isAOpen
                  ? "bg-sky-500 text-white"
                  : "border border-rose-500/60 bg-slate-900 text-rose-400"
              }`}
            >
              {isAOpen ? "OPEN" : "CLOSE"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin?.();
                onToggleValve?.(chB.id, isBOpen ? 1 : 0);
              }}
              className={`rounded-lg py-1.5 font-mono text-xs font-black ${
                isBOpen
                  ? "bg-sky-500 text-white"
                  : "border border-rose-500/60 bg-slate-900 text-rose-400"
              }`}
            >
              {isBOpen ? "OPEN" : "CLOSE"}
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>A: {chA.remainingText}</span>
            <span>B: {chB.remainingText}</span>
          </div>
        </div>

        {/* 우측: 경쟁사 2번 사진 우측과 동일한 초대형 PV / 가로 잔량 바 / SV 계기판 */}
        <div className="col-span-6 rounded-xl border border-slate-700/90 bg-slate-950 p-3 flex flex-col justify-between">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-base font-black text-white">PV</div>
              <div className="text-[9px] text-slate-400">Position Volume (주공급)</div>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-black text-white">
              {formatPressureByUnit(
                isAOpen ? chA.pressureBar : chB.pressureBar,
                unit,
                chA.maxBar
              )}
              <span className="ml-1 text-xs text-slate-400">{unitLabel}</span>
            </div>
          </div>

          {/* 가로형 파란색/청록색 잔량 게이지 바 */}
          <div className="my-2">
            <div className="relative h-6 w-full overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${isAOpen ? visA.pct : visB.pct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-amber-300 drop-shadow">
                {isAOpen ? visA.pct : visB.pct}%
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-800 pt-1.5">
            <div>
              <div className="text-base font-black text-slate-300">SV</div>
              <div className="text-[9px] text-slate-500">Setting Volume (경보압력)</div>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-black text-amber-300">
              {formatPressureByUnit(chA.dangerBar, unit, chA.maxBar)}
              <span className="ml-1 text-xs text-slate-400">{unitLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

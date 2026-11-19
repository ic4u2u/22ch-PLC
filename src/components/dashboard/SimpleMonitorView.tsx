"use client";

/**
 * 파일명: src/components/dashboard/SimpleMonitorView.tsx
 * 역할: [✨ 간편모니터링 화면보기] — 와이지원(YG-1) 인천 제2공장 전용 2단 3D 입체 & 가스 고유 컬러 전광판 뷰
 *  - 상단: YG-1 공식 심볼 로고 + 와이지원 | 가스 모니터링 시스템 | 인천 제2공장 + 대형 날짜·시간
 *  - 중앙 2단: 1단(가스캐비닛 5뱅크) + 2단(오토체인지 6뱅크) — 3D 입체 가스통 + 그라데이션 + 고시인성 텍스트
 *  - 하단: 가로 폭에 맞춘 대형 4대 핵심 설비 지표(PLC 통신, 가동 현황, 안전 인터록, 설비 특이사항)
 */

import React, { useEffect, useState } from "react";
import {
  ChannelData,
  DiagnosticsData,
  PressureUnit,
  formatPressureByUnit,
  getGasPhysicsMeta,
  getUnitLabel,
} from "./types";
import { BankPairItem } from "./GasFilterBar";

interface SimpleMonitorViewProps {
  allPairs: BankPairItem[];
  channels: ChannelData[];
  diagnostics: DiagnosticsData;
  unit: PressureUnit;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExitSimpleView: () => void;
  onSelectChannel?: (ch: ChannelData) => void;
}

/**
 * 와이지원(YG-1) 공식 심볼 로고 (기울어진 3단 빗금 + G 엠블럼)
 */
function YgOneLogo() {
  return (
    <div className="flex items-center justify-center rounded-xl bg-white/95 px-2.5 py-1 shadow-[0_2px_14px_rgba(230,30,42,0.4)] ring-1 ring-red-500/30 shrink-0">
      <svg
        viewBox="0 0 118 42"
        className="h-7 sm:h-8 xl:h-9 w-auto"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="YG-1 로고"
      >
        {/* 좌측 상단 작은 평행사변형 */}
        <polygon points="10,7 22,7 18,14 6,14" fill="#E61E2A" />
        {/* 좌측 중간 기울어진 빗금 */}
        <polygon points="27,7 39,7 28,25 16,25" fill="#E61E2A" />
        {/* 중앙 긴 기울어진 빗금 */}
        <polygon points="44,7 56,7 38,36 26,36" fill="#E61E2A" />
        {/* 우측 기울어진 굵은 G */}
        <path
          d="M96,15 C94,10 88,7 80,7 C67,7 57,15 54,23 C51,31 58,36 70,36 C81,36 89,31 93,23 L95,19 L74,19 L72,25 L82,25 C80,29 76,30 72,30 C65,30 63,27 65,22 C67,17 72,13 79,13 C83,13 85,15 86,17 Z"
          fill="#E61E2A"
        />
      </svg>
    </div>
  );
}

function getCylinderFillStyle(ch: ChannelData, gasColor: string) {
  const phys = getGasPhysicsMeta(ch.gasCode, ch.pressureBar, ch.maxBar);
  const pct = phys.realMassPct;
  const isOpen = ch.valveState === 0;

  if (ch.status === "SENSOR_FAULT") {
    return {
      pct,
      top: "#e879f9",
      mid: "#a855f7",
      bottom: "#581c87",
      stroke: "#c084fc",
      label: "점검",
    };
  }
  if (!isOpen) {
    const isEmpty = ch.pressureBar <= (ch.dangerBar || 15);
    return {
      pct,
      top: isEmpty ? "#fb7185" : "#94a3b8",
      mid: isEmpty ? "#e11d48" : "#475569",
      bottom: isEmpty ? "#881337" : "#1e293b",
      stroke: isEmpty ? "#f43f5e" : "#64748b",
      label: isEmpty ? "교체필요" : "대기중",
    };
  }
  if (ch.status === "DANGER") {
    return {
      pct,
      top: "#fda4af",
      mid: "#f43f5e",
      bottom: "#9f1239",
      stroke: "#fb7185",
      label: "공급중",
    };
  }
  if (ch.status === "WARN") {
    return {
      pct,
      top: "#fde68a",
      mid: "#f59e0b",
      bottom: "#92400e",
      stroke: "#fbbf24",
      label: "공급중",
    };
  }
  return {
    pct,
    top: gasColor,
    mid: `${gasColor}dd`,
    bottom: `${gasColor}66`,
    stroke: gasColor,
    label: "공급중",
  };
}

/**
 * 3D 입체 원통형 고압가스 실린더 SVG (기본뷰 47L 고압용기 실루엣 + 3D 원통 음영·반사광·황동 밸브)
 */
function Cylinder3DSvg({ ch, gasColor }: { ch: ChannelData; gasColor: string }) {
  const style = getCylinderFillStyle(ch, gasColor);
  const isOpen = ch.valveState === 0;
  const clipId = `sm3d-clip-${ch.id}`;
  const fillGradId = `sm3d-fill-${ch.id}`;
  const shellGradId = `sm3d-shell-${ch.id}`;
  const glossGradId = `sm3d-gloss-${ch.id}`;
  const brassGradId = `sm3d-brass-${ch.id}`;

  const bodyTop = 24;
  const bodyBottom = 120;
  const bodyHeight = bodyBottom - bodyTop;
  const fillY = bodyBottom - (bodyHeight * style.pct) / 100;
  const tankPath =
    "M 8 42 Q 8 24 23 24 L 37 24 Q 52 24 52 42 L 52 114 Q 52 120 46 120 L 14 120 Q 8 120 8 114 Z";

  return (
    <svg
      viewBox="0 0 60 128"
      className="w-[clamp(44px,3.1vw,76px)] h-auto aspect-[60/128] drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 3D 원통 외피 음영 그라데이션 */}
        <linearGradient id={shellGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="28%" stopColor="#1e293b" />
          <stop offset="68%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        {/* 3D 가스 액위 수직 입체 그라데이션 */}
        <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={style.top} />
          <stop offset="55%" stopColor={style.mid} />
          <stop offset="100%" stopColor={style.bottom} />
        </linearGradient>
        {/* 좌측 세로 원통 광택 하이라이트 */}
        <linearGradient id={glossGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="38%" stopColor="rgba(255,255,255,0.34)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {/* 황동 밸브 3D 금속 그라데이션 */}
        <linearGradient id={brassGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        {/* 기본뷰 고압가스 실린더 클립 경로 */}
        <clipPath id={clipId}>
          <path d={tankPath} />
        </clipPath>
      </defs>

      {/* 바닥 3D 타원형 그림자 */}
      <ellipse cx="30" cy="123" rx="22" ry="3.8" fill="rgba(0,0,0,0.68)" />

      {/* 진짜 고압가스 실린더 밸브 어셈블리 (밸브 핸들 휠 + 황동 바디 + 스템) */}
      <ellipse
        cx="30"
        cy="6"
        rx="8.5"
        ry="2.6"
        fill={isOpen ? "#38bdf8" : "#64748b"}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
      />
      <rect x="24" y="8" width="12" height="7" rx="1.5" fill={`url(#${brassGradId})`} />
      <rect x="26" y="15" width="8" height="9" fill="#94a3b8" />

      {/* 3D 고압 실린더 본체 배경 */}
      <path d={tankPath} fill={`url(#${shellGradId})`} />

      {/* 실시간 가스 잔량 3D 채움 */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="6"
          y={fillY}
          width="48"
          height={bodyBottom - fillY + 4}
          fill={`url(#${fillGradId})`}
        />
        {/* 액면 상단 하이라이트 라인 */}
        {style.pct > 4 && style.pct < 99 && (
          <line
            x1="8"
            y1={fillY}
            x2="52"
            y2={fillY}
            stroke="#ffffff"
            strokeOpacity="0.65"
            strokeWidth="1.6"
          />
        )}
        {/* 원통 좌측 세로 입체 반사광 */}
        <rect x="12" y="24" width="11" height="96" fill={`url(#${glossGradId})`} />
        {/* 원통 우측 입체 음영 */}
        <rect x="44" y="24" width="8" height="96" fill="rgba(0,0,0,0.34)" />
      </g>

      {/* 고압 실린더 3D 외곽 테두리 */}
      <path d={tankPath} fill="none" stroke={style.stroke} strokeWidth="2.2" />

      {/* 고시인성 잔량 % 캡슐 뱃지 */}
      <rect
        x="13"
        y="65"
        width="34"
        height="18"
        rx="6"
        fill="rgba(2,6,23,0.75)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.9"
      />
      <text
        x="30"
        y="78"
        fill="#ffffff"
        fontSize="12"
        fontWeight="900"
        textAnchor="middle"
      >
        {style.pct}%
      </text>
    </svg>
  );
}

export default function SimpleMonitorView({
  allPairs,
  channels,
  diagnostics,
  unit,
  isFullscreen,
  onToggleFullscreen,
  onExitSimpleView,
  onSelectChannel,
}: SimpleMonitorViewProps) {
  const [dateTimeText, setDateTimeText] = useState("");
  const unitLabel = getUnitLabel(unit);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const day = days[now.getDay()];
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setDateTimeText(`${yyyy}-${mm}-${dd} (${day}) ${hh}:${mi}:${ss}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const cabinetPairs = allPairs.filter((p) => p.bankNum <= 5);
  const autoPairs = allPairs.filter((p) => p.bankNum >= 6);

  const supplyCount = channels.filter((c) => c.valveState === 0).length;
  const standbyCount = channels.filter((c) => c.valveState === 1).length;
  const attentionChannels = channels.filter(
    (c) =>
      c.status === "DANGER" ||
      c.status === "SENSOR_FAULT" ||
      (c.valveState === 1 && c.pressureBar <= (c.dangerBar || 15))
  );

  const renderGasCard = (pair: BankPairItem) => {
    const { chA, chB } = pair;
    const gasColor = chA.color || "#0ea5e9";
    const activeCh = chA.valveState === 0 ? chA : chB.valveState === 0 ? chB : chA;
    const isAOpen = chA.valveState === 0;
    const isBOpen = chB.valveState === 0;

    const aStyle = getCylinderFillStyle(chA, gasColor);
    const bStyle = getCylinderFillStyle(chB, gasColor);

    const hasDanger = chA.status === "DANGER" || chB.status === "DANGER";
    const hasFault = chA.status === "SENSOR_FAULT" || chB.status === "SENSOR_FAULT";
    const hasWarn = chA.status === "WARN" || chB.status === "WARN";

    const gasShortCode = (chA.gasCode || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();
    const gasKoreanName = (chA.gasName || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/^[A-Za-z0-9\-]+\s*/g, "")
      .trim() || chA.gasName;

    const statusBadge = hasDanger
      ? {
          label: "🚨 위험",
          cls: "border-rose-400/90 bg-gradient-to-b from-rose-500/40 to-rose-900/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] animate-pulse",
        }
      : hasFault
      ? {
          label: "⚡ 점검",
          cls: "border-purple-400/90 bg-gradient-to-b from-purple-500/40 to-purple-900/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
        }
      : hasWarn
      ? {
          label: "⚠️ 주의",
          cls: "border-amber-400/90 bg-gradient-to-b from-amber-500/35 to-amber-900/70 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
        }
      : {
          label: "✅ 정상",
          cls: "border-emerald-400/70 bg-gradient-to-b from-emerald-500/30 to-emerald-950/80 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        };

    return (
      <div
        key={pair.bankId}
        onClick={() => onSelectChannel?.(activeCh)}
        className={`h-full cursor-pointer flex flex-col justify-between rounded-2xl border-2 p-3 text-center transition-all hover:scale-[1.01] hover:brightness-110 ${
          hasDanger
            ? "border-rose-500 bg-gradient-to-b from-rose-950/70 via-slate-900 to-slate-950 ring-1 ring-rose-500/70"
            : hasFault
            ? "border-purple-500 bg-gradient-to-b from-purple-950/60 via-slate-900 to-slate-950"
            : "bg-gradient-to-b from-[#0e203d] via-[#091529] to-[#040a16]"
        }`}
        style={{
          borderColor: hasDanger || hasFault ? undefined : `${gasColor}dd`,
          borderTopWidth: "6px",
          boxShadow:
            hasDanger || hasFault
              ? "0 10px 25px rgba(0,0,0,0.6)"
              : `inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 24px ${gasColor}28, 0 10px 20px rgba(0,0,0,0.55)`,
        }}
      >
        {/* 상단: 영문코드(좌측) + 한글 가스명(가로 중앙) / 공급압력 텍스트(좌측) + 수치(가로 중앙) */}
        <div
          className="space-y-1.5 border-b border-dashed pb-2"
          style={{ borderBottomColor: `${gasColor}66` }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 min-w-0">
            <span
              className="justify-self-start whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[clamp(0.625rem,0.65vw,0.85rem)] font-black text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.4)]"
              style={{ backgroundColor: gasColor }}
            >
              {gasShortCode || chA.gasCode}
            </span>
            <span className="justify-self-center text-center text-[clamp(0.875rem,0.95vw,1.35rem)] font-black text-white tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
              {gasKoreanName}
            </span>
            <span aria-hidden="true" />
          </div>

          <div className="pt-0.5 grid grid-cols-[1fr_auto_1fr] items-baseline gap-1 min-w-0">
            <span className="justify-self-start text-[clamp(0.68rem,0.68vw,0.88rem)] font-extrabold text-slate-200 whitespace-nowrap">
              공급압력
            </span>
            <span
              className="justify-self-center font-mono text-[clamp(1.15rem,1.45vw,2.1rem)] font-black tabular-nums leading-none whitespace-nowrap drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
              style={{ color: hasDanger ? "#fda4af" : "#ffffff" }}
            >
              {activeCh.status === "SENSOR_FAULT"
                ? "점검"
                : formatPressureByUnit(activeCh.pressureBar, unit, activeCh.maxBar)}
              <span
                className="ml-0.5 text-[clamp(0.7rem,0.75vw,1rem)] font-black"
                style={{ color: hasDanger ? "#fb7185" : gasColor }}
              >
                {activeCh.status === "SENSOR_FAULT" ? "" : unitLabel}
              </span>
            </span>
            <span aria-hidden="true" />
          </div>
        </div>

        {/* 중앙: 3D 입체 실린더 2기 그래픽 */}
        <div className="my-2 flex items-center justify-center gap-3">
          <Cylinder3DSvg ch={chA} gasColor={gasColor} />
          <Cylinder3DSvg ch={chB} gasColor={gasColor} />
        </div>

        {/* 하단: 3D 그라데이션 공급중 / 대기중 알약 + 종합 상태 */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <span
              className={`rounded-lg py-1.5 text-xs font-black transition-all ${
                isAOpen
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_rgba(16,185,129,0.5)]"
                  : aStyle.label === "교체필요"
                  ? "border border-rose-400/70 bg-gradient-to-b from-rose-700 to-rose-950 text-white"
                  : "border border-slate-600/80 bg-gradient-to-b from-slate-800 to-slate-950 text-slate-200"
              }`}
            >
              {aStyle.label}
            </span>
            <span
              className={`rounded-lg py-1.5 text-xs font-black transition-all ${
                isBOpen
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_rgba(16,185,129,0.5)]"
                  : bStyle.label === "교체필요"
                  ? "border border-rose-400/70 bg-gradient-to-b from-rose-700 to-rose-950 text-white"
                  : "border border-slate-600/80 bg-gradient-to-b from-slate-800 to-slate-950 text-slate-200"
              }`}
            >
              {bStyle.label}
            </span>
          </div>
          <div className={`rounded-lg border py-1 text-xs sm:text-sm font-black ${statusBadge.cls}`}>
            {statusBadge.label}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col justify-between gap-3 rounded-2xl border border-cyan-500/45 bg-gradient-to-b from-[#05152e] via-[#071c3d] to-[#020814] p-3.5 sm:p-4 shadow-[0_0_50px_rgba(6,182,212,0.16)] ${
        isFullscreen ? "flex-1 min-h-0" : "min-h-[84vh]"
      }`}
    >
      {/* 1. 상단 전용 헤더: YG-1 공식 로고 + 와이지원 | 가스 모니터링 시스템 | 인천 제2공장 + 대형 날짜·시간 */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-slate-950/95 via-[#071836]/95 to-slate-950/95 px-4 sm:px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_20px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <YgOneLogo />
          <span className="text-xl sm:text-2xl xl:text-[26px] font-black tracking-tight text-white drop-shadow">
            와이지원
          </span>
          <span className="hidden sm:inline-block h-6 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600" />
          <span className="text-lg sm:text-xl xl:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-white bg-clip-text text-transparent">
            가스 모니터링 시스템
          </span>
          <span className="hidden md:inline-block h-5 w-px bg-slate-700" />
          <span className="rounded-xl border border-cyan-400/45 bg-gradient-to-b from-cyan-500/25 to-blue-900/40 px-3.5 py-1 text-sm sm:text-base xl:text-lg font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            인천 제2공장
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-slate-950/90 px-3.5 py-1.5 font-mono text-sm sm:text-base xl:text-lg font-black text-white shadow-inner">
            <span className="text-cyan-300">📅</span>
            <span className="tabular-nums">{dateTimeText || "----"}</span>
          </div>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="rounded-xl border border-cyan-400/60 bg-gradient-to-b from-cyan-500 to-blue-600 px-3 py-2 text-xs sm:text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_rgba(6,182,212,0.35)] hover:brightness-110 transition-all"
          >
            {isFullscreen ? "✕ 종료" : "⛶ 전체화면"}
          </button>
          <button
            type="button"
            onClick={onExitSimpleView}
            className="rounded-xl border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2 text-xs sm:text-sm font-extrabold text-slate-100 hover:bg-slate-700 transition-all"
          >
            ↩ 기본뷰
          </button>
        </div>
      </header>

      {/* 2. 중앙 2단 3D 가스 모니터링 그리드 (1단: 가스캐비닛 5종 / 2단: 오토체인지 6종) */}
      <div className={`flex flex-col gap-3 ${isFullscreen ? "flex-1 min-h-0" : ""}`}>
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${
            isFullscreen ? "flex-1 min-h-0" : ""
          }`}
        >
          {cabinetPairs.map(renderGasCard)}
        </div>

        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 ${
            isFullscreen ? "flex-1 min-h-0" : ""
          }`}
        >
          {autoPairs.map(renderGasCard)}
        </div>
      </div>

      {/* 3. 하단 4가지 핵심 설비 요약 (말줄임 '...' 제로 + 정수 ms 표기 + 고시인성 폰트) */}
      <footer className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-2xl sm:text-3xl shrink-0">📡</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-300">PLC 통신 상태</div>
            <div
              className={`text-sm sm:text-base xl:text-lg font-black leading-snug break-keep ${
                diagnostics.plcConnected ? "text-emerald-300" : "text-rose-400"
              }`}
            >
              {diagnostics.plcConnected
                ? `정상 연결 (${diagnostics.protocol} · ${Math.round(Number(diagnostics.latencyMs || 0))}ms)`
                : "통신 재연결 대기중"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-2xl sm:text-3xl shrink-0">🟢</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-300">전체 가동 현황</div>
            <div className="text-sm sm:text-base xl:text-lg font-black text-white leading-snug break-keep">
              {allPairs.length}종 가스 (공급 {supplyCount} · 대기 {standbyCount})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-2xl sm:text-3xl shrink-0">🛡️</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-300">무중단 자동절체 인터록</div>
            <div className="text-sm sm:text-base xl:text-lg font-black text-cyan-300 leading-snug break-keep">
              {diagnostics.plcConnected ? "정상 감시중 (350ms)" : "조작 안전 잠금중"}
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            if (attentionChannels[0]) onSelectChannel?.(attentionChannels[0]);
          }}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
            attentionChannels.length > 0
              ? "cursor-pointer border-rose-500/80 bg-gradient-to-b from-rose-950/70 to-slate-950 hover:brightness-110"
              : "border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950"
          }`}
        >
          <span className="text-2xl sm:text-3xl shrink-0">
            {attentionChannels.length > 0 ? "🚨" : "✅"}
          </span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-300">설비 특이사항</div>
            <div
              className={`text-sm sm:text-base xl:text-lg font-black leading-snug break-keep ${
                attentionChannels.length > 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {attentionChannels.length > 0
                ? `교체·점검 ${attentionChannels.length}건 (클릭 확인)`
                : "전 뱅크 이상 없음"}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

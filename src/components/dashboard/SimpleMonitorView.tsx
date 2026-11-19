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
import ThreeCylinderCanvas from "./ThreeCylinderCanvas";

interface SimpleMonitorViewProps {
  allPairs: BankPairItem[];
  channels: ChannelData[];
  diagnostics: DiagnosticsData;
  unit: PressureUnit;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExitSimpleView: () => void;
  onOpen3DView?: () => void;
  onSelectChannel?: (ch: ChannelData) => void;
}

/**
 * 와이지원(YG-1) 공식 심볼 로고 (기울어진 3단 빗금 + G 엠블럼)
 */
function YgOneLogo() {
  return (
    <div className="flex items-center justify-center rounded-xl bg-white/95 px-[clamp(0.6rem,0.7vw,1.4rem)] py-[clamp(0.25rem,0.3vw,0.6rem)] shadow-[0_2px_14px_rgba(230,30,42,0.4)] ring-1 ring-red-500/30 shrink-0">
      <svg
        viewBox="0 0 118 42"
        className="h-[clamp(26px,2vw,54px)] w-auto"
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

export default function SimpleMonitorView({
  allPairs,
  channels,
  diagnostics,
  unit,
  isFullscreen,
  onToggleFullscreen,
  onExitSimpleView,
  onOpen3DView,
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

    const isAAlert =
      chA.status === "DANGER" ||
      chA.status === "WARN" ||
      chA.status === "SENSOR_FAULT" ||
      aStyle.label === "교체필요";
    const isBAlert =
      chB.status === "DANGER" ||
      chB.status === "WARN" ||
      chB.status === "SENSOR_FAULT" ||
      bStyle.label === "교체필요";

    const hasDanger = chA.status === "DANGER" || chB.status === "DANGER";
    const hasFault = chA.status === "SENSOR_FAULT" || chB.status === "SENSOR_FAULT";
    const hasReplace = aStyle.label === "교체필요" || bStyle.label === "교체필요";
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

    const replaceSideLabel =
      isAAlert && isBAlert ? "좌·우(A/B)" : isAAlert ? "좌측 A" : isBAlert ? "우측 B" : "";

    const statusBadge = hasDanger
      ? {
          label: `🚨 위험 (${replaceSideLabel})`,
          cls: "border-rose-400/90 bg-gradient-to-b from-rose-500/40 to-rose-900/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] animate-pulse",
        }
      : hasFault
      ? {
          label: `⚡ 점검 (${replaceSideLabel})`,
          cls: "border-purple-400/90 bg-gradient-to-b from-purple-500/40 to-purple-900/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
        }
      : hasReplace
      ? {
          label: `⚠️ ${replaceSideLabel} 교체필요`,
          cls: "border-rose-400/85 bg-gradient-to-b from-rose-600/45 to-rose-950/85 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] animate-pulse",
        }
      : hasWarn
      ? {
          label: `⚠️ 주의 (${replaceSideLabel})`,
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
          className="space-y-2 border-b border-dashed pb-2.5"
          style={{ borderBottomColor: `${gasColor}66` }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 min-w-0">
            <span
              className="justify-self-start whitespace-nowrap rounded-md px-[clamp(0.45rem,0.55vw,1rem)] py-[clamp(0.15rem,0.2vw,0.4rem)] font-mono text-[clamp(0.65rem,0.8vw,1.45rem)] font-black text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.4)]"
              style={{ backgroundColor: gasColor }}
            >
              {gasShortCode || chA.gasCode}
            </span>
            <span className="justify-self-center text-center text-[clamp(0.95rem,1.2vw,2.25rem)] font-black text-white tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
              {gasKoreanName}
            </span>
            <span aria-hidden="true" />
          </div>

          <div className="pt-0.5 grid grid-cols-[1fr_auto_1fr] items-baseline gap-1.5 min-w-0">
            <span className="justify-self-start text-[clamp(0.7rem,0.85vw,1.5rem)] font-extrabold text-slate-200 whitespace-nowrap">
              공급압력
            </span>
            <span
              className="justify-self-center font-mono text-[clamp(1.2rem,1.8vw,3.4rem)] font-black tabular-nums leading-none whitespace-nowrap drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
              style={{ color: hasDanger ? "#fda4af" : "#ffffff" }}
            >
              {activeCh.status === "SENSOR_FAULT"
                ? "점검"
                : formatPressureByUnit(activeCh.pressureBar, unit, activeCh.maxBar)}
              <span
                className="ml-1 text-[clamp(0.75rem,0.95vw,1.7rem)] font-black"
                style={{ color: hasDanger ? "#fb7185" : gasColor }}
              >
                {activeCh.status === "SENSOR_FAULT" ? "" : unitLabel}
              </span>
            </span>
            <span aria-hidden="true" />
          </div>
        </div>

        {/* 중앙: 3D 입체 실린더 2기 + 알람 발생 시 해당 통 옆에 '좌측 A' / '우측 B' 표시 (해제 시 자동 소멸) */}
        <div className="my-2 flex flex-1 items-center justify-center gap-[clamp(0.4rem,0.9vw,1.6rem)]">
          {isAAlert && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-rose-400/80 bg-gradient-to-b from-rose-600/80 to-rose-950/90 px-[clamp(0.35rem,0.45vw,0.8rem)] py-[clamp(0.35rem,0.45vw,0.75rem)] text-white shadow-[0_0_14px_rgba(244,63,94,0.6)] animate-pulse shrink-0">
              <span className="text-[clamp(0.65rem,0.75vw,1.25rem)] font-black leading-tight whitespace-nowrap">
                좌측
              </span>
              <span className="font-mono text-[clamp(0.85rem,1.05vw,1.8rem)] font-black text-amber-300 leading-none mt-0.5">
                A
              </span>
            </div>
          )}
          <ThreeCylinderCanvas ch={chA} gasColor={gasColor} />
          <ThreeCylinderCanvas ch={chB} gasColor={gasColor} />
          {isBAlert && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-rose-400/80 bg-gradient-to-b from-rose-600/80 to-rose-950/90 px-[clamp(0.35rem,0.45vw,0.8rem)] py-[clamp(0.35rem,0.45vw,0.75rem)] text-white shadow-[0_0_14px_rgba(244,63,94,0.6)] animate-pulse shrink-0">
              <span className="text-[clamp(0.65rem,0.75vw,1.25rem)] font-black leading-tight whitespace-nowrap">
                우측
              </span>
              <span className="font-mono text-[clamp(0.85rem,1.05vw,1.8rem)] font-black text-amber-300 leading-none mt-0.5">
                B
              </span>
            </div>
          )}
        </div>

        {/* 하단: 3D 그라데이션 공급중 / 대기중 알약 + 종합 상태 */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <span
              className={`rounded-xl py-[clamp(0.35rem,0.5vw,0.85rem)] text-[clamp(0.75rem,0.95vw,1.65rem)] font-black transition-all ${
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
              className={`rounded-xl py-[clamp(0.35rem,0.5vw,0.85rem)] text-[clamp(0.75rem,0.95vw,1.65rem)] font-black transition-all ${
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
          <div
            className={`rounded-xl border py-[clamp(0.3rem,0.45vw,0.8rem)] text-[clamp(0.75rem,0.95vw,1.65rem)] font-black ${statusBadge.cls}`}
          >
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
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-slate-950/95 via-[#071836]/95 to-slate-950/95 px-4 sm:px-6 py-[clamp(0.6rem,0.7vw,1.25rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_20px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <YgOneLogo />
          <span className="text-[clamp(1.2rem,1.4vw,2.6rem)] font-black tracking-tight text-white drop-shadow">
            와이지원
          </span>
          <span className="hidden sm:inline-block h-[clamp(1.2rem,1.4vw,2.4rem)] w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600" />
          <span className="text-[clamp(1.05rem,1.25vw,2.3rem)] font-black tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-white bg-clip-text text-transparent">
            가스 모니터링 시스템
          </span>
          <span className="hidden md:inline-block h-5 w-px bg-slate-700" />
          <span className="rounded-xl border border-cyan-400/45 bg-gradient-to-b from-cyan-500/25 to-blue-900/40 px-[clamp(0.75rem,0.9vw,1.6rem)] py-[clamp(0.25rem,0.3vw,0.55rem)] text-[clamp(0.875rem,1vw,1.8rem)] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            인천 제2공장
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-slate-950/90 px-3.5 py-1.5 font-mono text-[clamp(0.85rem,1vw,1.8rem)] font-black text-white shadow-inner">
            <span className="text-cyan-300">📅</span>
            <span className="tabular-nums">{dateTimeText || "----"}</span>
          </div>
          {onOpen3DView && (
            <button
              type="button"
              onClick={onOpen3DView}
              className="rounded-xl border border-purple-400/60 bg-gradient-to-b from-purple-500/30 to-indigo-900/60 px-3 py-2 text-[clamp(0.75rem,0.85vw,1.4rem)] font-black text-purple-100 hover:brightness-125 transition-all"
            >
              🧊 3D 뷰
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="rounded-xl border border-cyan-400/60 bg-gradient-to-b from-cyan-500 to-blue-600 px-3 py-2 text-[clamp(0.75rem,0.85vw,1.4rem)] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_rgba(6,182,212,0.35)] hover:brightness-110 transition-all"
          >
            {isFullscreen ? "✕ 종료" : "⛶ 전체화면"}
          </button>
          <button
            type="button"
            onClick={onExitSimpleView}
            className="rounded-xl border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2 text-[clamp(0.75rem,0.85vw,1.4rem)] font-extrabold text-slate-100 hover:bg-slate-700 transition-all"
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

      {/* 3. 하단 4가지 핵심 설비 요약 (4K에서도 시원하게 커지는 유체 폰트) */}
      <footer className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3.5 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 sm:px-5 py-[clamp(0.6rem,0.7vw,1.25rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-[clamp(1.5rem,1.8vw,3rem)] shrink-0">📡</span>
          <div className="min-w-0">
            <div className="text-[clamp(0.75rem,0.8vw,1.35rem)] font-bold text-slate-300">
              PLC 통신 상태
            </div>
            <div
              className={`text-[clamp(0.9rem,1.05vw,1.9rem)] font-black leading-snug break-keep ${
                diagnostics.plcConnected ? "text-emerald-300" : "text-rose-400"
              }`}
            >
              {diagnostics.plcConnected
                ? `정상 연결 (${diagnostics.protocol} · ${Math.round(Number(diagnostics.latencyMs || 0))}ms)`
                : "통신 재연결 대기중"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 sm:px-5 py-[clamp(0.6rem,0.7vw,1.25rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-[clamp(1.5rem,1.8vw,3rem)] shrink-0">🟢</span>
          <div className="min-w-0">
            <div className="text-[clamp(0.75rem,0.8vw,1.35rem)] font-bold text-slate-300">
              전체 가동 현황
            </div>
            <div className="text-[clamp(0.9rem,1.05vw,1.9rem)] font-black text-white leading-snug break-keep">
              {allPairs.length}종 가스 (공급 {supplyCount} · 대기 {standbyCount})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950 px-4 sm:px-5 py-[clamp(0.6rem,0.7vw,1.25rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-[clamp(1.5rem,1.8vw,3rem)] shrink-0">🛡️</span>
          <div className="min-w-0">
            <div className="text-[clamp(0.75rem,0.8vw,1.35rem)] font-bold text-slate-300">
              무중단 자동절체 인터록
            </div>
            <div className="text-[clamp(0.9rem,1.05vw,1.9rem)] font-black text-cyan-300 leading-snug break-keep">
              {diagnostics.plcConnected ? "정상 감시중 (350ms)" : "조작 안전 잠금중"}
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            if (attentionChannels[0]) onSelectChannel?.(attentionChannels[0]);
          }}
          className={`flex items-center gap-3.5 rounded-2xl border px-4 sm:px-5 py-[clamp(0.6rem,0.7vw,1.25rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
            attentionChannels.length > 0
              ? "cursor-pointer border-rose-500/80 bg-gradient-to-b from-rose-950/70 to-slate-950 hover:brightness-110"
              : "border-cyan-400/35 bg-gradient-to-b from-slate-900/95 to-slate-950"
          }`}
        >
          <span className="text-[clamp(1.5rem,1.8vw,3rem)] shrink-0">
            {attentionChannels.length > 0 ? "🚨" : "✅"}
          </span>
          <div className="min-w-0">
            <div className="text-[clamp(0.75rem,0.8vw,1.35rem)] font-bold text-slate-300">
              설비 특이사항
            </div>
            <div
              className={`text-[clamp(0.9rem,1.05vw,1.9rem)] font-black leading-snug break-keep ${
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

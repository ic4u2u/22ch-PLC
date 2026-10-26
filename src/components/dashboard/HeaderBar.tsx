"use client";

/**
 * 파일명: src/components/dashboard/HeaderBar.tsx
 * 역할: 상단 헤더 제어 바
 *  - FND 4단위 원클릭 변환기 (0:PSI, 1:Bar, 2:MPa, 3:%)
 *  - 유지보수자 4자리 PIN 잠금 (1234, 해제 시 5분=300초 카운트다운 후 자동 잠금)
 *  - 한국어 TTS 음성안내 토글 (Web Speech API + Web Audio API 비프음)
 *  - [📡 통신진단 & 하드웨어 가이드] 버튼
 *  - [📱 모바일 접속 주소] & [💾 설정 백업/FA 복원] 버튼
 */

import React from "react";
import { DiagnosticsData, PressureUnit } from "./types";

interface HeaderBarProps {
  unit: PressureUnit;
  onChangeUnit: (u: PressureUnit) => void;
  isUnlocked: boolean;
  unlockRemainSec: number;
  onClickPinToggle: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  diagnostics: DiagnosticsData;
  onOpenHardwareModal: () => void;
  onOpenMobileModal: () => void;
  onOpenFaModal: () => void;
  dangerCount: number;
  faultCount: number;
}

const UNIT_OPTIONS: { code: PressureUnit; label: string; desc: string }[] = [
  { code: 0, label: "0: PSI", desc: "×14.5" },
  { code: 1, label: "1: Bar", desc: "기본" },
  { code: 2, label: "2: MPa", desc: "×0.1" },
  { code: 3, label: "3: %", desc: "잔량%" },
];

export default function HeaderBar({
  unit,
  onChangeUnit,
  isUnlocked,
  unlockRemainSec,
  onClickPinToggle,
  ttsEnabled,
  onToggleTts,
  diagnostics,
  onOpenHardwareModal,
  onOpenMobileModal,
  onOpenFaModal,
  dangerCount,
  faultCount,
}: HeaderBarProps) {
  const formatRemain = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3">
        {/* 좌측: 시스템 로고 및 PLC 실시간 연결 배지 */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-white shadow-lg shadow-cyan-500/20">
            ACSC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                ACSC 22채널 특수가스 스마트 관제 시스템
              </h1>
              <span className="hidden md:inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-cyan-300 border border-slate-700">
                QOOTEC Dual-LAN · LS XBL-EMTA (22CH / 11BANK)
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    diagnostics.plcConnected
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
                {diagnostics.plcConnected
                  ? `PLC 온라인 (${diagnostics.protocol} ${diagnostics.plcIp}:${diagnostics.plcPort} · ${diagnostics.latencyMs}ms)`
                  : `PLC 재연결 대기 중 (${diagnostics.plcIp}:${diagnostics.plcPort})`}
              </span>
              {dangerCount > 0 && (
                <span className="rounded bg-rose-500/20 border border-rose-500/50 px-2 py-0.5 text-rose-300 font-bold animate-pulse">
                  🚨 위험 {dangerCount}채널
                </span>
              )}
              {faultCount > 0 && (
                <span className="rounded bg-purple-500/20 border border-purple-500/50 px-2 py-0.5 text-purple-300 font-bold">
                  ⚡ 센서고장(SENSOR_FAULT) {faultCount}채널
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 컨트롤 버튼 그룹 (모바일 터치 최소 44px 높이 준수) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. FND 4단위 원클릭 변환기 (10번 스펙) */}
          <div
            className="flex items-center rounded-xl border border-slate-700 bg-slate-900 p-1"
            title="10번 스펙: FND 4단위 원클릭 변환기"
          >
            {UNIT_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => onChangeUnit(opt.code)}
                className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  unit === opt.code
                    ? "bg-cyan-500 text-slate-950 shadow"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] opacity-80">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* 2. 유지보수자 4자리 PIN 잠금 버튼 */}
          <button
            type="button"
            onClick={onClickPinToggle}
            className={`min-h-[44px] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition-all ${
              isUnlocked
                ? "border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>{isUnlocked ? "🔓 관리자 해제됨" : "🔒 관리자 PIN 잠금"}</span>
            {isUnlocked && (
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-amber-300">
                {formatRemain(unlockRemainSec)}
              </span>
            )}
          </button>

          {/* 3. 한국어 TTS 음성안내 토글 */}
          <button
            type="button"
            onClick={onToggleTts}
            className={`min-h-[44px] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition-all ${
              ttsEnabled
                ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <span>{ttsEnabled ? "🔊 한국어 TTS 켜짐" : "🔇 한국어 TTS 꺼짐"}</span>
          </button>

          {/* 4. [📡 통신진단 & 하드웨어 가이드] 버튼 */}
          <button
            type="button"
            onClick={onOpenHardwareModal}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition-all"
          >
            <span>📡 통신진단 & 하드웨어 가이드</span>
          </button>

          {/* 5. [📱 모바일 접속 주소] */}
          <button
            type="button"
            onClick={onOpenMobileModal}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-all"
          >
            <span>📱 모바일 접속 주소</span>
          </button>

          {/* 6. [💾 설정 백업/FA 복원] */}
          <button
            type="button"
            onClick={onOpenFaModal}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-3.5 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-500/25 transition-all"
          >
            <span>💾 설정 백업/FA 복원</span>
          </button>
        </div>
      </div>
    </header>
  );
}

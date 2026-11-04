"use client";

/**
 * 파일명: src/components/dashboard/WallboardView.tsx
 * 역할: [탭 4 & ?view=wallboard 전용 뷰] 📺 대형 벽걸이 TV 스마트 멀티뷰 전광판
 *  - 첫 화면 기본값(ONE_SCREEN): 1920x1080 모니터 한 화면에 상단 [가스캐비넷 5칸(5열)] + 하단 [오토체인지 6칸(6열)]
 *    총 11뱅크(22개 가스통) 전체가 스크롤 없이 한눈에 들어오도록 최적 배치!
 *  - 5대 모니터 뷰 모드 지원 + ⚙️ 전광판 맞춤 설정(뷰모드/롤링주기/글자배율/테마/단위/전체화면) 및 localStorage 자동 저장
 */

import React, { useState, useEffect } from "react";
import {
  APP_UPDATE_STAMP,
  ChannelData,
  DiagnosticsData,
  PressureUnit,
  formatPressureByUnit,
  getBankFacilityMeta,
  getUnitLabel,
  playAlarmBeep,
  speakKoreanAlarm,
} from "./types";
import CylinderPairCard from "./CylinderSvgGraphic";
import {
  MasterAlarmCard,
  OneScreenCylinderCard,
} from "./WallboardCompactCard";

export type WallboardMode =
  | "ONE_SCREEN"
  | "MASTER_ALARM"
  | "LARGE_CYLINDER"
  | "AUTO_ROLLING"
  | "SPOTLIGHT_SPLIT";

type ThemeStyle = "NEON_DARK" | "OLED_BLACK" | "INDUSTRIAL_STEEL";

interface WallboardViewProps {
  channels: ChannelData[];
  unit: PressureUnit;
  onChangeUnit?: (u: PressureUnit) => void;
  diagnostics: DiagnosticsData;
  isStandaloneWallboard: boolean;
  isUnlocked?: boolean;
  onToggleValve?: (channelId: number, nextValveState: number) => void;
  onSelectChannel?: (ch: ChannelData) => void;
  onRequestPin?: () => void;
  onExitWallboard?: () => void;
}

export default function WallboardView({
  channels,
  unit,
  onChangeUnit,
  diagnostics,
  isStandaloneWallboard,
  isUnlocked = false,
  onToggleValve,
  onSelectChannel,
  onRequestPin,
  onExitWallboard,
}: WallboardViewProps) {
  const [viewMode, setViewMode] = useState<WallboardMode>("ONE_SCREEN");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rollingSec, setRollingSec] = useState<number>(8);
  const [rollingPaused, setRollingPaused] = useState<boolean>(false);
  const [rollingPage, setRollingPage] = useState<"CABINET" | "AUTO_CHANGE">(
    "CABINET"
  );
  const [fontScale, setFontScale] = useState<"NORMAL" | "LARGE">("NORMAL");
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>("NEON_DARK");
  const [clockText, setClockText] = useState<string>("");

  const unitLabel = getUnitLabel(unit);

  // 저장된 모니터 뷰 설정 불러오기
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("acsc_wb_mode") as WallboardMode;
      if (savedMode) setViewMode(savedMode);
      const savedTheme = localStorage.getItem("acsc_wb_theme") as ThemeStyle;
      if (savedTheme) setThemeStyle(savedTheme);
      const savedScale = localStorage.getItem("acsc_wb_scale") as
        | "NORMAL"
        | "LARGE";
      if (savedScale) setFontScale(savedScale);
    } catch {}
  }, []);

  const updateMode = (m: WallboardMode) => {
    setViewMode(m);
    try {
      localStorage.setItem("acsc_wb_mode", m);
    } catch {}
  };

  // 실시간 디지털 시계
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(
        now.toLocaleTimeString("ko-KR", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  // AUTO_ROLLING 모드일 때 구역 자동 전환 타이머
  useEffect(() => {
    if (viewMode !== "AUTO_ROLLING" || rollingPaused) return;
    const timer = setInterval(() => {
      setRollingPage((prev) =>
        prev === "CABINET" ? "AUTO_CHANGE" : "CABINET"
      );
    }, rollingSec * 1000);
    return () => clearInterval(timer);
  }, [viewMode, rollingSec, rollingPaused]);

  const cabinetChannels = channels.filter((c) => c.id <= 10);
  const autoChangeChannels = channels.filter((c) => c.id >= 11);

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
        pairs.push({
          bankNum: Math.ceil(chA.id / 2),
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
  const allPairs = [...cabinetPairs, ...autoChangePairs];

  const spotlightChannels = channels.filter(
    (c) =>
      c.status === "DANGER" ||
      c.status === "SENSOR_FAULT" ||
      c.status === "WARN"
  );

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const themeBg =
    themeStyle === "OLED_BLACK"
      ? "bg-black border-slate-900"
      : themeStyle === "INDUSTRIAL_STEEL"
      ? "bg-slate-900 border-slate-700"
      : "bg-slate-950 border-slate-800";

  return (
    <div
      className={`min-h-[88vh] rounded-3xl border p-3 sm:p-4 shadow-2xl space-y-3 ${themeBg}`}
    >
      {/* =====================================================================
          상단 슬림 컨트롤 & 뷰 모드 선택 바 (한 화면에 22통이 다 들어가도록 슬림 설계)
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 px-3.5 py-2.5">
        {/* 좌측: 모니터 타이틀 + 경보 요약 배지 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-black text-slate-950">
            📺 TV 전광판
          </span>
          <h2 className="text-sm sm:text-base font-black text-white">
            특수가스 스마트 관제 전광판 (총 11뱅크 · 22실린더 | 가스캐비닛 5뱅크 · 오토체인지 6뱅크)
          </h2>
          <span className="rounded-md bg-amber-400/20 border border-amber-400/50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-300">
            🕒 {APP_UPDATE_STAMP}
          </span>
          {spotlightChannels.length > 0 ? (
            <span className="rounded-lg bg-rose-500/25 border border-rose-500/50 px-2.5 py-0.5 text-xs font-extrabold text-rose-300 animate-pulse">
              🚨 경보/점검 {spotlightChannels.length}건
            </span>
          ) : (
            <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
              ✅ 11뱅크 · 22실린더 전체 정상
            </span>
          )}
        </div>

        {/* 중앙: 5대 모니터 뷰 모드 원클릭 전환 탭 */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
          {[
            { id: "ONE_SCREEN", label: "🖥️ 1화면 전체(11뱅크·22실린더)" },
            { id: "MASTER_ALARM", label: "🎛️ 마스터 알람뷰" },
            { id: "LARGE_CYLINDER", label: "🛢️ 대형 실린더뷰" },
            { id: "AUTO_ROLLING", label: "🔄 구역 자동롤링" },
            { id: "SPOTLIGHT_SPLIT", label: "🚨 경보 집중뷰" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => updateMode(m.id as WallboardMode)}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all ${
                viewMode === m.id
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 우측: 음성브리핑 + 전체화면 + ⚙️ 모니터 설정 + 대시보드 복귀 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden xl:inline-block font-mono text-xs font-black text-cyan-300 mr-1">
            🕒 {clockText}
          </span>
          <button
            type="button"
            onClick={() => {
              playAlarmBeep("DANGER");
              speakKoreanAlarm(
                `상황실 전광판 음성 브리핑입니다. 현재 가스캐비넷 열 통, 오토체인지 열두 통 중 경보 및 점검 대상은 총 ${spotlightChannels.length}건 입니다.`
              );
            }}
            className="rounded-xl border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500 hover:text-slate-950"
          >
            🎙️ AI 브리핑
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="브라우저 주소창 숨기고 TV 전체화면 전환"
            className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-cyan-500 hover:text-slate-950"
          >
            ⛶ 전체화면
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-all ${
              settingsOpen
                ? "border-amber-400 bg-amber-400 text-slate-950"
                : "border-cyan-500/50 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-500 hover:text-slate-950"
            }`}
          >
            ⚙️ 뷰 설정
          </button>
          {isStandaloneWallboard && onExitWallboard && (
            <button
              type="button"
              onClick={onExitWallboard}
              className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              🎛️ 제어판
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          ⚙️ 전광판 모니터 맞춤 설정 드로어 (클릭 시 열림)
         ===================================================================== */}
      {settingsOpen && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-cyan-500/50 bg-slate-900/95 p-4 md:grid-cols-4 shadow-2xl">
          {/* 1. 모니터 뷰 모드 설명 및 선택 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-black text-cyan-300 mb-2">
              1️⃣ 모니터 레이아웃 모드
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <p>• <strong>1화면 전체(22실린더)</strong>: 상단 5뱅크 + 하단 6뱅크를 스크롤 없이 1화면에 표시</p>
              <p>• <strong>마스터 알람뷰</strong>: 벽걸이 마스터 알람기 스타일 (초대형 PV/SV)</p>
              <p>• <strong>구역 자동롤링</strong>: 가스캐비닛 5뱅크 ↔ 오토체인지 6뱅크 자동 순환</p>
            </div>
          </div>

          {/* 2. 자동 순환(롤링) 주기 및 숫자 크기 설정 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-black text-cyan-300 mb-2">
              2️⃣ 자동 롤링 주기 & 숫자 배율
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-slate-400">롤링 간격:</span>
              {[5, 8, 15].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setRollingSec(sec)}
                  className={`rounded px-2 py-1 text-xs font-bold ${
                    rollingSec === sec
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {sec}초
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">압력 숫자:</span>
              {[
                { id: "NORMAL", label: "표준" },
                { id: "LARGE", label: "초대형 강조" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const next = s.id as "NORMAL" | "LARGE";
                    setFontScale(next);
                    try {
                      localStorage.setItem("acsc_wb_scale", next);
                    } catch {}
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-bold ${
                    fontScale === s.id
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 전광판 배경 대비 테마 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-black text-cyan-300 mb-2">
              3️⃣ 모니터 배경 대비 테마
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: "NEON_DARK", label: "🌌 다크 네온 (기본 표준)" },
                { id: "OLED_BLACK", label: "⬛ OLED 순수 블랙 (빛반사 최소화)" },
                { id: "INDUSTRIAL_STEEL", label: "🔩 인더스트리얼 스틸 그레이" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const next = t.id as ThemeStyle;
                    setThemeStyle(next);
                    try {
                      localStorage.setItem("acsc_wb_theme", next);
                    } catch {}
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-bold ${
                    themeStyle === t.id
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 압력 표시 단위 즉시 변환 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-black text-cyan-300 mb-2">
              4️⃣ 전광판 압력 표시 단위
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { u: 1 as PressureUnit, label: "Bar (기본)" },
                { u: 0 as PressureUnit, label: "PSI (×14.5)" },
                { u: 2 as PressureUnit, label: "MPa (×0.1)" },
                { u: 3 as PressureUnit, label: "% (잔량율)" },
              ].map((item) => (
                <button
                  key={item.u}
                  type="button"
                  onClick={() => onChangeUnit?.(item.u)}
                  className={`rounded-lg py-1.5 font-mono text-xs font-black ${
                    unit === item.u
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          [모드 1 : ONE_SCREEN (첫 화면 기본값)]
          1920x1080 모니터 한 화면에 상단 5칸(가스캐비넷) + 하단 6칸(오토체인지) = 22통 전체 한눈에 배치!
         ===================================================================== */}
      {viewMode === "ONE_SCREEN" && (
        <div className="space-y-3">
          {/* 상단 1열: 🗄️ 제1구역: 가스캐비닛 5뱅크 (BANK-01~05 · 10실린더) — 5열 가로 한 줄 배치 */}
          <section className="rounded-2xl border border-sky-500/40 bg-sky-950/10 p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-500 px-2.5 py-0.5 text-xs font-black text-slate-950">
                  🗄️ 제1구역: 가스캐비닛 5뱅크 (GC-01~05 · 10실린더)
                </span>
                <span className="text-xs font-bold text-sky-200">
                  BANK-01 ~ BANK-05 (P-CH4 · G-CH4 · P-H2 · MIX · C2H2 — A/B실린더 구성)
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-sky-400">
                CH-01 ~ CH-10 (5뱅크 한 줄 배치)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {cabinetPairs.map((pair) => (
                <OneScreenCylinderCard
                  key={pair.bankId}
                  bankNum={pair.bankNum}
                  bankId={pair.bankId}
                  chA={pair.chA}
                  chB={pair.chB}
                  unit={unit}
                  fontScale={fontScale}
                  isUnlocked={isUnlocked}
                  onToggleValve={onToggleValve}
                  onSelectChannel={onSelectChannel}
                  onRequestPin={onRequestPin}
                />
              ))}
            </div>
          </section>

          {/* 하단 2열: 🔄 제2·3구역: 오토체인지 6뱅크 (BANK-06~11 · 12실린더) — 6열 가로 한 줄 배치 */}
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-950/10 p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-500 px-2.5 py-0.5 text-xs font-black text-slate-950">
                  🔄 제2·3구역: 오토체인지 6뱅크 (ACM-01~06 · 12실린더)
                </span>
                <span className="text-xs font-bold text-emerald-200">
                  BANK-06 ~ BANK-11 (P-N2 · G-N2 · He · Ar · O2 · G-H2[H2저장소] — A/B실린더 구성)
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">
                CH-11 ~ CH-22 (6뱅크 한 줄 배치)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {autoChangePairs.map((pair) => (
                <OneScreenCylinderCard
                  key={pair.bankId}
                  bankNum={pair.bankNum}
                  bankId={pair.bankId}
                  chA={pair.chA}
                  chB={pair.chB}
                  unit={unit}
                  fontScale={fontScale}
                  isUnlocked={isUnlocked}
                  onToggleValve={onToggleValve}
                  onSelectChannel={onSelectChannel}
                  onRequestPin={onRequestPin}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          [모드 2 : MASTER_ALARM] 경쟁사 2번 벽걸이 유틸리티 가스 마스터 알람 스타일
         ===================================================================== */}
      {viewMode === "MASTER_ALARM" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allPairs.map((pair) => (
            <MasterAlarmCard
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
      )}

      {/* =====================================================================
          [모드 3 : LARGE_CYLINDER] 대형 자동절체기 + 피그테일 호스 + A/B 가스통 상세 뷰
         ===================================================================== */}
      {viewMode === "LARGE_CYLINDER" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {allPairs.map((pair) => (
            <CylinderPairCard
              key={pair.bankId}
              bankNum={pair.bankNum}
              bankId={pair.bankId}
              chA={pair.chA}
              chB={pair.chB}
              unit={unit}
              isUnlocked={isUnlocked}
              onToggleValve={(chId, next) => onToggleValve?.(chId, next)}
              onSelectChannel={(ch) => onSelectChannel?.(ch)}
              onRequestPin={() => onRequestPin?.()}
            />
          ))}
        </div>
      )}

      {/* =====================================================================
          [모드 4 : AUTO_ROLLING] 구역 자동 순환(롤링) 슬라이드쇼 뷰 (캐비넷 5CH ↔ 오토체인지 6CH)
         ===================================================================== */}
      {viewMode === "AUTO_ROLLING" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-950/25 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-cyan-400 px-2.5 py-1 text-xs font-black text-slate-950">
                🔄 자동 순환 모드 ({rollingSec}초 주기)
              </span>
              <span className="text-sm font-extrabold text-white">
                현재 표시 중:{" "}
                {rollingPage === "CABINET"
                  ? "1페이지 — 🗄️ 제1구역: 가스캐비닛 5뱅크 (BANK-01~05 · 10실린더)"
                  : "2페이지 — 🔄 제2·3구역: 오토체인지 6뱅크 (BANK-06~11 · 12실린더)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRollingPage("CABINET")}
                className={`rounded-lg px-3 py-1 text-xs font-black ${
                  rollingPage === "CABINET"
                    ? "bg-sky-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                제1구역: 가스캐비닛 (5뱅크)
              </button>
              <button
                type="button"
                onClick={() => setRollingPage("AUTO_CHANGE")}
                className={`rounded-lg px-3 py-1 text-xs font-black ${
                  rollingPage === "AUTO_CHANGE"
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                제2·3구역: 오토체인지 (6뱅크)
              </button>
              <button
                type="button"
                onClick={() => setRollingPaused((p) => !p)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-amber-300"
              >
                {rollingPaused ? "▶️ 순환 재생" : "⏸️ 순환 일시정지"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {(rollingPage === "CABINET" ? cabinetPairs : autoChangePairs).map(
              (pair) => (
                <CylinderPairCard
                  key={pair.bankId}
                  bankNum={pair.bankNum}
                  bankId={pair.bankId}
                  chA={pair.chA}
                  chB={pair.chB}
                  unit={unit}
                  isUnlocked={isUnlocked}
                  onToggleValve={(chId, next) => onToggleValve?.(chId, next)}
                  onSelectChannel={(ch) => onSelectChannel?.(ch)}
                  onRequestPin={() => onRequestPin?.()}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          [모드 5 : SPOTLIGHT_SPLIT] 상단 위험/경보 초대형 스포트라이트 + 하단 1화면 전체 뷰
         ===================================================================== */}
      {viewMode === "SPOTLIGHT_SPLIT" && (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/50 via-slate-900 to-purple-950/50 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-sm font-black text-rose-300">
                🚨 위험 저압 / 4~20mA 센서 고장 집중 스포트라이트 ({spotlightChannels.length}건)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {spotlightChannels.map((ch) => {
                const bankNum = Math.ceil(ch.id / 2);
                const meta = getBankFacilityMeta(bankNum);
                return (
                  <div
                    key={ch.id}
                    onClick={() => onSelectChannel?.(ch)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-rose-400/60 bg-slate-950/90 p-3"
                  >
                    <div>
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-black text-rose-300">
                        {ch.bankId} · {meta.shortBadge} · {ch.side}실린더
                      </span>
                      <div className="mt-1 text-base font-black text-white">
                        {ch.gasName} [{ch.side}실린더 · CH-{String(ch.id).padStart(2, "0")}]
                      </div>
                      <div className="text-xs text-slate-400">
                        {ch.faultReason || ch.remainingText}
                      </div>
                    </div>
                    <div className="font-mono text-3xl font-black text-rose-400">
                      {ch.status === "SENSOR_FAULT"
                        ? "FAULT"
                        : `${formatPressureByUnit(
                            ch.pressureBar,
                            unit,
                            ch.maxBar
                          )} ${unitLabel}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {allPairs.map((pair) => (
              <OneScreenCylinderCard
                key={pair.bankId}
                bankNum={pair.bankNum}
                bankId={pair.bankId}
                chA={pair.chA}
                chB={pair.chB}
                unit={unit}
                fontScale={fontScale}
                isUnlocked={isUnlocked}
                onToggleValve={onToggleValve}
                onSelectChannel={onSelectChannel}
                onRequestPin={onRequestPin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

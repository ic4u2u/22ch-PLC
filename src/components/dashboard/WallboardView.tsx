"use client";

/**
 * 파일명: src/components/dashboard/WallboardView.tsx
 * 역할: [탭 4 & ?view=wallboard 전용 뷰] 📺 대형 벽걸이 TV 전광판 뷰 (2번 모니터 DP 출력용)
 *  - 위험(DANGER) 및 센서고장(SENSOR_FAULT) 채널 상단 초대형 스포트라이트 표시
 *  - 1) 가스캐비넷 5CH (10실린더: CH01~CH10) + 2) 오토체인지 6CH (12실린더: CH11~CH22) 모두
 *    친숙한 A/B 가스통 물높이 잔량 그래픽 + 자동절체기 헤드 + 피그테일 호스 + PV/SV + OPEN/CLOSE 적용
 */

import React from "react";
import {
  ChannelData,
  DiagnosticsData,
  PressureUnit,
  formatPressureByUnit,
  getBankFacilityMeta,
  getUnitLabel,
} from "./types";
import CylinderPairCard from "./CylinderSvgGraphic";

interface WallboardViewProps {
  channels: ChannelData[];
  unit: PressureUnit;
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
  diagnostics,
  isStandaloneWallboard,
  isUnlocked = false,
  onToggleValve,
  onSelectChannel,
  onRequestPin,
  onExitWallboard,
}: WallboardViewProps) {
  const unitLabel = getUnitLabel(unit);

  const cabinetChannels = channels.filter((c) => c.id <= 10);
  const autoChangeChannels = channels.filter((c) => c.id >= 11);

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

  // 위험(DANGER), 센서고장(SENSOR_FAULT), 주의(WARN) 우선순위 스포트라이트 채널 추출
  const spotlightChannels = channels.filter(
    (c) =>
      c.status === "DANGER" ||
      c.status === "SENSOR_FAULT" ||
      c.status === "WARN"
  );

  return (
    <div className="min-h-[85vh] rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl space-y-5">
      {/* 전광판 상단 타이틀 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-cyan-500 px-3 py-1.5 text-sm font-black text-slate-950 shadow">
            MONITOR 2 · WALLBOARD TV
          </span>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
            ACSC 22채널 특수가스 마스터 알람 전광판 (가스캐비넷 5CH · 오토체인지 6CH)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-bold">
            <span
              className={`h-3 w-3 rounded-full ${
                diagnostics.plcConnected
                  ? "bg-emerald-400 animate-ping"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-slate-200">
              PLC {diagnostics.protocol} · {diagnostics.latencyMs}ms
            </span>
          </div>
          {isStandaloneWallboard && onExitWallboard && (
            <button
              type="button"
              onClick={onExitWallboard}
              className="rounded-xl border border-cyan-500/50 bg-cyan-950/50 px-3.5 py-2 text-xs font-extrabold text-cyan-200 hover:bg-cyan-500 hover:text-slate-950 transition-all"
            >
              🎛️ 전체 조작 대시보드 열기
            </button>
          )}
        </div>
      </div>

      {/* 상단 중앙 스포트라이트 영역 */}
      {spotlightChannels.length > 0 ? (
        <div className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/50 via-slate-900 to-purple-950/50 p-4 shadow-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm sm:text-base font-black text-rose-300">
              <span className="animate-bounce">🚨</span>
              <span>
                집중 감시 스포트라이트 (위험 저압 / 4~20mA 센서 고장 채널 즉시 조치 요망)
              </span>
            </div>
            <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-extrabold text-rose-200">
              총 {spotlightChannels.length}개 채널 경보 중
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {spotlightChannels.slice(0, 6).map((ch) => {
              const isFault = ch.status === "SENSOR_FAULT";
              const isDanger = ch.status === "DANGER";
              const bankNum = Math.ceil(ch.id / 2);
              const meta = getBankFacilityMeta(bankNum);
              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectChannel?.(ch)}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-3.5 transition-all ${
                    isFault
                      ? "border-purple-400 bg-purple-950/60"
                      : isDanger
                      ? "border-rose-500 bg-rose-950/60 animate-pulse"
                      : "border-amber-400 bg-amber-950/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-black/50 px-2 py-0.5 text-xs font-black text-sky-300">
                        {meta.facilityBadge}
                      </span>
                      <span className="font-mono text-sm font-black text-white">
                        {ch.side}통 · CH-{String(ch.id).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="mt-1 text-base font-extrabold text-white">
                      {ch.gasName}
                    </div>
                    <div className="mt-1 text-xs font-bold text-rose-200">
                      {isFault
                        ? `⚡ ${ch.faultReason || "4~20mA 센서 점검 필요"}`
                        : `⏳ ${ch.remainingText}`}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    {isFault ? (
                      <div className="text-2xl sm:text-3xl font-black text-purple-300">
                        FAULT
                        <div className="text-xs font-normal text-purple-200">
                          Raw: {ch.rawBar}b
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl sm:text-4xl font-black tracking-tighter text-white">
                        {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
                        <span className="ml-1 text-sm text-cyan-300">
                          {unitLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-3">
          <span className="text-sm font-extrabold text-emerald-300">
            ✅ 전 채널(CH01~CH22) 특수가스 공급 압력 및 센서 루프 정상 가동 중
          </span>
          <span className="font-mono text-xs text-emerald-400">
            11뱅크 Smart AI 자동 절체 대기 정상
          </span>
        </div>
      )}

      {/* 1) 가스캐비넷 5CH (10 실린더: CH01~CH10) - A/B 가스통 그래픽 */}
      <section className="rounded-3xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-sky-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950">
              🗄️ 1) 가스캐비넷 5CH (10 실린더)
            </span>
            <span className="text-sm sm:text-base font-extrabold text-white">
              P-CH4 · G-CH4 · P-H2 · MIX(Ar+H2) · C2H2 (모두 A/B 2실린더 구성)
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-sky-300">
            CH-01 ~ CH-10
          </span>
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
              onToggleValve={(chId, nextState) =>
                onToggleValve?.(chId, nextState)
              }
              onSelectChannel={(ch) => onSelectChannel?.(ch)}
              onRequestPin={() => onRequestPin?.()}
            />
          ))}
        </div>
      </section>

      {/* 2) 오토체인지 6CH (12 실린더: CH11~CH22) - A/B 가스통 그래픽 */}
      <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 p-4 sm:p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-emerald-500 px-3 py-1 text-xs sm:text-sm font-black text-slate-950">
              🔄 2) 오토체인지 6CH (12 실린더)
            </span>
            <span className="text-sm sm:text-base font-extrabold text-white">
              P-N2 · G-N2 · He · Ar · O2 · G-H2(H2저장소) (모두 A/B 2실린더 구성)
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-300">
            CH-11 ~ CH-22
          </span>
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
              onToggleValve={(chId, nextState) =>
                onToggleValve?.(chId, nextState)
              }
              onSelectChannel={(ch) => onSelectChannel?.(ch)}
              onRequestPin={() => onRequestPin?.()}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

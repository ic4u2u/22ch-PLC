"use client";

/**
 * 파일명: src/components/dashboard/SystemModals.tsx
 * 역할:
 *  1) 4자리 관리자 PIN 인증 모달 (기본 "1234", 5분=300초 자동 잠금)
 *  2) [📱 모바일 접속 주소] & [💾 설정 백업 / FA 표준값 저장(16번) / 영점 보존 FA 복원(17번)] 모달
 *  3) 채널별 순수 SVG 최근 1분 트렌드 차트 & 정밀 영점(±0.1 bar, 2차 확인 0점 설정) 모달
 */

import React, { useState, useEffect } from "react";
import { ChannelData, DiagnosticsData, PressureUnit, formatPressureByUnit, getUnitLabel } from "./types";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  adminPin: string;
  onSuccessUnlock: () => void;
}

export function PinAuthModal({
  open,
  onClose,
  adminPin,
  onSuccessUnlock,
}: PinModalProps) {
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPinInput("");
      setErrorMsg("");
    }
  }, [open]);

  if (!open) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === (adminPin || "1234")) {
      onSuccessUnlock();
      onClose();
    } else {
      setErrorMsg("PIN 번호가 일치하지 않습니다. (기본값: 1234)");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleVerify}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <h3 className="text-lg font-extrabold text-white">🔒 유지보수자 4자리 PIN 잠금 해제</h3>
        <p className="mt-1 text-xs text-slate-400">
          밸브 수동 개폐, 뱅크 설정, 영점 보정을 위해 PIN을 입력하세요. 해제 후 5분(300초) 뒤 자동 잠금됩니다.
        </p>
        <input
          type="password"
          maxLength={4}
          autoFocus
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="•••• (기본: 1234)"
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-cyan-300 focus:border-cyan-400 focus:outline-none"
        />
        {errorMsg && <p className="mt-2 text-xs font-bold text-rose-400">{errorMsg}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-800 font-bold text-slate-300 hover:bg-slate-700"
          >
            취소
          </button>
          <button
            type="submit"
            className="min-h-[44px] flex-1 rounded-xl bg-cyan-500 font-extrabold text-slate-950 hover:bg-cyan-400"
          >
            잠금 해제
          </button>
        </div>
      </form>
    </div>
  );
}

interface MobileAndFaModalProps {
  mode: "MOBILE" | "FA" | null;
  onClose: () => void;
  diagnostics: DiagnosticsData;
  isUnlocked: boolean;
  faSavedAt: string | null;
  onSaveFaPreset: () => void;
  onRestoreFaPreset: () => void;
}

export function MobileAndFaModal({
  mode,
  onClose,
  diagnostics,
  isUnlocked,
  faSavedAt,
  onSaveFaPreset,
  onRestoreFaPreset,
}: MobileAndFaModalProps) {
  const [confirmRestore, setConfirmRestore] = useState(false);

  if (!mode) return null;
  const lanIp = diagnostics.primaryLanIp || "192.168.0.100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-extrabold text-white">
            {mode === "MOBILE"
              ? "📱 사내 태블릿/스마트폰 원격 접속 주소"
              : "💾 설정 백업 및 공장표준(FA) 복원 센터"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-slate-800 px-3 text-xs font-bold text-slate-300"
          >
            ✕ 닫기
          </button>
        </div>

        {mode === "MOBILE" ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-xs text-slate-300">
              관제 PC의 <strong>LAN 2 포트</strong>와 동일한 사내 공유기(Wi-Fi)에 연결된 스마트폰, 태블릿, 사무실 PC에서 아래 주소로 즉시 접속할 수 있습니다.
            </p>
            <div className="rounded-xl border border-cyan-500/40 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">1. 상황실 통합 조작 뷰 (모바일/태블릿/PC)</div>
              <div className="mt-1 font-mono text-base font-extrabold text-cyan-300">
                http://{lanIp}:3000/?view=control
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">2. 현장 대형 TV 전광판 전용 뷰 (탭 자동 숨김)</div>
              <div className="mt-1 font-mono text-base font-extrabold text-amber-300">
                http://{lanIp}:3000/?view=wallboard
              </div>
            </div>
            <p className="text-xs text-slate-400">
              ※ 접속이 안 될 경우 루트 폴더의 <code className="text-cyan-300">allow-firewall.bat</code>를 관리자 권한으로 실행해 방화벽 포트(3000, 4000)를 허용해 주세요.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              <div>
                • 최근 FA 표준값 저장 일시:{" "}
                <strong className="text-cyan-300">{faSavedAt || "초기 공장 출하 프리셋"}</strong>
              </div>
              <div className="mt-1 text-slate-400">
                • 관리자 PIN 잠금 해제 상태에서만 FA 저장 및 복원을 실행할 수 있습니다.
              </div>
            </div>

            {/* 16번 스펙: 현재 설정을 FA 표준값으로 저장 */}
            <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-4">
              <div className="font-bold text-indigo-300">
                16) 현재 설정을 FA(공장표준) 기준값으로 저장
              </div>
              <p className="mt-1 text-xs text-slate-300">
                현재 설정된 24채널 임계값 및 12뱅크 운전 설정(모드, RUN Time, MX, 출력전압 등)을 새로운 FA 표준 프리셋으로 덮어쓰기 저장합니다.
              </p>
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={onSaveFaPreset}
                className="mt-3 min-h-[44px] w-full rounded-xl bg-indigo-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-400 disabled:opacity-40"
              >
                {isUnlocked ? "📥 16) 현재 설정을 FA 표준값으로 저장" : "🔒 PIN 해제 후 사용 가능"}
              </button>
            </div>

            {/* 17번 스펙: 영점 보정값 보존 + 2~15번 운전 설정만 FA 복원 */}
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
              <div className="font-bold text-emerald-300">
                17) 영점 보정값 보존 & 운전 설정(2~15번) FA 표준값 복원
              </div>
              <p className="mt-1 text-xs text-slate-300">
                각 채널 센서의 고유 <strong>영점 보정값(calibrationOffset)은 절대 초기화하지 않고 그대로 보존</strong>하면서, 2~15번 운전 설정(뱅크 모드, 교체압력, RUN Time, 전압 등)만 FA 표준값으로 안전하게 되돌립니다.
              </p>
              {!confirmRestore ? (
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => setConfirmRestore(true)}
                  className="mt-3 min-h-[44px] w-full rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  {isUnlocked
                    ? "♻️ 17) 영점 보정 보존 & 운전 설정 FA 복원"
                    : "🔒 PIN 해제 후 사용 가능"}
                </button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(false)}
                    className="min-h-[44px] flex-1 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreFaPreset();
                      setConfirmRestore(false);
                    }}
                    className="min-h-[44px] flex-1 rounded-xl bg-rose-500 text-xs font-extrabold text-white"
                  >
                    ✅ 확인: 영점 보존 후 FA 복원 실행
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChannelDetailModalProps {
  channel: ChannelData | null;
  trendHistory: number[];
  unit: PressureUnit;
  isUnlocked: boolean;
  onClose: () => void;
  onUpdateChannel: (id: number, updates: Partial<ChannelData>, detail: string, actionType?: string) => void;
}

export function ChannelDetailModal({
  channel,
  trendHistory,
  unit,
  isUnlocked,
  onClose,
  onUpdateChannel,
}: ChannelDetailModalProps) {
  const [confirmZero, setConfirmZero] = useState(false);
  const [warnBar, setWarnBar] = useState(35);
  const [dangerBar, setDangerBar] = useState(15);

  useEffect(() => {
    if (channel) {
      setWarnBar(channel.warnBar);
      setDangerBar(channel.dangerBar);
      setConfirmZero(false);
    }
  }, [channel]);

  if (!channel) return null;

  // 순수 SVG 최근 1분 트렌드 차트 좌표 계산
  const pts = trendHistory.length > 0 ? trendHistory : [channel.pressureBar];
  const maxVal = Math.max(channel.maxBar || 150, ...pts, 10);
  const svgW = 520;
  const svgH = 150;
  const polylinePoints = pts
    .map((val, idx) => {
      const x = pts.length === 1 ? svgW / 2 : (idx / (pts.length - 1)) * (svgW - 20) + 10;
      const y = svgH - 15 - Math.min(1, Math.max(0, val / maxVal)) * (svgH - 30);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const adjustOffset = (delta: number) => {
    const nextOffset = Number(((channel.calibrationOffset || 0) + delta).toFixed(1));
    onUpdateChannel(
      channel.id,
      { calibrationOffset: nextOffset },
      `오프셋 미세 보정 (${delta > 0 ? `+${delta}` : delta} bar → 총 ${nextOffset} bar)`,
      "CALIBRATION_OFFSET"
    );
  };

  const applyZeroCalibration = () => {
    const zeroOffset = Number((-channel.rawBar).toFixed(1));
    onUpdateChannel(
      channel.id,
      { calibrationOffset: zeroOffset },
      `[0점(Zero) 설정 실행] 배관 잔류압 제거 상태에서 영점 보정 적용 (raw=${channel.rawBar} bar → offset=${zeroOffset} bar)`,
      "ZERO_CALIBRATION"
    );
    setConfirmZero(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              ⚙️ {channel.name} · {channel.gasName} 트렌드 & 영점 보정
            </h3>
            <p className="text-xs text-slate-400">
              원시 압력(Raw): {channel.rawBar.toFixed(1)} bar | 현재 보정치:{" "}
              {channel.calibrationOffset >= 0 ? `+${channel.calibrationOffset}` : channel.calibrationOffset} bar | 최종 표시:{" "}
              <strong className="text-cyan-300">
                {formatPressureByUnit(channel.pressureBar, unit, channel.maxBar)} {getUnitLabel(unit)}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-slate-800 px-3 text-xs font-bold text-slate-300"
          >
            ✕ 닫기
          </button>
        </div>

        {/* 순수 SVG 최근 1분 트렌드 차트 */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>📈 최근 1분 실시간 압력 트렌드 (0.5초 샘플링)</span>
            <span className="font-mono text-cyan-300">현재 {channel.pressureBar.toFixed(1)} bar</span>
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-36 w-full overflow-visible">
            <line x1="10" y1={svgH - 15} x2={svgW - 10} y2={svgH - 15} stroke="#334155" strokeWidth="1" />
            <line x1="10" y1="15" x2={svgW - 10} y2="15" stroke="#1e293b" strokeDasharray="4 4" />
            <polyline
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          </svg>
        </div>

        {/* 정밀 영점(±0.1 bar) 및 2차 확인 0점(Zero) 설정 */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs font-bold text-cyan-300">
            🎯 4~20mA 압력 센서 영점(Zero) 및 ±0.1 bar 정밀 오프셋 보정
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => adjustOffset(-0.1)}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              -0.1 bar
            </button>
            <div className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center font-mono text-sm font-bold text-amber-300">
              보정 오프셋: {channel.calibrationOffset >= 0 ? `+${channel.calibrationOffset.toFixed(1)}` : channel.calibrationOffset.toFixed(1)} bar
            </div>
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => adjustOffset(+0.1)}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              +0.1 bar
            </button>
          </div>

          {/* 2차 확인 팝업을 거치는 [🎯 가스가 없을 때 0점(Zero) 설정] */}
          {!confirmZero ? (
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => setConfirmZero(true)}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
            >
              🎯 가스가 없을 때 0점(Zero) 설정 (2차 안전 확인)
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-rose-500/60 bg-rose-950/30 p-3">
              <p className="text-xs font-bold text-rose-200">
                ⚠️ [2차 안전 확인] 현재 배관에 잔류 가스가 완전히 비워진 대기압(0 bar) 상태입니까? 현재 원시 압력({channel.rawBar} bar)을 0.0 bar 기준으로 영점 설정합니다.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmZero(false)}
                  className="min-h-[40px] flex-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-300"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyZeroCalibration}
                  className="min-h-[40px] flex-1 rounded-lg bg-rose-500 text-xs font-extrabold text-white"
                >
                  ✅ 예, 지금 0점(Zero) 설정 실행
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 주의/위험 임계값 저장 */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-400">주의(WARN) 기준 (bar)</label>
            <input
              type="number"
              step="0.5"
              disabled={!isUnlocked}
              value={warnBar}
              onChange={(e) => setWarnBar(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-amber-300"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-400">위험(DANGER) 기준 (bar)</label>
            <input
              type="number"
              step="0.5"
              disabled={!isUnlocked}
              value={dangerBar}
              onChange={(e) => setDangerBar(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-rose-300"
            />
          </div>
          <button
            type="button"
            disabled={!isUnlocked}
            onClick={() =>
              onUpdateChannel(
                channel.id,
                { warnBar, dangerBar },
                `임계값 변경 (주의=${warnBar} bar, 위험=${dangerBar} bar)`,
                "THRESHOLD_UPDATE"
              )
            }
            className="min-h-[42px] rounded-xl bg-cyan-500 px-4 text-xs font-extrabold text-slate-950 disabled:opacity-40"
          >
            임계값 저장
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * 파일명: src/components/dashboard/ControllerSettingsTab.tsx
 * 역할: HANWON chemicals HW-2601A 컨트롤러 설정 탭 (S-01~S-20 사용자 설정 & H-01~H-09 시스템 설정)
 *  - 상단: 실물 HW-2601A 3-FND(메뉴번호/보기/설정값) + 4버튼(Mode/Set/Up/Down) 가상 시뮬레이터
 *  - 중단: 11개 뱅크별 설정 선택 및 S-01~S-20 / H-01~H-09 범위 검증 입력 UI
 *  - 연동: S-03/04(최대압력 20~300bar), S-05/06(교체압력 2~250bar), S-07(Ready 1~250bar),
 *          S-10(단위), S-11(모드), S-13/14(밸브동작시간 4.0~8.0초) 변경 시 앱 상태 즉시 동기화
 */

import React, { useState, useMemo } from "react";
import { BankConfig, ChannelData, PressureUnit } from "./types";
import {
  ALL_CONTROLLER_MENUS,
  ControllerMenuSpec,
  ControllerParamValues,
  HW2601A_ERROR_CODES,
  SYSTEM_MENU_SPECS,
  USER_MENU_SPECS,
  clampControllerNumber,
  createDefaultControllerParams,
} from "./controllerMenuSpec";

interface ControllerSettingsTabProps {
  banks: BankConfig[];
  channels: ChannelData[];
  unit: PressureUnit;
  isUnlocked: boolean;
  controllerConfigs: Record<string, ControllerParamValues>;
  onChangeUnit: (u: PressureUnit) => void;
  onRequestPin: () => void;
  onUpdateControllerConfig: (
    bankId: string,
    nextParams: ControllerParamValues,
    changedCode: string,
    changedValue: number | string,
    applyAllBanks?: boolean
  ) => void;
}

type FndEditFocus = "NONE" | "MENU" | "VALUE";

export default function ControllerSettingsTab({
  banks,
  channels,
  unit,
  isUnlocked,
  controllerConfigs,
  onChangeUnit,
  onRequestPin,
  onUpdateControllerConfig,
}: ControllerSettingsTabProps) {
  const [selectedBankId, setSelectedBankId] = useState<string>(
    banks[0]?.id || "BANK-01"
  );
  const [menuGroup, setMenuGroup] = useState<"USER" | "SYSTEM">("USER");
  const [fndMenuIdx, setFndMenuIdx] = useState<number>(0);
  const [fndFocus, setFndFocus] = useState<FndEditFocus>("NONE");
  const [fndTempVal, setFndTempVal] = useState<number | string | null>(null);
  const [fndSavedFlash, setFndSavedFlash] = useState(false);
  const [fndPowerStopped, setFndPowerStopped] = useState(false);

  const selectedBank = useMemo(
    () => banks.find((b) => b.id === selectedBankId) || banks[0],
    [banks, selectedBankId]
  );

  // 선택된 뱅크의 현재 컨트롤러 파라미터 (없으면 초기값 + 현재 뱅크/채널 상태 병합)
  const currentParams: ControllerParamValues = useMemo(() => {
    const base = createDefaultControllerParams();
    if (selectedBank) {
      const chA = channels[selectedBank.chA - 1];
      const chB = channels[selectedBank.chB - 1];
      if (chA) {
        base["S-03"] = clampControllerNumber(
          USER_MENU_SPECS.find((m) => m.code === "S-03")!,
          chA.maxBar
        );
        base["S-05"] = clampControllerNumber(
          USER_MENU_SPECS.find((m) => m.code === "S-05")!,
          chA.dangerBar
        );
      }
      if (chB) {
        base["S-04"] = clampControllerNumber(
          USER_MENU_SPECS.find((m) => m.code === "S-04")!,
          chB.maxBar
        );
        base["S-06"] = clampControllerNumber(
          USER_MENU_SPECS.find((m) => m.code === "S-06")!,
          chB.dangerBar
        );
      }
      base["S-07"] = clampControllerNumber(
        USER_MENU_SPECS.find((m) => m.code === "S-07")!,
        selectedBank.hysteresisBar
      );
      base["S-10"] = unit;
      base["S-11"] = selectedBank.mode;
      base["S-13"] = clampControllerNumber(
        USER_MENU_SPECS.find((m) => m.code === "S-13")!,
        selectedBank.runTimeSec
      );
      base["S-14"] = clampControllerNumber(
        USER_MENU_SPECS.find((m) => m.code === "S-14")!,
        selectedBank.runTimeSec
      );
    }
    return {
      ...base,
      ...(controllerConfigs[selectedBankId] || {}),
    };
  }, [selectedBank, channels, unit, controllerConfigs, selectedBankId]);

  const activeSpecs =
    menuGroup === "USER" ? USER_MENU_SPECS : SYSTEM_MENU_SPECS;
  const activeFndSpec =
    activeSpecs[Math.min(fndMenuIdx, activeSpecs.length - 1)] || activeSpecs[0];

  const getOptionDisplay = (spec: ControllerMenuSpec, val: number | string) => {
    if (spec.options && spec.options.length > 0) {
      const found = spec.options.find((o) => String(o.value) === String(val));
      return found ? found.fndLabel : String(val);
    }
    return String(val);
  };

  // FND 3창 표시 계산
  const fndLeftText =
    fndFocus === "MENU" ? `${activeFndSpec.code}.` : activeFndSpec.code;
  const rawVal =
    fndFocus === "VALUE" && fndTempVal !== null
      ? fndTempVal
      : currentParams[activeFndSpec.code] ?? activeFndSpec.defaultValue;
  const fndCenterText =
    activeFndSpec.code === "S-01" ||
    activeFndSpec.code === "S-08" ||
    activeFndSpec.code === "S-09" ||
    activeFndSpec.code === "S-10" ||
    activeFndSpec.code === "S-11"
      ? getOptionDisplay(activeFndSpec, rawVal)
      : activeFndSpec.fndView;
  const fndRightText = fndSavedFlash
    ? "0."
    : fndFocus === "VALUE"
    ? `${rawVal}.`
    : String(rawVal);

  const commitChange = (
    spec: ControllerMenuSpec,
    newVal: number | string,
    applyAllBanks = false
  ) => {
    if (!isUnlocked) {
      onRequestPin();
      return;
    }

    let finalVal: number | string = newVal;
    if (spec.inputType === "number") {
      finalVal = clampControllerNumber(spec, Number(newVal));
    }

    // S-17 저장 / S-18 불러오기 / H-09 공장 초기화 특수 동작
    if (spec.code === "H-09" && finalVal === "YES") {
      const defaults = createDefaultControllerParams();
      onUpdateControllerConfig(
        selectedBankId,
        defaults,
        spec.code,
        "YES (공장초기화)",
        applyAllBanks
      );
      return;
    }

    const nextParams: ControllerParamValues = {
      ...currentParams,
      [spec.code]: finalVal,
    };

    if (spec.code === "S-10") {
      const u = Number(finalVal);
      if (u === 0 || u === 1 || u === 2 || u === 3) {
        onChangeUnit(u as PressureUnit);
      }
    }

    onUpdateControllerConfig(
      selectedBankId,
      nextParams,
      spec.code,
      finalVal,
      applyAllBanks
    );
  };

  // 가상 컨트롤러 4개 버튼 핸들러
  const handleFndModeBtn = () => {
    setFndFocus("MENU");
    setFndTempVal(null);
  };

  const handleFndSetBtn = () => {
    if (fndFocus !== "VALUE") {
      setFndFocus("VALUE");
      setFndTempVal(
        currentParams[activeFndSpec.code] ?? activeFndSpec.defaultValue
      );
      return;
    }
    // 설정값 저장 (Set 재클릭 시 0. 깜빡임 후 저장)
    if (fndTempVal !== null) {
      commitChange(activeFndSpec, fndTempVal, false);
    }
    setFndFocus("NONE");
    setFndTempVal(null);
    setFndSavedFlash(true);
    setTimeout(() => setFndSavedFlash(false), 900);
  };

  const handleFndStep = (dir: 1 | -1) => {
    if (fndFocus === "MENU" || fndFocus === "NONE") {
      setFndFocus("MENU");
      setFndMenuIdx(
        (prev) => (prev + dir + activeSpecs.length) % activeSpecs.length
      );
      return;
    }
    if (fndFocus === "VALUE") {
      const cur =
        fndTempVal ??
        currentParams[activeFndSpec.code] ??
        activeFndSpec.defaultValue;
      if (activeFndSpec.options && activeFndSpec.options.length > 0) {
        const idx = activeFndSpec.options.findIndex(
          (o) => String(o.value) === String(cur)
        );
        const nextIdx =
          (Math.max(0, idx) + dir + activeFndSpec.options.length) %
          activeFndSpec.options.length;
        setFndTempVal(activeFndSpec.options[nextIdx].value);
      } else if (activeFndSpec.inputType === "number") {
        const step = activeFndSpec.step ?? 1;
        const nextNum = clampControllerNumber(
          activeFndSpec,
          Number(cur) + dir * step
        );
        setFndTempVal(nextNum);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* 상단 안내 & 통합 매뉴얼 바로가기 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-cyan-300">
            🎛️ HW-2601A 자동절체 컨트롤러 설정 (매뉴얼 S-01~S-20 · 시스템 H-01~H-09)
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            실물 컨트롤러 매뉴얼의 초기값과 허용 범위(예: S-03 A압력 최대값 초기 160 bar / 설정 20~300 bar)가 앱에도 동일하게 적용됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/controller-manual.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[42px] items-center rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow hover:bg-amber-300 transition-all"
          >
            📘 HW-2601A 컨트롤러 &amp; 앱 통합 사용자 설명서
          </a>
        </div>
      </div>

      {/* 뱅크 선택 바 (1~11번 뱅크) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-300">
            1️⃣ 설정할 뱅크(컨트롤러) 선택:
          </span>
          {!isUnlocked && (
            <button
              type="button"
              onClick={onRequestPin}
              className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25"
            >
              🔒 현재 잠금 상태 (클릭하여 PIN 해제 후 수정)
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {banks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBankId(b.id)}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                selectedBankId === b.id
                  ? "bg-cyan-500 text-slate-950 shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {b.bankNumber}번 · {b.gasCode}
            </button>
          ))}
        </div>
      </div>

      {/* 실물 HW-2601A 가상 전면 패널 시뮬레이터 (3 FND + 4버튼) */}
      <div className="rounded-3xl border-2 border-sky-400/50 bg-gradient-to-b from-[#0d6282] to-[#08445c] p-4 sm:p-6 shadow-2xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
          <div className="text-sm sm:text-base font-black tracking-wide">
            Auto Changeover System Controller{" "}
            <span className="ml-2 rounded bg-black/30 px-2 py-0.5 font-mono text-xs text-cyan-200">
              Model: HW-2601A · {selectedBank?.bankNumber}번 뱅크 ({selectedBank?.gasName})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMenuGroup("USER");
                setFndMenuIdx(0);
                setFndFocus("MENU");
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                menuGroup === "USER"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-black/30 text-white hover:bg-black/50"
              }`}
            >
              Mode 2초 (S-01~S-20)
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuGroup("SYSTEM");
                setFndMenuIdx(0);
                setFndFocus("MENU");
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                menuGroup === "SYSTEM"
                  ? "bg-rose-400 text-slate-950"
                  : "bg-black/30 text-white hover:bg-black/50"
              }`}
            >
              Set 7초 (시스템 H-01~H-09)
            </button>
            <button
              type="button"
              onClick={() => setFndPowerStopped((p) => !p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                fndPowerStopped
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-black/30 text-slate-200 hover:bg-black/50"
              }`}
            >
              {fndPowerStopped ? "⛔ 강제정지 해제 (Up+Down 2초)" : "Up+Down 2초 (수동강제정지)"}
            </button>
          </div>
        </div>

        {/* 3개 FND 표시창 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border-2 border-slate-700 bg-slate-950 p-3 text-center">
            <div className="text-[11px] font-bold text-slate-400">
              좌측 FND (메뉴번호)
            </div>
            <div className="mt-1 font-mono text-3xl sm:text-4xl font-black tracking-widest text-rose-500">
              {fndPowerStopped ? "StoP" : fndLeftText}
            </div>
          </div>

          <div className="rounded-xl border-2 border-slate-700 bg-slate-950 p-3 text-center">
            <div className="text-[11px] font-bold text-slate-400">
              중앙 FND (보기 · {activeFndSpec.title})
            </div>
            <div className="mt-1 font-mono text-3xl sm:text-4xl font-black tracking-widest text-rose-500">
              {fndPowerStopped ? "----" : fndCenterText}
            </div>
          </div>

          <div className="rounded-xl border-2 border-slate-700 bg-slate-950 p-3 text-center">
            <div className="text-[11px] font-bold text-slate-400">
              우측 FND (설정값{activeFndSpec.unit ? ` · ${activeFndSpec.unit}` : ""})
            </div>
            <div className="mt-1 font-mono text-3xl sm:text-4xl font-black tracking-widest text-rose-500">
              {fndPowerStopped ? "CLSE" : fndRightText}
            </div>
          </div>
        </div>

        {/* 실물과 동일한 4개 버튼 배치: (Mode) (Set) + 우측 상하 (Up)/(Down) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/25 p-4">
          <div className="text-xs text-cyan-100 space-y-1 max-w-md">
            <div>
              • <strong>Mode</strong>: 메뉴번호 선택 모드 (<code className="text-amber-300">{activeFndSpec.code}.</code> 점등)
            </div>
            <div>
              • <strong>Set</strong>: 설정값 변경 진입 (<code className="text-amber-300">값.</code> 점등) → 재클릭 시 저장 (<code className="text-emerald-300">0.</code>)
            </div>
            <div>
              • <strong>Up / Down</strong>: 메뉴 이동 또는 설정값 증감
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleFndModeBtn}
              className="h-14 w-14 rounded-full border-2 border-slate-300 bg-slate-100 font-black text-slate-900 shadow-lg active:scale-95 hover:bg-amber-200 text-xs"
            >
              Mode
            </button>
            <button
              type="button"
              onClick={handleFndSetBtn}
              className="h-14 w-14 rounded-full border-2 border-slate-300 bg-slate-100 font-black text-slate-900 shadow-lg active:scale-95 hover:bg-emerald-200 text-xs"
            >
              Set
            </button>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleFndStep(1)}
                className="h-12 w-14 rounded-full border-2 border-slate-300 bg-slate-100 font-black text-slate-900 shadow-lg active:scale-95 hover:bg-cyan-200 text-xs"
              >
                ▲ Up
              </button>
              <button
                type="button"
                onClick={() => handleFndStep(-1)}
                className="h-12 w-14 rounded-full border-2 border-slate-300 bg-slate-100 font-black text-slate-900 shadow-lg active:scale-95 hover:bg-cyan-200 text-xs"
              >
                ▼ Down
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 설정 (S-01~S-20) / 시스템 설정 (H-01~H-09) 전환 탭 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMenuGroup("USER");
            setFndMenuIdx(0);
          }}
          className={`min-h-[42px] rounded-xl px-4 py-2 text-sm font-black transition-all ${
            menuGroup === "USER"
              ? "bg-cyan-500 text-slate-950 shadow"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          📋 사용자 메뉴 [S-01 ~ S-20] (20개)
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuGroup("SYSTEM");
            setFndMenuIdx(0);
          }}
          className={`min-h-[42px] rounded-xl px-4 py-2 text-sm font-black transition-all ${
            menuGroup === "SYSTEM"
              ? "bg-rose-500 text-white shadow"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          🛠️ 시스템 설정 [H-01 ~ H-09] (9개 · 네트워크/초기화)
        </button>
      </div>

      {/* 메뉴 항목 카드 그리드 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeSpecs.map((spec, idx) => {
          const val = currentParams[spec.code] ?? spec.defaultValue;
          return (
            <MenuSettingCard
              key={spec.code}
              spec={spec}
              value={val}
              isUnlocked={isUnlocked}
              isSelectedOnFnd={activeFndSpec.code === spec.code}
              onFocusFnd={() => setFndMenuIdx(idx)}
              onApply={(nextVal, applyAll) =>
                commitChange(spec, nextVal, applyAll)
              }
            />
          );
        })}
      </div>

      {/* 하단 에러 코드 참고표 (E-01 ~ E-04) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <h3 className="text-sm font-black text-rose-300">
          🚨 HW-2601A 컨트롤러 에러 코드 안내 (E-01 ~ E-04)
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {HW2601A_ERROR_CODES.map((err) => (
            <div
              key={err.code}
              className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs"
            >
              <span className="font-mono font-black text-rose-400">
                {err.code}
              </span>
              <p className="mt-1 text-slate-200">{err.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuSettingCard({
  spec,
  value,
  isUnlocked,
  isSelectedOnFnd,
  onFocusFnd,
  onApply,
}: {
  spec: ControllerMenuSpec;
  value: number | string;
  isUnlocked: boolean;
  isSelectedOnFnd: boolean;
  onFocusFnd: () => void;
  onApply: (val: number | string, applyAll: boolean) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));

  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const numericDraft = Number(draft);
  const outOfRange =
    spec.inputType === "number" &&
    (!Number.isFinite(numericDraft) ||
      (spec.min !== undefined && numericDraft < spec.min) ||
      (spec.max !== undefined && numericDraft > spec.max));

  return (
    <div
      onClick={onFocusFnd}
      className={`rounded-2xl border p-4 transition-all ${
        isSelectedOnFnd
          ? "border-amber-400 bg-slate-900 shadow-lg shadow-amber-500/10"
          : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 font-mono text-xs font-black text-cyan-300">
              {spec.code}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-400">
              {spec.fndView}
            </span>
            <span className="text-sm font-extrabold text-white">
              {spec.title}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{spec.description}</p>
        </div>
        <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
          초기: {spec.defaultValue}
          {spec.unit ? ` ${spec.unit}` : ""}
        </span>
      </div>

      {/* 입력 UI */}
      <div className="mt-3">
        {spec.options && spec.options.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {spec.options.map((opt) => {
              const selected = String(value) === String(opt.value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply(opt.value, false);
                  }}
                  className={`min-h-[38px] rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all ${
                    selected
                      ? "border-cyan-400 bg-cyan-500/20 font-black text-cyan-200"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="font-mono text-amber-300 mr-1.5">
                    [{opt.fndLabel}]
                  </span>
                  <span>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        ) : spec.inputType === "number" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-300">
                허용 범위: {spec.min} ~ {spec.max} {spec.unit}
              </span>
              <span className="font-mono text-cyan-300">
                현재: {value} {spec.unit}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={spec.min}
                max={spec.max}
                step={spec.step ?? 1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-white ${
                  outOfRange ? "border-rose-500 text-rose-300" : "border-slate-700"
                }`}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const clamped = clampControllerNumber(spec, Number(draft));
                  setDraft(String(clamped));
                  onApply(clamped, false);
                }}
                className="min-h-[40px] shrink-0 rounded-xl bg-cyan-500 px-3 text-xs font-black text-slate-950 hover:bg-cyan-400"
              >
                {isUnlocked ? "적용" : "🔒"}
              </button>
              <button
                type="button"
                title="11개 전체 뱅크에 동일하게 적용"
                onClick={(e) => {
                  e.stopPropagation();
                  const clamped = clampControllerNumber(spec, Number(draft));
                  setDraft(String(clamped));
                  onApply(clamped, true);
                }}
                className="min-h-[40px] shrink-0 rounded-xl border border-indigo-400/50 bg-indigo-500/20 px-2.5 text-[11px] font-extrabold text-indigo-200 hover:bg-indigo-500/35"
              >
                전체적용
              </button>
            </div>
            {outOfRange && (
              <p className="text-[11px] font-bold text-rose-400">
                ⚠️ 설정 범위({spec.min} ~ {spec.max})를 벗어났습니다. 적용 시 범위 내 값으로 자동 보정됩니다.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApply(draft, false);
              }}
              className="min-h-[40px] shrink-0 rounded-xl bg-cyan-500 px-3 text-xs font-black text-slate-950 hover:bg-cyan-400"
            >
              {isUnlocked ? "적용" : "🔒"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * 파일명: src/components/dashboard/FloorplanTab.tsx
 * 역할: [탭 5] 🗺️ 공장 도면 뷰 (CAD 도면 3대 구역 + 같은 가스 종류 2개씩[A통·B통] 색상 구분선 & 폰트 완벽 분리 디자인)
 *  - 구역 1 (좌상단): 🏠 H2 저장소 — BANK-11 [G-H2 일반수소 : CH21(A) | CH22(B)]
 *  - 구역 2 (중단): 🔄 오토체인지 5세트 — BANK-06~10 [P-N2, G-N2, He, Ar, O2 : 각 A통 | B통 2개씩 색상 구분 박스]
 *  - 구역 3 (하단): 🗄️ 가스저장소(CABINET) 5칸 — BANK-01~05 [P-CH4, G-CH4, P-H2, MIX, C2H2 : 각 A통 | B통 2개씩 방폭 캐비넷 박스]
 *  - 사용자 원본 도면 업로드 시에도 같은 가스 A-B끼리 색상 연결선 및 고유 컬러 테두리로 2개씩 묶음 표시
 */

import React, { useRef, useState } from "react";
import {
  ChannelData,
  PressureUnit,
  formatChannelCode,
  formatPressureByUnit,
  getGasPhysicsMeta,
  getUnitLabel,
} from "./types";

interface FloorplanTabProps {
  channels: ChannelData[];
  unit: PressureUnit;
  floorplanBg: string;
  isUnlocked: boolean;
  onSyncFloorplan: (payload: {
    floorplan_bg?: string;
    channel_configs?: ChannelData[];
    detail: string;
  }) => void;
  onSelectChannel: (ch: ChannelData) => void;
  onRequestPin: () => void;
}

export default function FloorplanTab({
  channels,
  unit,
  floorplanBg,
  isUnlocked,
  onSyncFloorplan,
  onSelectChannel,
  onRequestPin,
}: FloorplanTabProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const unitLabel = getUnitLabel(unit);

  // 22개 채널을 같은 가스 종류 2개씩(A통 + B통) 11개 페어로 그룹핑
  const buildPairs = (list: ChannelData[]) => {
    const pairs: { bankNum: number; chA: ChannelData; chB: ChannelData }[] = [];
    for (let i = 0; i < list.length; i += 2) {
      if (list[i] && list[i + 1]) {
        pairs.push({
          bankNum: Math.ceil(list[i].id / 2),
          chA: list[i],
          chB: list[i + 1],
        });
      }
    }
    return pairs;
  };

  const allPairs = buildPairs(channels);
  const cabinetPairs = allPairs.filter((p) => p.bankNum >= 1 && p.bankNum <= 5);
  const autoWallPairs = allPairs.filter((p) => p.bankNum >= 6 && p.bankNum <= 10);
  const h2RoomPair = allPairs.find((p) => p.bankNum === 11);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(
      4,
      Math.min(96, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1)))
    );
    const yPct = Math.max(
      6,
      Math.min(94, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1)))
    );

    const updated = channels.map((c) =>
      c.id === draggingId ? { ...c, pinX: xPct, pinY: yPct } : c
    );
    onSyncFloorplan({
      channel_configs: updated,
      detail: `CH-${String(draggingId).padStart(2, "0")} 도면 핀 위치 이동 (${xPct}%, ${yPct}%)`,
    });
  };

  const handleUploadBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isUnlocked) {
      onRequestPin();
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSyncFloorplan({
          floorplan_bg: reader.result,
          detail: `공장 도면 배경 이미지 업로드 (${file.name})`,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // 도면 내 [같은 가스 2개(A통 + B통) 통합 스테이션 박스] 렌더링 함수
  const renderGasPairStation = (
    pair: { bankNum: number; chA: ChannelData; chB: ChannelData },
    stationPrefix: string
  ) => {
    const { bankNum, chA, chB } = pair;
    const gasColor = chA.color || "#0ea5e9";
    const isAOpen = chA.valveState === 0;
    const hasAlarm =
      chA.status === "DANGER" ||
      chB.status === "DANGER" ||
      chA.status === "SENSOR_FAULT" ||
      chB.status === "SENSOR_FAULT";

    const renderSingleCylinderPin = (ch: ChannelData) => {
      const isOpen = ch.valveState === 0;
      const phys = getGasPhysicsMeta(ch.gasCode, ch.pressureBar, ch.maxBar);
      const isFault = ch.status === "SENSOR_FAULT";
      const isDanger = ch.status === "DANGER";
      const isWarn = ch.status === "WARN";

      let boxClass = isOpen
        ? "border-emerald-400 bg-emerald-950/70 text-white shadow-md shadow-emerald-500/15"
        : "border-slate-600 bg-slate-900/90 text-slate-300";

      if (isFault) {
        boxClass = "border-purple-400 bg-purple-950/80 text-white animate-pulse";
      } else if (isDanger) {
        boxClass = "border-rose-400 bg-rose-950/80 text-white animate-pulse";
      } else if (isWarn && isOpen) {
        boxClass = "border-amber-400 bg-amber-950/75 text-white";
      }

      return (
        <div
          key={ch.id}
          onClick={() => onSelectChannel(ch)}
          className={`flex flex-col justify-between rounded-xl border-2 p-2 cursor-pointer transition-all hover:scale-[1.03] ${boxClass}`}
        >
          {/* 상단: A실린더/B실린더 배지 + 채널번호(CH-01) + 공급중/예비대기 상태 */}
          <div className="flex items-center justify-between gap-1">
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black whitespace-nowrap ${
                ch.side === "A"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-cyan-400 text-slate-950"
              }`}
            >
              {ch.side}실린더 [{formatChannelCode(ch.id)}]
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-black whitespace-nowrap ${
                isOpen
                  ? "bg-emerald-400 text-slate-950"
                  : "bg-slate-800 text-slate-400 border border-slate-600"
              }`}
            >
              {isOpen ? "공급중" : "예비대기"}
            </span>
          </div>

          {/* 중단: 큼직한 압력 수치 */}
          <div className="my-1.5 flex items-baseline justify-between gap-1 font-mono">
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              {phys.realMassPct}%
            </span>
            {isFault ? (
              <span className="text-sm font-black text-purple-300 whitespace-nowrap">센서점검</span>
            ) : (
              <span
                className={`text-base sm:text-lg font-black tracking-tighter whitespace-nowrap ${
                  isOpen ? "text-white" : "text-slate-300"
                }`}
              >
                {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)}
                <span className="ml-0.5 text-[10px] font-bold text-cyan-300">
                  {unitLabel}
                </span>
              </span>
            )}
          </div>

          {/* 하단: 미니 잔량 게이지 바 */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                isFault
                  ? "bg-purple-400"
                  : isDanger
                  ? "bg-rose-500"
                  : isWarn && isOpen
                  ? "bg-amber-400"
                  : isOpen
                  ? "bg-emerald-400"
                  : "bg-slate-500"
              }`}
              style={{ width: `${phys.realMassPct}%` }}
            />
          </div>
        </div>
      );
    };

    return (
      <div
        key={`station-${bankNum}`}
        className={`flex flex-col justify-between rounded-2xl border-2 bg-slate-950/95 p-2.5 shadow-xl transition-all ${
          hasAlarm ? "ring-2 ring-rose-500" : ""
        }`}
        style={{
          borderColor: gasColor,
          borderTopWidth: "5px",
        }}
      >
        {/* 상단: 가스 종류 고유 색상 헤더 바 (같은 가스 2개씩 한눈에 구분!) */}
        <div className="mb-2 border-b border-slate-800 pb-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-black text-slate-300 whitespace-nowrap">
              {stationPrefix} ({bankNum}번 뱅크)
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-black whitespace-nowrap ${
                isAOpen
                  ? "bg-sky-500/25 text-sky-300 border border-sky-400/40"
                  : "bg-teal-500/25 text-teal-300 border border-teal-400/40"
              }`}
            >
              {isAOpen ? "◀A공급" : "B공급▶"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full shadow"
              style={{ backgroundColor: gasColor }}
            />
            <span
              className="truncate text-xs sm:text-sm font-black tracking-tight whitespace-nowrap"
              style={{ color: "#ffffff" }}
            >
              {chA.gasName}
            </span>
          </div>
        </div>

        {/* 본문: 좌측 [A통] | 중앙 색상 점선 구분선 | 우측 [B통] */}
        <div className="grid grid-cols-2 gap-2 relative">
          <div
            className=" pr-1 border-r-2 border-dashed"
            style={{ borderColor: `${gasColor}88` }}
          >
            {renderSingleCylinderPin(chA)}
          </div>
          <div className="pl-0.5">{renderSingleCylinderPin(chB)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-cyan-300">
            🗺️ 현장 특수가스 저장소(제1구역: 가스캐비닛 5뱅크) & 오토체인지(제2·3구역: 6뱅크) CAD 도면 뷰
          </h3>
          <p className="text-xs text-slate-400">
            동일 가스 2실린더(<strong>A실린더 + B실린더</strong>)씩 <strong>뱅크별 고유 색상 테두리 박스</strong>와 <strong>중앙 점선 구분선</strong>으로 묶여 있어 인접 가스와 절대 헷갈리지 않습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="min-h-[40px] cursor-pointer inline-flex items-center rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-extrabold text-cyan-200 hover:bg-cyan-500/25">
            <span>🖼️ 사용자 도면 이미지 업로드</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadBg}
              className="hidden"
            />
          </label>
          {floorplanBg && (
            <button
              type="button"
              onClick={() => {
                if (!isUnlocked) return onRequestPin();
                onSyncFloorplan({
                  floorplan_bg: "",
                  detail: "현장 CAD 기반 기본 구조화 도면으로 복원",
                });
              }}
              className="min-h-[40px] rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              기본 CAD 도면 복원
            </button>
          )}
        </div>
      </div>

      {/* 사용자 커스텀 배경 이미지가 업로드된 경우: 드래그 앤 드롭 캔버스 + A/B 색상 연결선 */}
      {floorplanBg ? (
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDraggingId(null)}
          onMouseLeave={() => setDraggingId(null)}
          className="relative h-[580px] w-full select-none overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-inner"
        >
          <img
            src={floorplanBg}
            alt="Custom Floorplan"
            className="h-full w-full object-cover opacity-75"
          />
          {/* 같은 가스 A통-B통 사이 색상 구분 연결선 SVG */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {allPairs.map(({ bankNum, chA, chB }) => (
              <line
                key={`line-${bankNum}`}
                x1={`${chA.pinX}%`}
                y1={`${chA.pinY}%`}
                x2={`${chB.pinX}%`}
                y2={`${chB.pinY}%`}
                stroke={chA.color || "#38bdf8"}
                strokeWidth="3"
                strokeDasharray="5 3"
              />
            ))}
          </svg>
          {channels.map((ch) => (
            <div
              key={ch.id}
              style={{
                left: `${ch.pinX ?? 15}%`,
                top: `${ch.pinY ?? 25}%`,
                transform: "translate(-50%, -50%)",
                borderColor: ch.color || "#38bdf8",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!isUnlocked) return;
                setDraggingId(ch.id);
              }}
              onClick={() => {
                if (draggingId === null) onSelectChannel(ch);
              }}
              className="absolute z-10 cursor-pointer rounded-xl border-2 bg-slate-950/95 px-2.5 py-1.5 text-white shadow-xl transition-transform hover:scale-110"
            >
              <div className="text-[10px] font-black" style={{ color: ch.color }}>
                {ch.gasCode} [{ch.side}통]
              </div>
              <div className="font-mono text-xs font-black">
                {formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)} {unitLabel}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 기본 CAD 도면 뷰: 어떤 해상도에서도 박스 밖으로 밀려나지 않고 같은 가스 2개(A+B)씩 칼같이 구분되는 반응형 CAD 도면 */
        <div
          className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4 sm:p-5 space-y-5 shadow-inner"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(30,41,59,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,41,59,0.35) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        >
          {/* 1층 (좌상단): PIPE RACK & 🏠 제3구역: 수소저장소 (오토체인지 6호 : 일반수소 A실린더 + B실린더) */}
          <div className="flex flex-wrap items-stretch justify-between gap-4">
            <div className="w-full lg:w-[380px] rounded-2xl border-2 border-purple-500/70 bg-purple-950/15 p-3.5 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-lg bg-purple-500 px-2.5 py-0.5 text-xs font-black text-slate-950 whitespace-nowrap">
                  🏠 제3구역: 수소저장소 (11번 뱅크 · 2실린더)
                </span>
                <span className="font-mono text-[11px] font-bold text-purple-300 whitespace-nowrap">
                  CH-21 ~ CH-22 (6호)
                </span>
              </div>
              {h2RoomPair && renderGasPairStation(h2RoomPair, "오토체인지 6호")}
            </div>

            {/* 우측: 도면 범례 (가스 종류별 고유 색상 & P/G 등급 안내) */}
            <div className="flex-1 min-w-[280px] rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-cyan-300 whitespace-nowrap">
                  🎨 뱅크별 2실린더(A실린더+B실린더) 표준 색상 구분 가이드
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  실린더 박스 클릭 시 상세 트렌드 & 영점 보정(⚙️)
                </span>
              </div>
              <div className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <span className="font-black text-emerald-400 whitespace-nowrap">🟢 공급중 (초록 박스)</span>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    현재 공정 배관으로 가스를 공급 중인 활성 실린더
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <span className="font-black text-slate-300 whitespace-nowrap">⚪ 예비대기 (슬레이트 박스)</span>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    만충 상태로 자동절체를 대기 중인 예비 실린더
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <span className="font-black text-amber-300 whitespace-nowrap">┇ 중앙 색상 점선</span>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    동일 뱅크의 <strong>A실린더(좌·홀수CH)</strong>와 <strong>B실린더(우·짝수CH)</strong> 구분선
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                <span className="font-bold text-slate-400 whitespace-nowrap">순도 기호:</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-cyan-300 whitespace-nowrap">
                  P- = 99.999% 초고순도
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-amber-300 whitespace-nowrap">
                  G- = 99.95% 일반순도
                </span>
              </div>
            </div>
          </div>

          {/* 2층 (중단 벽면 5,500mm): 🔄 제2구역: 오토체인지 구역 (오토체인지 1~5호 = 10실린더) */}
          <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-950/10 p-3.5 shadow-lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-black text-slate-950 whitespace-nowrap">
                  🔄 제2구역: 오토체인지 벽면 매니폴드 구역 (5뱅크 · 10실린더)
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-200 whitespace-nowrap">
                  오토체인지 1~5호 — A실린더·B실린더 2기씩 독립 구획 (설치 폭 5,500mm)
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400 whitespace-nowrap">
                CH-11 ~ CH-20 (6번 ~ 10번 뱅크)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {autoWallPairs.map((pair, idx) =>
                renderGasPairStation(pair, `오토체인지 ${idx + 1}호`)
              )}
            </div>
          </div>

          {/* 3층 (하단 방폭룸 7,700mm): 🗄️ 제1구역: 가스캐비닛 구역 (가스캐비닛 1~5호 = 10실린더) */}
          <div className="rounded-2xl border-2 border-sky-500/60 bg-sky-950/10 p-3.5 shadow-lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-black text-slate-950 whitespace-nowrap">
                  🗄️ 제1구역: 가스캐비닛 구역 (5뱅크 · 10실린더)
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-sky-200 whitespace-nowrap">
                  가스캐비닛 1~5호 — 캐비닛 1대(800×550mm)당 A실린더·B실린더 2기씩 수납
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-sky-400 whitespace-nowrap">
                CH-01 ~ CH-10 (1번 ~ 5번 뱅크)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {cabinetPairs.map((pair, idx) =>
                renderGasPairStation(pair, `가스캐비닛 ${idx + 1}호`)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

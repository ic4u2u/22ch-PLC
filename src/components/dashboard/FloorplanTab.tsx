"use client";

/**
 * 파일명: src/components/dashboard/FloorplanTab.tsx
 * 역할: [탭 5] 🗺️ 공장 도면 뷰
 *  - 클린룸/가스실 기본 SVG 도면 및 사용자 도면 이미지 업로드 지원
 *  - 마우스 드래그 앤 드롭으로 24채널 핀 배치 및 다중 PC 실시간 SQLite 동기화
 */

import React, { useRef, useState } from "react";
import {
  ChannelData,
  PressureUnit,
  formatPressureByUnit,
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(
      3,
      Math.min(96, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1)))
    );
    const yPct = Math.max(
      5,
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

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-cyan-300">
            🗺️ 클린룸 & 특수가스 공급실(Gas Cabinet Room) 실시간 배치도
          </h3>
          <p className="text-xs text-slate-400">
            {isUnlocked
              ? "🔓 관리자 잠금 해제됨: 채널 핀을 마우스로 드래그하여 원하는 위치에 놓으면 모든 관제 PC/태블릿에 즉시 동기화됩니다."
              : "🔒 핀 위치를 이동하거나 도면 이미지를 변경하려면 상단 [관리자 PIN 잠금]을 해제해 주세요."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="min-h-[40px] cursor-pointer inline-flex items-center rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-extrabold text-cyan-200 hover:bg-cyan-500/25">
            <span>🖼️ 도면 이미지 업로드</span>
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
                  detail: "기본 클린룸/가스실 SVG 도면으로 초기화",
                });
              }}
              className="min-h-[40px] rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              기본 SVG 도면 복원
            </button>
          )}
        </div>
      </div>

      {/* 도면 캔버스 */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDraggingId(null)}
        onMouseLeave={() => setDraggingId(null)}
        className="relative h-[540px] w-full select-none overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-inner"
      >
        {floorplanBg ? (
          <img
            src={floorplanBg}
            alt="Custom Floorplan"
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          /* 기본 클린룸 / 특수가스 캐비닛 룸 SVG 설계도면 */
          <svg viewBox="0 0 1000 540" className="h-full w-full">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="1000" height="540" fill="url(#grid)" />
            {/* 구역 외곽선 */}
            <rect
              x="25"
              y="25"
              width="950"
              height="490"
              rx="12"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            <rect
              x="40"
              y="45"
              width="450"
              height="220"
              rx="8"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            <text x="60" y="75" fill="#38bdf8" fontSize="15" fontWeight="bold">
              ZONE A : 특수가스 실린더 캐비닛 룸 #1 (BANK 01 ~ 06)
            </text>

            <rect
              x="510"
              y="45"
              width="450"
              height="220"
              rx="8"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            <text x="530" y="75" fill="#38bdf8" fontSize="15" fontWeight="bold">
              ZONE B : 특수가스 실린더 캐비닛 룸 #2 (BANK 07 ~ 11)
            </text>

            <rect
              x="40"
              y="285"
              width="920"
              height="210"
              rx="8"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            <text x="60" y="315" fill="#a855f7" fontSize="15" fontWeight="bold">
              ZONE C : FAB 클린룸 VMB (Valve Manifold Box) & POU 공정 장비 라인
            </text>
          </svg>
        )}

        {/* 24채널 드래그 앤 드롭 핀 렌더링 */}
        {channels.map((ch) => {
          let pinBg = "bg-emerald-500 border-emerald-200 text-slate-950";
          if (ch.status === "SENSOR_FAULT") {
            pinBg = "bg-purple-600 border-purple-200 text-white animate-bounce";
          } else if (ch.status === "DANGER") {
            pinBg = "bg-rose-600 border-rose-200 text-white animate-pulse";
          } else if (ch.status === "WARN") {
            pinBg = "bg-amber-400 border-amber-100 text-slate-950";
          } else if (ch.status === "SHUTOFF") {
            pinBg = "bg-slate-700 border-slate-500 text-slate-300";
          }

          return (
            <div
              key={ch.id}
              style={{
                left: `${ch.pinX ?? 15}%`,
                top: `${ch.pinY ?? 25}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!isUnlocked) return;
                setDraggingId(ch.id);
              }}
              onClick={() => {
                if (draggingId === null) onSelectChannel(ch);
              }}
              className={`absolute z-10 cursor-pointer rounded-xl border-2 px-2.5 py-1.5 shadow-xl transition-transform hover:scale-110 ${pinBg}`}
            >
              <div className="flex items-center gap-1 text-[10px] font-black leading-none">
                <span>CH{String(ch.id).padStart(2, "0")}</span>
                <span>({ch.gasCode})</span>
              </div>
              <div className="mt-0.5 font-mono text-xs font-black">
                {ch.status === "SENSOR_FAULT"
                  ? "FAULT"
                  : `${formatPressureByUnit(ch.pressureBar, unit, ch.maxBar)} ${unitLabel}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * 파일명: src/components/dashboard/FloorplanTab.tsx
 * 역할: [탭 5] 🗺️ 공장 도면 뷰
 *  - 실제 현장 CAD 도면(H2 저장소 + 자동절체기 5세트 + 가스저장소 캐비넷 5칸) 기본 SVG 내장
 *  - 마우스 드래그 앤 드롭으로 22채널 핀 배치 및 다중 PC 실시간 SQLite 동기화
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
            🗺️ 현장 특수가스 저장소(CABINET 5CH) & 오토체인지(자동절체기 6CH) 실시간 도면
          </h3>
          <p className="text-xs text-slate-400">
            {isUnlocked
              ? "🔓 관리자 잠금 해제됨: 채널 핀을 마우스로 드래그하여 원하는 위치에 놓으면 모든 관제 PC/태블릿에 즉시 동기화됩니다."
              : "🔒 핀 위치를 이동하거나 도면 이미지를 변경하려면 상단 [관리자 PIN 잠금]을 해제해 주세요."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="min-h-[40px] cursor-pointer inline-flex items-center rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-extrabold text-cyan-200 hover:bg-cyan-500/25">
            <span>🖼️ 원본 도면 이미지 업로드</span>
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
                  detail: "현장 CAD 기반 기본 SVG 도면으로 복원",
                });
              }}
              className="min-h-[40px] rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              기본 CAD 도면 복원
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
        className="relative h-[560px] w-full select-none overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-inner"
      >
        {floorplanBg ? (
          <img
            src={floorplanBg}
            alt="Custom Floorplan"
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          /* 실제 현장 CAD 도면 1:1 재현 SVG (H2 저장소 + 자동절체기 5세트 + 가스저장소 CABINET 5칸) */
          <svg viewBox="0 0 1000 560" className="h-full w-full">
            <defs>
              <pattern id="cad-grid" width="35" height="35" patternUnits="userSpaceOnUse">
                <path
                  d="M 35 0 L 0 0 0 35"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="1000" height="560" fill="url(#cad-grid)" />

            {/* 상단 PIPE RACK & H2 저장소 (BANK-11 : G-H2 CH21/CH22) */}
            <line x1="180" y1="0" x2="180" y2="55" stroke="#38bdf8" strokeWidth="3" />
            <line x1="192" y1="0" x2="192" y2="55" stroke="#38bdf8" strokeWidth="3" />
            <text x="208" y="24" fill="#94a3b8" fontSize="12" fontWeight="bold">
              PIPE RACK (PIPE : STS304 x 15A)
            </text>

            <rect
              x="110"
              y="55"
              width="310"
              height="85"
              rx="6"
              fill="#0f172a"
              stroke="#a855f7"
              strokeWidth="2.5"
            />
            <text x="265" y="78" fill="#d8b4fe" fontSize="14" fontWeight="bold" textAnchor="middle">
              🏠 H2 저장소 [오토체인지 6번: G-H2 (일반수소 A/B)]
            </text>

            {/* 중단 구역: 오토체인지 (자동절체기 5세트 = 10 실린더, 폭 5,500mm) */}
            <rect
              x="40"
              y="165"
              width="920"
              height="160"
              rx="8"
              fill="#0f172a"
              stroke="#10b981"
              strokeWidth="2"
            />
            <text x="60" y="192" fill="#34d399" fontSize="14" fontWeight="bold">
              🔄 오토체인지 구역 (자동절체기 A/B 매니폴드 5세트 + H2저장소 1세트 = 총 6CH / 12실린더, 5,500mm)
            </text>

            {/* 자동절체기 5세트 실린더 원형 A/B 마크 */}
            {[
              { x: 305, label: "BANK-06 : P-N2 [N2(N5)]" },
              { x: 445, label: "BANK-07 : G-N2 [N2(N35)]" },
              { x: 585, label: "BANK-08 : He(N5)" },
              { x: 725, label: "BANK-09 : Ar(N5)" },
              { x: 865, label: "BANK-10 : O2(N5)" },
            ].map((item, idx) => (
              <g key={idx}>
                <rect
                  x={item.x - 45}
                  y={202}
                  width={90}
                  height={16}
                  rx={3}
                  fill="#1e293b"
                  stroke="#64748b"
                />
                <circle
                  cx={item.x - 28}
                  cy={245}
                  r={22}
                  fill="#090d16"
                  stroke="#334155"
                  strokeWidth="2"
                />
                <circle
                  cx={item.x + 28}
                  cy={245}
                  r={22}
                  fill="#090d16"
                  stroke="#334155"
                  strokeWidth="2"
                />
                <text
                  x={item.x}
                  y={298}
                  fill="#cbd5e1"
                  fontSize="11.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {item.label}
                </text>
              </g>
            ))}

            {/* 하단 구역: 가스저장소 CABINET 5칸 (800 x 550mm x 5칸 = 10 실린더, 폭 7,700mm) */}
            <rect
              x="70"
              y="350"
              width="860"
              height="185"
              rx="8"
              fill="#0f172a"
              stroke="#0ea5e9"
              strokeWidth="2.5"
            />
            <text x="92" y="378" fill="#38bdf8" fontSize="14" fontWeight="bold">
              🗄️ 가스저장소 (CABINET : 방폭 캐비넷 5CH × A/B 2통 = 10실린더, 800×550mm, 총 폭 7,700mm)
            </text>

            {[
              { x: 115, title: "CABINET 1 (BANK-01)", sub: "P-CH4 / CH4(N5)" },
              { x: 265, title: "CABINET 2 (BANK-02)", sub: "G-CH4 / CH4(N35)" },
              { x: 415, title: "CABINET 3 (BANK-03)", sub: "P-H2 / H2(N5)" },
              { x: 565, title: "CABINET 4 (BANK-04)", sub: "MIX (Ar + H2)" },
              { x: 715, title: "CABINET 5 (BANK-05)", sub: "C2H2 (N5)" },
            ].map((cab, idx) => (
              <g key={idx}>
                <rect
                  x={cab.x}
                  y={392}
                  width={145}
                  height={120}
                  rx={6}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="2"
                />
                <text
                  x={cab.x + 72}
                  y={412}
                  fill="#fde047"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {cab.title}
                </text>
                <text
                  x={cab.x + 72}
                  y={498}
                  fill="#e2e8f0"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {cab.sub}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* 22채널 드래그 앤 드롭 핀 렌더링 */}
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
              className={`absolute z-10 cursor-pointer rounded-xl border-2 px-2 py-1 shadow-xl transition-transform hover:scale-110 ${pinBg}`}
            >
              <div className="flex items-center gap-1 text-[10px] font-black leading-none">
                <span>CH{String(ch.id).padStart(2, "0")}[{ch.side}]</span>
              </div>
              <div className="text-[9px] font-extrabold opacity-90 leading-tight">
                {ch.gasCode}
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-black">
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

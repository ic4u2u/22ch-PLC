"use client";

/**
 * 파일명: src/components/dashboard/LeakTestTab.tsx
 * 역할: [탭 3] 🧪 배관 기밀/누출 시험 (Leak Test)
 *  - 30초 / 60초 / 3분(180초) 동안 미세 압력 강하(ΔP) 실시간 계측
 *  - 허용치(0.2 bar) 기준 PASS / FAIL 자동 판정 및 SQLite 성적서 영구 저장
 */

import React, { useState, useEffect } from "react";
import { ChannelData, LeakTestLogItem, downloadUtf8BomCsv } from "./types";

interface LeakTestTabProps {
  channels: ChannelData[];
  leakLogs: LeakTestLogItem[];
  onSaveLeakTest: (record: {
    channelId: number;
    gasName: string;
    durationSec: number;
    startPressure: number;
    endPressure: number;
    deltaPressure: number;
    thresholdBar: number;
    result: "PASS" | "FAIL";
    inspector: string;
  }) => void;
}

export default function LeakTestTab({
  channels,
  leakLogs,
  onSaveLeakTest,
}: LeakTestTabProps) {
  const [selectedChId, setSelectedChId] = useState<number>(2); // 기본 짝수 대기 채널(CH02) 추천
  const [durationSec, setDurationSec] = useState<30 | 60 | 180>(30);
  const [inspector, setInspector] = useState("안전관리자");
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startBar, setStartBar] = useState(0);
  const [lastResult, setLastResult] = useState<{
    result: "PASS" | "FAIL";
    delta: number;
    start: number;
    end: number;
  } | null>(null);

  const targetChannel = channels.find((c) => c.id === selectedChId) || channels[0];
  const currentBar = targetChannel ? targetChannel.pressureBar : 0;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= durationSec) {
          clearInterval(timer);
          setRunning(false);
          const endP = Number(currentBar.toFixed(1));
          const delta = Number(Math.abs(startBar - endP).toFixed(2));
          const verdict: "PASS" | "FAIL" = delta <= 0.2 ? "PASS" : "FAIL";
          setLastResult({ result: verdict, delta, start: startBar, end: endP });
          onSaveLeakTest({
            channelId: selectedChId,
            gasName: targetChannel?.gasName || "특수가스",
            durationSec,
            startPressure: startBar,
            endPressure: endP,
            deltaPressure: delta,
            thresholdBar: 0.2,
            result: verdict,
            inspector: inspector || "ADMIN",
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, durationSec, currentBar, startBar, selectedChId, targetChannel, inspector, onSaveLeakTest]);

  const startTest = () => {
    if (!targetChannel) return;
    setStartBar(Number(targetChannel.pressureBar.toFixed(1)));
    setElapsedSec(0);
    setLastResult(null);
    setRunning(true);
  };

  const liveDelta = running ? Number(Math.abs(startBar - currentBar).toFixed(2)) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 좌측: 기밀 시험 컨트롤 패널 */}
      <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-base font-extrabold text-cyan-300">
          🧪 배관 기밀/누출 시험 (Leak Test) 계측기
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          선택한 채널의 압력 강하량(ΔP)을 정밀 계측하여 허용 기준(<strong>0.2 bar 이하</strong>) 만족 시 PASS 판정 및 성적서를 자동 발행합니다.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300">1. 시험 대상 채널 선택</label>
            <select
              disabled={running}
              value={selectedChId}
              onChange={(e) => setSelectedChId(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-bold text-white"
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} - {ch.gasName} (현재 {ch.pressureBar.toFixed(1)} bar)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300">
              2. 기밀 시험 계측 시간 선택 (30초 / 60초 / 3분)
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {[
                { sec: 30, label: "30초 (신속 점검)" },
                { sec: 60, label: "60초 (표준 점검)" },
                { sec: 180, label: "3분 (정밀 기밀)" },
              ].map((opt) => (
                <button
                  key={opt.sec}
                  type="button"
                  disabled={running}
                  onClick={() => setDurationSec(opt.sec as 30 | 60 | 180)}
                  className={`min-h-[44px] rounded-xl text-xs font-extrabold transition-all ${
                    durationSec === opt.sec
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300">3. 점검자 성명</label>
            <input
              type="text"
              disabled={running}
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          {/* 실시간 진행 상태 표시 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>시험 진행률 ({elapsedSec}초 / {durationSec}초)</span>
              <span>허용 기준: ΔP ≤ 0.2 bar</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${Math.min(100, (elapsedSec / durationSec) * 100)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono">
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[10px] text-slate-400">시작 압력</div>
                <div className="text-base font-bold text-white">
                  {running ? startBar.toFixed(1) : currentBar.toFixed(1)} b
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[10px] text-slate-400">현재 압력</div>
                <div className="text-base font-bold text-cyan-300">
                  {currentBar.toFixed(1)} b
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[10px] text-slate-400">실시간 ΔP</div>
                <div
                  className={`text-base font-black ${
                    liveDelta > 0.2 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {liveDelta.toFixed(2)} b
                </div>
              </div>
            </div>
          </div>

          {!running ? (
            <button
              type="button"
              onClick={startTest}
              className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-black text-white shadow-lg hover:opacity-95"
            >
              🚀 배관 기밀 시험 시작 ({durationSec}초 계측)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRunning(false)}
              className="min-h-[48px] w-full rounded-xl bg-rose-600 text-sm font-black text-white"
            >
              ⏹️ 기밀 시험 강제 중지 ({durationSec - elapsedSec}초 남음)
            </button>
          )}

          {lastResult && (
            <div
              className={`rounded-xl border p-4 text-center ${
                lastResult.result === "PASS"
                  ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-200"
                  : "border-rose-500/60 bg-rose-950/30 text-rose-200"
              }`}
            >
              <div className="text-lg font-black">
                {lastResult.result === "PASS"
                  ? "✅ 기밀 시험 합격 (PASS)"
                  : "🚨 기밀 시험 불합격 (FAIL - 누출 의심)"}
              </div>
              <div className="mt-1 text-xs">
                시작 {lastResult.start} bar → 종료 {lastResult.end} bar (강하량 ΔP ={" "}
                <strong>{lastResult.delta} bar</strong> / 허용치 0.2 bar)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 우측: 영구 저장된 기밀 시험 성적서 목록 */}
      <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-white">
              📜 배관 기밀 시험(PASS/FAIL) 공식 성적서 이력
            </h3>
            <p className="text-xs text-slate-400">
              SQLite <code className="text-cyan-300">leak_test_logs</code> 테이블에 영구 보존된 성적서 내역입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadUtf8BomCsv(
                `ACSC_기밀시험성적서_${new Date().toISOString().slice(0, 10)}.csv`,
                ["일시", "채널", "가스명", "시험시간(초)", "시작압력(bar)", "종료압력(bar)", "ΔP(bar)", "허용치(bar)", "판정", "점검자"],
                leakLogs.map((l) => [
                  l.timestamp,
                  `CH-${String(l.channel_id).padStart(2, "0")}`,
                  l.gas_name,
                  l.duration_sec,
                  l.start_pressure,
                  l.end_pressure,
                  l.delta_pressure,
                  l.threshold_bar,
                  l.result,
                  l.inspector,
                ])
              )
            }
            className="min-h-[40px] rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3.5 text-xs font-extrabold text-emerald-300 hover:bg-emerald-500/25"
          >
            📥 성적서 엑셀(CSV) 다운로드
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                <th className="p-2.5">시험 일시</th>
                <th className="p-2.5">채널 / 가스</th>
                <th className="p-2.5">계측시간</th>
                <th className="p-2.5">시작 → 종료</th>
                <th className="p-2.5">강하량(ΔP)</th>
                <th className="p-2.5">판정</th>
                <th className="p-2.5">점검자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leakLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    기밀 시험 성적서 내역이 없습니다. 좌측에서 시험을 시작해 보세요.
                  </td>
                </tr>
              ) : (
                leakLogs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-mono text-slate-300">{log.timestamp}</td>
                    <td className="p-2.5 font-bold text-white">
                      CH-{String(log.channel_id).padStart(2, "0")} ({log.gas_name})
                    </td>
                    <td className="p-2.5 font-mono">{log.duration_sec}초</td>
                    <td className="p-2.5 font-mono">
                      {log.start_pressure} → {log.end_pressure} bar
                    </td>
                    <td className="p-2.5 font-mono font-bold text-cyan-300">
                      {log.delta_pressure} bar
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 font-black ${
                          log.result === "PASS"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/25 text-rose-300"
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-300">{log.inspector}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

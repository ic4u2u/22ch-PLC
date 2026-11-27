"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ChannelData } from "./types";

interface PacketLogItem {
  timestamp: string;
  protocol: string;
  op: string;
  txHex: string;
  txBytes: number;
  rxHex: string;
  rxBytes: number;
  error: string | null;
}

interface PlcDumpResponse {
  plcConnected: boolean;
  protocol: string;
  plcIp: string;
  plcPort: number;
  latencyMs: number;
  lastPollAt: string | null;
  lastError: string | null;
  rawPressures: number[];
  rawValves: number[];
  packetLogs: PacketLogItem[];
  dumpWaitingRx?: boolean;
}

interface PlcDumpTabProps {
  channels: ChannelData[];
  wsConnected?: boolean;
  virtualDataEnabled?: boolean;
  onToggleVirtualData?: () => void;
}

const DEFAULT_XGT_TX_HEX =
  "4C 53 49 53 2D 58 47 54 00 00 00 00 A0 33 01 00 18 00 00 00 54 00 14 00 00 00 01 00 06 00 25 4D 42 32 30 30 2C 00";

export default function PlcDumpTab({
  channels,
  wsConnected = false,
  virtualDataEnabled = true,
  onToggleVirtualData,
}: PlcDumpTabProps) {
  const [dump, setDump] = useState<PlcDumpResponse | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [clearedWaiting, setClearedWaiting] = useState(false);
  const [txPendingPacket, setTxPendingPacket] = useState<PacketLogItem | null>(null);
  const [demoRxPacket, setDemoRxPacket] = useState<PacketLogItem | null>(null);
  const [copied, setCopied] = useState(false);
  const requestingRef = React.useRef(false);

  const getBridgeBase = useCallback(() => {
    if (typeof window === "undefined") return "";
    if (window.location.protocol === "https:") return "";
    return `http://${window.location.hostname || "localhost"}:4000`;
  }, []);

  const fetchDump = useCallback(async () => {
    if (requestingRef.current) return;
    const base = getBridgeBase();
    if (!base) {
      setBridgeAvailable(false);
      return;
    }
    try {
      const res = await fetch(`${base}/api/plc-dump`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PlcDumpResponse = await res.json();
      if (!requestingRef.current) {
        setDump(data);
        setBridgeAvailable(true);
      }
    } catch {
      setBridgeAvailable(false);
    }
  }, [getBridgeBase]);

  useEffect(() => {
    fetchDump();
    if (!autoRefresh) return;
    const timer = setInterval(fetchDump, 500);
    return () => clearInterval(timer);
  }, [fetchDump, autoRefresh]);

  const handleToggleAutoRefresh = async () => {
    const nextAutoRefresh = !autoRefresh;
    setAutoRefresh(nextAutoRefresh);
    const base = getBridgeBase();
    if (!base) return;
    try {
      await fetch(`${base}/api/plc-polling-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !nextAutoRefresh }),
      });
    } catch {
      // 브릿지 미연결 시 로컬 UI 상태만 전환
    }
  };

  const buildTxOnlyPacket = useCallback(
    (protocolName: string): PacketLogItem => {
      const isModbus = protocolName.toUpperCase().includes("MODBUS");
      const txHex = isModbus
        ? "00 01 00 00 00 06 01 03 00 00 00 16"
        : DEFAULT_XGT_TX_HEX;
      const txBytes = isModbus ? 12 : 38;
      return {
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
        protocol: protocolName,
        op: "READ %MW100~%MW121 (22W / 44B)",
        txHex,
        txBytes,
        rxHex: "",
        rxBytes: 0,
        error: null,
      };
    },
    []
  );

  const handlePollOnce = async () => {
    const protocolName = dump?.protocol || "XGT";
    // 1) 모든 버퍼 값 클리어 후 TX 버퍼 값 즉시 표시
    requestingRef.current = true;
    setRequesting(true);
    setClearedWaiting(true);
    setDemoRxPacket(null);
    setTxPendingPacket(buildTxOnlyPacket(protocolName));
    setDump((prev) =>
      prev
        ? {
            ...prev,
            lastPollAt: null,
            lastError: null,
            rawPressures: [],
            rawValves: [],
            packetLogs: [],
            dumpWaitingRx: true,
          }
        : null
    );

    const base = getBridgeBase();
    if (!base) {
      // 데모/미리보기 모드(Vercel 등): 가상 데이터가 켜져 있으면 짧은 지연 후 RX 시뮬레이션, 꺼져 있으면 클리어 상태 유지
      setTimeout(() => {
        if (virtualDataEnabled) {
          const dataHex = Array.from({ length: 22 }, (_, i) => {
            const ch = channels[i];
            const raw = ch ? Math.round(ch.pressureBar * 10) : 0;
            const lo = (raw & 0xff).toString(16).toUpperCase().padStart(2, "0");
            const hi = ((raw >> 8) & 0xff).toString(16).toUpperCase().padStart(2, "0");
            return `${lo} ${hi}`;
          }).join(" ");
          setDemoRxPacket({
            timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
            protocol: "XGT (가상 시뮬레이션)",
            op: "READ %MW100~%MW121 (22W / 44B)",
            txHex: DEFAULT_XGT_TX_HEX,
            txBytes: 38,
            rxHex: `4C 53 49 53 2D 58 47 54 00 00 00 00 A0 11 01 00 38 00 00 00 55 00 14 00 00 00 00 00 01 00 2C 00 ${dataHex}`,
            rxBytes: 76,
            error: null,
          });
        } else {
          setDemoRxPacket({
            timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
            protocol: "XGT (브릿지 미연결)",
            op: "READ %MW100~%MW121 (22W / 44B)",
            txHex: DEFAULT_XGT_TX_HEX,
            txBytes: 38,
            rxHex: "",
            rxBytes: 0,
            error:
              "가상 데이터 OFF · 브릿지 미연결 (사내 Wi-Fi에서 http://<미니PC_IP>:3000 접속 시 실제 PLC 수신)",
          });
        }
        setClearedWaiting(false);
        setTxPendingPacket(null);
        setRequesting(false);
        requestingRef.current = false;
      }, 300);
      return;
    }

    try {
      const res = await fetch(`${base}/api/plc-poll-once`, { method: "POST" });
      const data: PlcDumpResponse = await res.json();
      setDump(data);
      setBridgeAvailable(true);
    } catch {
      setBridgeAvailable(false);
    } finally {
      setClearedWaiting(false);
      setTxPendingPacket(null);
      setRequesting(false);
      requestingRef.current = false;
    }
  };

  // 브릿지 미연결(Vercel 데모 등) 시:
  // - 요청 중(클리어 상태)이거나
  // - 브릿지가 빈 버퍼(오류/대기)를 내려줬거나
  // - 브릿지 미연결 상태에서 가상 데이터 OFF인 경우 => 버퍼 클리어(--.-) 상태로 유지
  const isBufferCleared =
    clearedWaiting ||
    Boolean(dump && dump.rawPressures && dump.rawPressures.length === 0) ||
    (!bridgeAvailable && !virtualDataEnabled);

  const words = useMemo(() => {
    if (isBufferCleared) {
      return Array.from({ length: 22 }, (_, i) => ({
        wordNo: i + 1,
        mwAddr: `%MW${100 + i}`,
        modbusOffset: i,
        raw: null as number | null,
        bar: "--.-",
        hex: "----",
        valve: null as number | null,
        gasName: channels[i]?.gasName || `CH${String(i + 1).padStart(2, "0")}`,
      }));
    }
    if (dump && dump.rawPressures && dump.rawPressures.length > 0) {
      return Array.from({ length: 22 }, (_, i) => {
        const raw = Number(dump.rawPressures[i] ?? 0);
        const valve = Number(dump.rawValves?.[i] ?? 0);
        return {
          wordNo: i + 1,
          mwAddr: `%MW${100 + i}`,
          modbusOffset: i,
          raw,
          bar: (raw / 10).toFixed(1),
          hex: `0x${(raw & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`,
          valve,
          gasName: channels[i]?.gasName || `CH${String(i + 1).padStart(2, "0")}`,
        };
      });
    }
    return Array.from({ length: 22 }, (_, i) => {
      const ch = channels[i];
      const raw = ch ? Math.round(ch.pressureBar * 10) : 0;
      const valve = ch?.valveState ?? 0;
      return {
        wordNo: i + 1,
        mwAddr: `%MW${100 + i}`,
        modbusOffset: i,
        raw,
        bar: (raw / 10).toFixed(1),
        hex: `0x${(raw & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`,
        valve,
        gasName: ch?.gasName || `CH${String(i + 1).padStart(2, "0")}`,
      };
    });
  }, [isBufferCleared, dump, channels]);

  const fallbackPacket: PacketLogItem = useMemo(() => {
    if (!virtualDataEnabled) {
      return {
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
        protocol: "XGT (브릿지 미연결)",
        op: "READ %MW100~%MW121 (22W / 44B)",
        txHex: DEFAULT_XGT_TX_HEX,
        txBytes: 38,
        rxHex: "",
        rxBytes: 0,
        error: "가상 데이터 OFF · 브릿지/PLC 미연결 상태 (실측 수신 대기 중)",
      };
    }
    const dataHex = words
      .map((w) => {
        const rawVal = w.raw ?? 0;
        const lo = (rawVal & 0xff).toString(16).toUpperCase().padStart(2, "0");
        const hi = ((rawVal >> 8) & 0xff).toString(16).toUpperCase().padStart(2, "0");
        return `${lo} ${hi}`;
      })
      .join(" ");
    const rx = `4C 53 49 53 2D 58 47 54 00 00 00 00 A0 11 01 00 38 00 00 00 55 00 14 00 00 00 00 00 01 00 2C 00 ${dataHex}`;
    return {
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
      protocol: "XGT (가상 시뮬레이션)",
      op: "READ %MW100~%MW121 (22W / 44B)",
      txHex: DEFAULT_XGT_TX_HEX,
      txBytes: 38,
      rxHex: rx,
      rxBytes: 76,
      error: null,
    };
  }, [words, virtualDataEnabled]);

  const packetLogs = clearedWaiting
    ? txPendingPacket
      ? [txPendingPacket]
      : []
    : dump && dump.packetLogs && dump.packetLogs.length > 0
      ? dump.packetLogs
      : !virtualDataEnabled
        ? demoRxPacket && demoRxPacket.rxBytes === 0
          ? [demoRxPacket]
          : [fallbackPacket]
        : demoRxPacket
          ? [demoRxPacket]
          : [fallbackPacket];
  const latestPkt: PacketLogItem = packetLogs[0] || {
    timestamp: "-",
    protocol: dump?.protocol || "XGT",
    op: "READ %MW100~%MW121 (22W / 44B)",
    txHex: "",
    txBytes: 0,
    rxHex: "",
    rxBytes: 0,
    error: null,
  };

  const handleCopyDump = () => {
    const wordLines = words
      .map((w) =>
        w.raw === null
          ? `Word${w.wordNo} (${w.mwAddr}) = --.- bar (클리어됨 / RX 대기)`
          : `Word${w.wordNo} (${w.mwAddr}) = ${w.bar} bar (원시값: ${w.raw}, 밸브: ${w.valve === 0 ? "OPEN" : "SHUTOFF"})`
      )
      .join("\n");
    const summary = [
      `[ACSC 22CH PLC 통신 덤프] ${latestPkt.timestamp}`,
      `- 상태: ${dump?.plcConnected ? "연결됨" : bridgeAvailable ? "연결 끊김" : "데모 미리보기"} / ${dump?.protocol || "XGT"} (${dump?.plcIp || "192.168.0.50"}:${dump?.plcPort || 2004})`,
      `- 작업: ${latestPkt.op}`,
      `- TX (${latestPkt.txBytes}B): ${latestPkt.txHex}`,
      `- RX (${latestPkt.rxBytes}B): ${latestPkt.rxHex || "(대기 중)"}`,
      latestPkt.error ? `- 오류: ${latestPkt.error}` : "",
      "",
      "[22워드 수신 압력]",
      wordLines,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard?.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5">
      {/* 상단 상태 & 제어 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-cyan-300">
            📡 PLC TX/RX 패킷 덤프 &amp; 22워드 실시간 수신 모니터
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            PC ↔ PLC 간 실제 송수신 HEX 덤프(TX/RX)와 수신된 22개 워드(Word1 ~ Word22) 압력 숫자를 현장에서 즉시 확인합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePollOnce}
            disabled={requesting}
            className="min-h-[38px] rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-all"
          >
            {requesting ? "⏳ 클리어 후 TX 전송 · RX 대기 중..." : "📥 22워드 압력 즉시 요청 (TX)"}
          </button>
          <button
            type="button"
            onClick={handleToggleAutoRefresh}
            className={`min-h-[38px] rounded-xl border px-3 py-2 text-xs font-extrabold transition-all ${
              autoRefresh
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-amber-500/50 bg-amber-500/15 text-amber-300"
            }`}
          >
            {autoRefresh
              ? "⏸️ 0.5초 자동수신 중 (일시정지)"
              : "▶️ 일시정지됨 (단발 TX만 가능 · 클릭 시 재개)"}
          </button>
          {!wsConnected && onToggleVirtualData && (
            <button
              type="button"
              onClick={onToggleVirtualData}
              className={`min-h-[38px] rounded-xl border px-3 py-2 text-xs font-extrabold transition-all ${
                virtualDataEnabled
                  ? "border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                  : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {virtualDataEnabled ? "🧪 가상 데이터: ON (끄기)" : "🚫 가상 데이터: OFF (실측 대기)"}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyDump}
            className="min-h-[38px] rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-3 py-2 text-xs font-extrabold text-indigo-200 hover:bg-indigo-500/25 transition-all"
          >
            {copied ? "✅ 복사 완료!" : "📋 카톡 전달용 덤프 복사"}
          </button>
        </div>
      </div>

      {/* 브릿지 미연결(HTTPS 클라우드 접속 등) 안내 배너 */}
      {!bridgeAvailable && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            virtualDataEnabled
              ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
              : "border-slate-700 bg-slate-950/90 text-slate-300"
          }`}
        >
          {virtualDataEnabled ? (
            <div>
              <span className="font-extrabold text-amber-300">
                ⚠️ 현재 가상 데이터(시뮬레이터) 표시 중:
              </span>{" "}
              HTTPS 클라우드 주소(vercel.app) 또는 브릿지 미연결 상태에서는 실제 PLC와 직접 통신할 수 없어 1초마다 가상 데이터가 변경됩니다.
              가상 데이터를 끄려면 위{" "}
              <button
                type="button"
                onClick={onToggleVirtualData}
                className="mx-1 inline-flex items-center rounded bg-amber-500/30 px-1.5 py-0.5 font-extrabold text-amber-100 underline hover:bg-amber-500/40"
              >
                🧪 가상 데이터: ON (끄기)
              </button>
              버튼을 누르세요. 실제 PLC 수신을 보려면 폰을 현장 Wi-Fi에 연결한 뒤{" "}
              <span className="font-mono font-bold text-cyan-300">http://&lt;미니PC_IP&gt;:3000</span>으로 접속해야 합니다.
            </div>
          ) : (
            <div>
              <span className="font-extrabold text-emerald-300">
                🚫 가상 데이터 OFF (버퍼 클리어 유지):
              </span>{" "}
              가상 시뮬레이션이 꺼져 있어 22워드 버퍼가 임의로 변경되지 않고{" "}
              <span className="font-mono text-slate-100">--.- bar</span> 상태로 유지됩니다.
              실제 현장 PLC 패킷을 수신하려면 현장 Wi-Fi에서{" "}
              <span className="font-mono font-bold text-cyan-300">http://&lt;미니PC_IP&gt;:3000</span>으로 접속하세요.
            </div>
          )}
        </div>
      )}

      {/* 연결 상태 요약 4칸 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-[11px] text-slate-400">PLC 통신 상태</div>
          <div className="mt-1 text-sm font-extrabold">
            {!bridgeAvailable ? (
              virtualDataEnabled ? (
                <span className="text-amber-300">🧪 가상 데이터 모드 (브릿지 미연결)</span>
              ) : (
                <span className="text-slate-300">🚫 가상 OFF · 브릿지 미연결</span>
              )
            ) : dump?.plcConnected ? (
              <span className="text-emerald-400">🟢 연결됨 (정상 수신)</span>
            ) : (
              <span className="text-rose-400">🔴 연결 안 됨</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-[11px] text-slate-400">프로토콜 / 대상 PLC</div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300">
            {dump ? `${dump.protocol} · ${dump.plcIp}:${dump.plcPort}` : "XGT · 192.168.0.50:2004"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-[11px] text-slate-400">응답 지연시간</div>
          <div className="mt-1 font-mono text-sm font-bold text-slate-100">
            {dump ? `${dump.latencyMs} ms` : "-"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-[11px] text-slate-400">마지막 수신 시각</div>
          <div className="mt-1 font-mono text-xs font-semibold text-slate-300">
            {dump?.lastPollAt ? dump.lastPollAt.replace("T", " ").slice(0, 19) : latestPkt.timestamp}
          </div>
        </div>
      </div>

      {dump?.lastError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
          ⚠️ 최근 통신 오류: <span className="font-mono">{dump.lastError}</span>
        </div>
      )}

      {/* 1) RX 22워드 채널별 숫자 표시 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-emerald-300">
            🔢 RX 수신 22워드 (Word 1 ~ Word 22) 채널별 압력 숫자 표시
          </h3>
          <span className="text-[11px] text-slate-400">
            규격: %MW100~%MW121 (22 Words = 44 Bytes) · 실제 압력(bar) = 원시 정수 ÷ 10
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {words.map((w) => (
            <div
              key={w.wordNo}
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-cyan-300">Word {w.wordNo}</span>
                <span className="font-mono text-slate-400">{w.mwAddr}</span>
              </div>
              <div className="mt-1 font-mono text-lg font-black text-white">
                {w.bar} <span className="text-xs font-bold text-slate-400">bar</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                <span>{w.raw === null ? "원시: - (----)" : `원시: ${w.raw} (${w.hex})`}</span>
                <span
                  className={
                    w.valve === null
                      ? "text-slate-500"
                      : w.valve === 0
                        ? "text-emerald-400"
                        : "text-amber-400"
                  }
                >
                  {w.valve === null ? "-" : w.valve === 0 ? "OPEN" : "SHUT"}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-slate-500" title={w.gasName}>
                {w.gasName}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2) 최신 TX / RX HEX 덤프 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold text-cyan-300">
              📤 TX (PC → PLC 요청 패킷) · {latestPkt.txBytes} Bytes
            </span>
            <span className="font-mono text-[11px] text-slate-400">{latestPkt.op}</span>
          </div>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-cyan-200">
            {latestPkt.txHex || "(대기 중)"}
          </pre>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-slate-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-300">
              📥 RX (PLC → PC 응답 패킷) · {latestPkt.rxBytes} Bytes
            </span>
            <span className="font-mono text-[11px] text-slate-400">{latestPkt.timestamp}</span>
          </div>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
            {latestPkt.rxHex ||
              (latestPkt.error
                ? `오류: ${latestPkt.error}`
                : clearedWaiting
                  ? "(PLC RX 응답 대기 중...)"
                  : "(응답 없음)")}
          </pre>
        </div>
      </div>

      {/* 3) 최근 TX/RX 이력 로그 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="mb-2 text-xs font-extrabold text-slate-300">
          📜 최근 TX / RX 패킷 이력 (최대 30건)
        </h3>
        <div className="max-h-48 overflow-auto space-y-1.5 font-mono text-[11px]">
          {packetLogs.slice(0, 15).map((pkt, idx) => (
            <div
              key={`${pkt.timestamp}-${idx}`}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                <span>
                  <span className="text-slate-500">[{pkt.timestamp}]</span>{" "}
                  <span className="font-bold text-cyan-300">{pkt.protocol}</span> · {pkt.op}
                </span>
                <span className={pkt.error ? "text-rose-400" : "text-emerald-400"}>
                  {pkt.error ? `ERR: ${pkt.error}` : `TX ${pkt.txBytes}B / RX ${pkt.rxBytes}B`}
                </span>
              </div>
              <div className="mt-1 truncate text-[10px] text-slate-400">
                TX: {pkt.txHex}
              </div>
              {pkt.rxHex && (
                <div className="truncate text-[10px] text-emerald-300/80">
                  RX: {pkt.rxHex}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * 파일명: src/components/dashboard/mockPreset.ts
 * 역할: 브릿지 서버 연결 전 또는 오프라인 시연 시 즉시 작동하는 초기 목업(Mock) 프리셋
 */

import { BankConfig, ChannelData, DiagnosticsData } from "./types";

const GAS_PRESET = [
  { name: "H2 (수소)", code: "H2", color: "#ef4444" },
  { name: "SiH4 (모노실란)", code: "SiH4", color: "#f97316" },
  { name: "NH3 (암모니아)", code: "NH3", color: "#eab308" },
  { name: "NF3 (삼불화질소)", code: "NF3", color: "#84cc16" },
  { name: "Cl2 (염소)", code: "Cl2", color: "#10b981" },
  { name: "BCl3 (삼염화붕소)", code: "BCl3", color: "#14b8a6" },
  { name: "CF4 (사불화탄소)", code: "CF4", color: "#06b6d4" },
  { name: "SF6 (육불화황)", code: "SF6", color: "#0ea5e9" },
  { name: "N2O (아산화질소)", code: "N2O", color: "#3b82f6" },
  { name: "PH3 (포스핀)", code: "PH3", color: "#6366f1" },
  { name: "Ar (고순도 아르곤)", code: "Ar", color: "#8b5cf6" },
  { name: "N2 (초고순도 질소)", code: "N2", color: "#ec4899" },
];

export const INITIAL_CHANNELS: ChannelData[] = Array.from({ length: 24 }, (_, idx) => {
  const id = idx + 1;
  const bankIdx = Math.floor(idx / 2);
  const side = idx % 2 === 0 ? "A" : "B";
  const gas = GAS_PRESET[bankIdx];
  const col = idx % 6;
  const row = Math.floor(idx / 6);
  return {
    id,
    bankId: `BANK-${String(bankIdx + 1).padStart(2, "0")}`,
    side,
    name: `CH-${String(id).padStart(2, "0")} [${side}]`,
    gasName: gas.name,
    gasCode: gas.code,
    color: gas.color,
    maxBar: 150.0,
    warnBar: 35.0,
    dangerBar: 15.0,
    calibrationOffset: 0.0,
    pinX: 12 + col * 15,
    pinY: 20 + row * 20,
    rawBar: 120.0,
    pressureBar: 120.0,
    valveState: 0,
    status: "NORMAL",
    faultReason: null,
    dropRateBarPerSec: 0.05,
    remainingText: "약 4시간 30분 남음",
    remainingMinutesTotal: 270,
  };
});

export const INITIAL_BANKS: BankConfig[] = Array.from({ length: 12 }, (_, idx) => {
  const bankNum = idx + 1;
  const gas = GAS_PRESET[idx];
  return {
    id: `BANK-${String(bankNum).padStart(2, "0")}`,
    bankNumber: bankNum,
    gasName: gas.name,
    gasCode: gas.code,
    chA: idx * 2 + 1,
    chB: idx * 2 + 2,
    activeSide: "A",
    mode: 1,
    switchPressureBar: 20.0,
    hysteresisBar: 3.0,
    warnPressureBar: 35.0,
    runTimeSec: 5.0,
    mxFixedSec: 2.5,
    computedAiN: 1.8,
    outputVoltage: 13.5,
    standbyEmptyWarn: false,
    standbyReady: true,
    switchingRemainingSec: null,
  };
});

export const INITIAL_DIAGNOSTICS: DiagnosticsData = {
  serverTime: new Date().toISOString(),
  lanInterfaces: [{ interface: "Ethernet (LAN 2)", address: "192.168.0.100", netmask: "255.255.255.0" }],
  primaryLanIp: "192.168.0.100",
  plcConnected: false,
  protocol: "MODBUS",
  plcIp: "127.0.0.1",
  plcPort: 8502,
  latencyMs: 1.2,
  lastPollAt: null,
  lastError: null,
  dbSizeBytes: 65536,
  dbSizeKB: 64.0,
  dbSizeMB: 0.06,
};

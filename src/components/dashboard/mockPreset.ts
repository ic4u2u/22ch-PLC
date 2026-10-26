/**
 * 파일명: src/components/dashboard/mockPreset.ts
 * 역할: 브릿지 서버 연결 전 또는 Vercel 클라우드 시연(의뢰자 데모) 시
 *       즉시 살아 움직이는 22채널(11뱅크) 초기 데이터 및 이력 프리셋
 */

import {
  AlertItem,
  AuditLogItem,
  BankConfig,
  ChannelData,
  DiagnosticsData,
  HistoryLogItem,
  LeakTestLogItem,
  MonthlySummaryItem,
  ReplacementLogItem,
  TowerLampState,
} from "./types";

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
];

export const INITIAL_CHANNELS: ChannelData[] = Array.from({ length: 22 }, (_, idx) => {
  const id = idx + 1;
  const bankIdx = Math.floor(idx / 2);
  const side = idx % 2 === 0 ? "A" : "B";
  const gas = GAS_PRESET[bankIdx];
  const col = idx % 6;
  const row = Math.floor(idx / 6);
  // 의뢰자 시연 시 다양한 상태가 한눈에 보이도록 초기 압력 구성
  const initBar = id === 1 ? 26.5 : id === 3 ? 33.8 : 120.0;
  const initStatus = id === 3 ? "WARN" : "NORMAL";
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
    rawBar: initBar,
    pressureBar: initBar,
    valveState: 0,
    status: initStatus,
    faultReason: null,
    dropRateBarPerSec: id === 1 ? 1.8 : 0.15,
    remainingText: id === 1 ? "약 0시간 18분 남음" : "약 4시간 30분 남음",
    remainingMinutesTotal: id === 1 ? 18 : 270,
  };
});

export const INITIAL_BANKS: BankConfig[] = Array.from({ length: 11 }, (_, idx) => {
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
  serverTime: "2026-10-26T12:00:00.000Z",
  lanInterfaces: [
    { interface: "LAN 1 (PLC 1:1 직결)", address: "192.168.0.100", netmask: "255.255.255.0" },
    { interface: "LAN 2 (사내 공유기망)", address: "192.168.1.55", netmask: "255.255.255.0" },
  ],
  primaryLanIp: "192.168.0.100",
  plcConnected: true,
  protocol: "MODBUS (XBL-EMTA)",
  plcIp: "192.168.0.50",
  plcPort: 502,
  latencyMs: 1.4,
  lastPollAt: "2026-10-26T12:00:00.000Z",
  lastError: null,
  dbSizeBytes: 184320,
  dbSizeKB: 180.0,
  dbSizeMB: 0.18,
};

export const INITIAL_TOWER_LAMP: TowerLampState = {
  connected: true,
  portPath: "COM3 (USB-Serial CH340)",
  mode: "WARNING",
  red: "OFF",
  yellow: "BLINK",
  green: "OFF",
  buzzer: "OFF",
  buzzerMuted: false,
  testing: false,
  updatedAt: "2026-10-26T12:00:00.000Z",
};

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: "demo-alert-1",
    timestamp: "2026-10-26 10:30:12",
    level: "INFO",
    code: "BANK_SWITCHED",
    bankId: "BANK-01",
    channelId: 2,
    message:
      "BANK-01 (H2 수소) A→B Smart AI 자동 절체 완료 [Smart AI (N=1.6s), 절체압력 19.8 bar, 예비압력 120.0 bar]",
  },
  {
    id: "demo-alert-2",
    timestamp: "2026-10-26 10:25:40",
    level: "FAULT",
    code: "SENSOR_FAULT",
    channelId: 22,
    message:
      "[자가진단] CH-22 (Ar 고순도 아르곤) 4~20mA 루프 스파이크 감지 -> 밸브 오차단 방지 보호 동작",
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 1,
    timestamp: "2026-10-26 10:30:12",
    actor: "SMART-AI",
    action_type: "AUTO_SWITCH",
    target: "BANK-01",
    detail: "BANK-01 (H2 수소) Smart AI 최적 지연(N=1.6s) 후 예비 실린더 자동 절체 완료",
  },
  {
    id: 2,
    timestamp: "2026-10-26 10:15:00",
    actor: "ADMIN",
    action_type: "ZERO_CALIBRATION",
    target: "CH-05",
    detail: "[0점(Zero) 설정 실행] 배관 잔류압 제거 상태에서 영점 보정 적용 (offset=0.0 bar)",
  },
  {
    id: 3,
    timestamp: "2026-10-26 09:00:05",
    actor: "SCHEDULER",
    action_type: "DB_BACKUP",
    target: "SQLITE_WAL",
    detail: "24시간 주기 무중단 온라인 DB 백업 완료 (acsc_history_backup.db)",
  },
];

export const INITIAL_REPLACEMENTS: ReplacementLogItem[] = [
  {
    id: 1,
    timestamp: "2026-10-26 09:42:10",
    year_month: "2026-10",
    channel_id: 1,
    gas_name: "H2 (수소)",
    prev_pressure: 7.0,
    new_pressure: 150.0,
    delta_pressure: 143.0,
  },
  {
    id: 2,
    timestamp: "2026-10-25 16:18:22",
    year_month: "2026-10",
    channel_id: 3,
    gas_name: "SiH4 (모노실란)",
    prev_pressure: 8.5,
    new_pressure: 149.2,
    delta_pressure: 140.7,
  },
];

export const INITIAL_MONTHLY_SUMMARY: MonthlySummaryItem[] = [
  { year_month: "2026-10", gas_name: "H2 (수소)", replace_count: 4, total_consumed_bar: 568.5 },
  { year_month: "2026-10", gas_name: "SiH4 (모노실란)", replace_count: 3, total_consumed_bar: 421.0 },
  { year_month: "2026-10", gas_name: "NH3 (암모니아)", replace_count: 2, total_consumed_bar: 284.2 },
];

export const INITIAL_LEAK_LOGS: LeakTestLogItem[] = [
  {
    id: 1,
    timestamp: "2026-10-26 09:20:00",
    channel_id: 2,
    gas_name: "H2 (수소)",
    duration_sec: 60,
    start_pressure: 120.0,
    end_pressure: 119.9,
    delta_pressure: 0.1,
    threshold_bar: 0.2,
    result: "PASS",
    inspector: "안전관리자",
  },
  {
    id: 2,
    timestamp: "2026-10-25 14:10:00",
    channel_id: 4,
    gas_name: "SiH4 (모노실란)",
    duration_sec: 180,
    start_pressure: 120.0,
    end_pressure: 119.95,
    delta_pressure: 0.05,
    threshold_bar: 0.2,
    result: "PASS",
    inspector: "안전관리자",
  },
];

export const INITIAL_HISTORY_LOGS: HistoryLogItem[] = Array.from({ length: 12 }, (_, i) => {
  const pressures = Array.from({ length: 22 }, (__, chIdx) =>
    chIdx % 2 === 0 ? Number((125 - i * 1.5 - chIdx * 0.3).toFixed(1)) : 120.0
  );
  const valves = Array.from({ length: 22 }, () => 0);
  return {
    id: i + 1,
    timestamp: `2026-10-26 10:${String(10 + i * 2).padStart(2, "0")}:00`,
    pressures_json: JSON.stringify(pressures),
    valves_json: JSON.stringify(valves),
  };
});

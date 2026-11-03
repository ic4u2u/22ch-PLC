/**
 * 파일명: src/components/dashboard/mockPreset.ts
 * 역할: 브릿지 서버 연결 전 또는 Vercel 클라우드 시연(의뢰자 데모) 시
 *       즉시 살아 움직이는 22채널(11뱅크) 초기 데이터 및 이력 프리셋
 *       (현장 도면 반영: 가스캐비넷 5뱅크[10통] + 오토체인지 6뱅크[12통] = 총 11뱅크/22실린더)
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

// 현장 실제 도면 & 한원케미칼 사양 반영 (P=Pure N5 99.999%, G=General N35 99.95%)
export const GAS_PRESET = [
  // [구역 1] 하단 가스저장소 (CABINET 5CH = 10 실린더)
  {
    name: "P-CH4 [CH4(N5)] 고순도메탄",
    code: "P-CH4(N5)",
    color: "#ef4444",
    pinAX: 15,
    pinAY: 78,
    pinBX: 22,
    pinBY: 78,
  },
  {
    name: "G-CH4 [CH4(N35)] 일반메탄",
    code: "G-CH4(N35)",
    color: "#f97316",
    pinAX: 30,
    pinAY: 78,
    pinBX: 37,
    pinBY: 78,
  },
  {
    name: "P-H2 [H2(N5)] 고순도수소",
    code: "P-H2(N5)",
    color: "#eab308",
    pinAX: 45,
    pinAY: 78,
    pinBX: 52,
    pinBY: 78,
  },
  {
    name: "MIX(Ar+H2) 혼합가스",
    code: "MIX(Ar+H2)",
    color: "#84cc16",
    pinAX: 60,
    pinAY: 78,
    pinBX: 67,
    pinBY: 78,
  },
  {
    name: "C2H2 [C2H2(N5)] 아세틸렌",
    code: "C2H2(N5)",
    color: "#ec4899",
    pinAX: 75,
    pinAY: 78,
    pinBX: 82,
    pinBY: 78,
  },
  // [구역 2] 상단 벽면 오토체인지 (자동절체기 5세트 = 10 실린더)
  {
    name: "P-N2 [N2(N5)] 고순도질소",
    code: "P-N2(N5)",
    color: "#10b981",
    pinAX: 27,
    pinAY: 43,
    pinBX: 34,
    pinBY: 43,
  },
  {
    name: "G-N2 [N2(N35)] 일반질소",
    code: "G-N2(N35)",
    color: "#14b8a6",
    pinAX: 41,
    pinAY: 43,
    pinBX: 48,
    pinBY: 43,
  },
  {
    name: "He [He(N5)] 고순도헬륨",
    code: "He(N5)",
    color: "#06b6d4",
    pinAX: 55,
    pinAY: 43,
    pinBX: 62,
    pinBY: 43,
  },
  {
    name: "Ar [Ar(N5)] 고순도아르곤",
    code: "Ar(N5)",
    color: "#3b82f6",
    pinAX: 69,
    pinAY: 43,
    pinBX: 76,
    pinBY: 43,
  },
  {
    name: "O2 [O2(N5)] 고순도산소",
    code: "O2(N5)",
    color: "#6366f1",
    pinAX: 83,
    pinAY: 43,
    pinBX: 90,
    pinBY: 43,
  },
  // [구역 3] 좌상단 별도 H2 저장소 (오토체인지 6번째 세트 = 2 실린더)
  {
    name: "G-H2 [H2(N35)] 일반수소",
    code: "G-H2(N35)",
    color: "#a855f7",
    pinAX: 20,
    pinAY: 16,
    pinBX: 30,
    pinBY: 16,
  },
];

export const INITIAL_CHANNELS: ChannelData[] = Array.from({ length: 22 }, (_, idx) => {
  const id = idx + 1;
  const bankIdx = Math.floor(idx / 2);
  const side = idx % 2 === 0 ? "A" : "B";
  const gas = GAS_PRESET[bankIdx];
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
    pinX: side === "A" ? gas.pinAX : gas.pinBX,
    pinY: side === "A" ? gas.pinAY : gas.pinBY,
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
  serverTime: "2026-11-03T12:00:00.000Z",
  lanInterfaces: [
    { interface: "LAN 1 (PLC 1:1 직결)", address: "192.168.0.100", netmask: "255.255.255.0" },
    { interface: "LAN 2 (사내 공유기망)", address: "192.168.1.55", netmask: "255.255.255.0" },
  ],
  primaryLanIp: "192.168.0.100",
  plcConnected: true,
  protocol: "MODBUS (XBC-DR30SU + XBL-EMTA)",
  plcIp: "192.168.0.50",
  plcPort: 502,
  latencyMs: 1.4,
  lastPollAt: "2026-11-03T12:00:00.000Z",
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
  updatedAt: "2026-11-03T12:00:00.000Z",
};

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: "demo-alert-1",
    timestamp: "2026-11-03 10:30:12",
    level: "INFO",
    code: "BANK_SWITCHED",
    bankId: "BANK-01",
    channelId: 2,
    message:
      "BANK-01 (P-CH4 [CH4(N5)] 고순도메탄) A→B Smart AI 자동 절체 완료 [Smart AI (N=1.6s), 절체압력 19.8 bar, 예비압력 120.0 bar]",
  },
  {
    id: "demo-alert-2",
    timestamp: "2026-11-03 10:25:40",
    level: "FAULT",
    code: "SENSOR_FAULT",
    channelId: 22,
    message:
      "[자가진단] CH-22 (G-H2 [H2(N35)] 일반수소) 4~20mA 루프 스파이크 감지 -> 밸브 오차단 방지 보호 동작",
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 1,
    timestamp: "2026-11-03 10:30:12",
    actor: "SMART-AI",
    action_type: "AUTO_SWITCH",
    target: "BANK-01",
    detail: "BANK-01 (P-CH4 [CH4(N5)]) Smart AI 최적 지연(N=1.6s) 후 예비 실린더 자동 절체 완료",
  },
  {
    id: 2,
    timestamp: "2026-11-03 10:15:00",
    actor: "ADMIN",
    action_type: "ZERO_CALIBRATION",
    target: "CH-05",
    detail: "[0점(Zero) 설정 실행] P-H2 [H2(N5)] 배관 잔류압 제거 상태에서 영점 보정 적용 (offset=0.0 bar)",
  },
  {
    id: 3,
    timestamp: "2026-11-03 09:00:05",
    actor: "SCHEDULER",
    action_type: "DB_BACKUP",
    target: "SQLITE_WAL",
    detail: "24시간 주기 무중단 온라인 DB 백업 완료 (acsc_history_backup.db)",
  },
];

export const INITIAL_REPLACEMENTS: ReplacementLogItem[] = [
  {
    id: 1,
    timestamp: "2026-11-03 09:42:10",
    year_month: "2026-11",
    channel_id: 1,
    gas_name: "P-CH4 [CH4(N5)] 고순도메탄",
    prev_pressure: 7.0,
    new_pressure: 150.0,
    delta_pressure: 143.0,
  },
  {
    id: 2,
    timestamp: "2026-11-02 16:18:22",
    year_month: "2026-11",
    channel_id: 11,
    gas_name: "P-N2 [N2(N5)] 고순도질소",
    prev_pressure: 8.5,
    new_pressure: 149.2,
    delta_pressure: 140.7,
  },
];

export const INITIAL_MONTHLY_SUMMARY: MonthlySummaryItem[] = [
  { year_month: "2026-11", gas_name: "P-CH4 [CH4(N5)] 고순도메탄", replace_count: 4, total_consumed_bar: 568.5 },
  { year_month: "2026-11", gas_name: "P-N2 [N2(N5)] 고순도질소", replace_count: 3, total_consumed_bar: 421.0 },
  { year_month: "2026-11", gas_name: "P-H2 [H2(N5)] 고순도수소", replace_count: 2, total_consumed_bar: 284.2 },
];

export const INITIAL_LEAK_LOGS: LeakTestLogItem[] = [
  {
    id: 1,
    timestamp: "2026-11-03 09:20:00",
    channel_id: 2,
    gas_name: "P-CH4 [CH4(N5)] 고순도메탄",
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
    timestamp: "2026-11-02 14:10:00",
    channel_id: 5,
    gas_name: "P-H2 [H2(N5)] 고순도수소",
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
    timestamp: `2026-11-03 10:${String(10 + i * 2).padStart(2, "0")}:00`,
    pressures_json: JSON.stringify(pressures),
    valves_json: JSON.stringify(valves),
  };
});

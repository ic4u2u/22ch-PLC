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

// 현장 실제 도면 & 한원케미칼 사양 반영 (줄바꿈이 절대 일어나지 않는 간결한 한글 표준 가스명)
export const GAS_PRESET = [
  // [제1구역] 가스캐비닛 1~5호 (5뱅크 = 10실린더)
  {
    name: "고순도메탄 (P-CH4)",
    code: "P-CH4",
    color: "#ef4444",
    pinAX: 15,
    pinAY: 78,
    pinBX: 22,
    pinBY: 78,
  },
  {
    name: "일반메탄 (G-CH4)",
    code: "G-CH4",
    color: "#f97316",
    pinAX: 30,
    pinAY: 78,
    pinBX: 37,
    pinBY: 78,
  },
  {
    name: "고순도수소 (P-H2)",
    code: "P-H2",
    color: "#eab308",
    pinAX: 45,
    pinAY: 78,
    pinBX: 52,
    pinBY: 78,
  },
  {
    name: "혼합가스 (Ar+H2)",
    code: "Ar+H2",
    color: "#84cc16",
    pinAX: 60,
    pinAY: 78,
    pinBX: 67,
    pinBY: 78,
  },
  {
    name: "아세틸렌 (C2H2)",
    code: "C2H2",
    color: "#ec4899",
    pinAX: 75,
    pinAY: 78,
    pinBX: 82,
    pinBY: 78,
  },
  // [제2구역] 오토체인지 1~5호 (5뱅크 = 10실린더)
  {
    name: "고순도질소 (P-N2)",
    code: "P-N2",
    color: "#10b981",
    pinAX: 27,
    pinAY: 43,
    pinBX: 34,
    pinBY: 43,
  },
  {
    name: "일반질소 (G-N2)",
    code: "G-N2",
    color: "#14b8a6",
    pinAX: 41,
    pinAY: 43,
    pinBX: 48,
    pinBY: 43,
  },
  {
    name: "고순도헬륨 (He)",
    code: "He",
    color: "#06b6d4",
    pinAX: 55,
    pinAY: 43,
    pinBX: 62,
    pinBY: 43,
  },
  {
    name: "고순도아르곤 (Ar)",
    code: "Ar",
    color: "#3b82f6",
    pinAX: 69,
    pinAY: 43,
    pinBX: 76,
    pinBY: 43,
  },
  {
    name: "고순도산소 (O2)",
    code: "O2",
    color: "#6366f1",
    pinAX: 83,
    pinAY: 43,
    pinBX: 90,
    pinBY: 43,
  },
  // [제3구역] 수소저장소 오토체인지 6호 (1뱅크 = 2실린더)
  {
    name: "일반수소 (G-H2)",
    code: "G-H2",
    color: "#a855f7",
    pinAX: 20,
    pinAY: 16,
    pinBX: 30,
    pinBY: 16,
  },
];

// 뱅크별 초기 주공급(OPEN) 방향 설정 (대부분 A통 OPEN / B통 CLOSE 대기, 4번·9번 뱅크는 B통 OPEN / A통 CLOSE 대기)
const INITIAL_ACTIVE_SIDE_BY_BANK: ("A" | "B")[] = [
  "A", // BANK-01: P-CH4 (A통 OPEN 22.5bar -> 곧 15bar 도달 시 B통으로 자동절체 시연!)
  "A", // BANK-02: G-CH4 (A통 OPEN 33.8bar WARN / B통 CLOSE 148bar 대기)
  "A", // BANK-03: P-H2
  "B", // BANK-04: MIX(Ar+H2) (B통이 현재 OPEN 공급중, A통은 CLOSE 만충 대기)
  "A", // BANK-05: C2H2
  "A", // BANK-06: P-N2
  "A", // BANK-07: G-N2
  "A", // BANK-08: He
  "B", // BANK-09: Ar (B통이 현재 OPEN 공급중, A통은 CLOSE 만충 대기)
  "A", // BANK-10: O2
  "A", // BANK-11: G-H2 (A통 OPEN 공급중, B통(CH-22) CLOSE 대기)
];

export const INITIAL_CHANNELS: ChannelData[] = Array.from({ length: 22 }, (_, idx) => {
  const id = idx + 1;
  const bankIdx = Math.floor(idx / 2);
  const side: "A" | "B" = idx % 2 === 0 ? "A" : "B";
  const gas = GAS_PRESET[bankIdx];
  const activeSide = INITIAL_ACTIVE_SIDE_BY_BANK[bankIdx] || "A";
  const isOpenSide = side === activeSide;
  const isAcetylene = bankIdx === 4; // 5번 캐비넷: C2H2(아세틸렌) 용해가스 (만충 25.0 bar)

  const maxBar = isAcetylene ? 25.0 : 150.0;
  const warnBar = isAcetylene ? 6.0 : 35.0;
  const dangerBar = isAcetylene ? 2.5 : 15.0;

  // 실제 오토체인지 현장처럼:
  // - OPEN(주공급) 통은 사용 중이므로 잔량이 감소 중
  // - CLOSE(예비대기) 통은 밸브만 닫혀 있고 통 내부에는 만충 압력(148bar / C2H2는 24bar)이 대기 중!
  let initBar = isAcetylene
    ? isOpenSide
      ? 18.5
      : 24.0
    : isOpenSide
    ? 112.0
    : 148.0;

  if (id === 1) initBar = 22.5; // CH-01(A): 곧 15bar 이하로 떨어져 B통으로 자동 토글 시연
  else if (id === 3) initBar = 33.8; // CH-03(A): 교체 주의(WARN) 시연
  else if (id === 8) initBar = 96.0; // CH-08(B): MIX B통 공급 중
  else if (id === 18) initBar = 88.5; // CH-18(B): Ar B통 공급 중

  const initStatus: ChannelData["status"] = !isOpenSide
    ? "SHUTOFF"
    : initBar <= dangerBar
    ? "DANGER"
    : initBar <= warnBar
    ? "WARN"
    : "NORMAL";

  return {
    id,
    bankId: `BANK-${String(bankIdx + 1).padStart(2, "0")}`,
    side,
    name: `${side}실린더 [CH-${String(id).padStart(2, "0")}]`,
    gasName: gas.name,
    gasCode: gas.code,
    color: gas.color,
    maxBar,
    warnBar,
    dangerBar,
    calibrationOffset: 0.0,
    pinX: side === "A" ? gas.pinAX : gas.pinBX,
    pinY: side === "A" ? gas.pinAY : gas.pinBY,
    rawBar: initBar,
    pressureBar: initBar,
    valveState: isOpenSide ? 0 : 1, // 0: OPEN(공급중), 1: CLOSE(예비대기)
    status: initStatus,
    faultReason: null,
    dropRateBarPerSec: isOpenSide
      ? id === 1
        ? 1.4
        : isAcetylene
        ? 0.04
        : 0.15
      : 0.0,
    remainingText: !isOpenSide
      ? `만충 ${initBar}b · 기밀정상`
      : id === 1
      ? "예상절체 17:15 (절체임박)"
      : "예상절체 21:40 (±15분)",
    remainingMinutesTotal: isOpenSide ? (id === 1 ? 12 : 270) : 480,
  };
});

export const INITIAL_BANKS: BankConfig[] = Array.from({ length: 11 }, (_, idx) => {
  const bankNum = idx + 1;
  const gas = GAS_PRESET[idx];
  const activeSide = INITIAL_ACTIVE_SIDE_BY_BANK[idx] || "A";
  const isAcetylene = idx === 4;
  return {
    id: `BANK-${String(bankNum).padStart(2, "0")}`,
    bankNumber: bankNum,
    gasName: gas.name,
    gasCode: gas.code,
    chA: idx * 2 + 1,
    chB: idx * 2 + 2,
    activeSide,
    mode: 1,
    switchPressureBar: isAcetylene ? 2.5 : 15.0,
    hysteresisBar: isAcetylene ? 0.5 : 3.0,
    warnPressureBar: isAcetylene ? 6.0 : 35.0,
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

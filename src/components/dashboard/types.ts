/**
 * 파일명: src/components/dashboard/types.ts
 * 역할: ACSC 24채널 특수가스 관제 시스템 공통 타입 정의, 단위 변환기, 음성/비프음 및 CSV 유틸리티
 */

export type PressureUnit = 0 | 1 | 2 | 3; // 0: PSI, 1: Bar(기본), 2: MPa, 3: %

export interface ChannelData {
  id: number;
  bankId: string;
  side: "A" | "B";
  name: string;
  gasName: string;
  gasCode: string;
  color: string;
  maxBar: number;
  warnBar: number;
  dangerBar: number;
  calibrationOffset: number;
  pinX: number;
  pinY: number;
  rawBar: number;
  pressureBar: number;
  valveState: number; // 0: OPEN, 1: SHUTOFF
  status: "NORMAL" | "WARN" | "DANGER" | "SHUTOFF" | "SENSOR_FAULT";
  faultReason: string | null;
  dropRateBarPerSec: number;
  remainingText: string;
  remainingMinutesTotal: number;
}

export interface BankConfig {
  id: string;
  bankNumber: number;
  gasName: string;
  gasCode: string;
  chA: number;
  chB: number;
  activeSide: "A" | "B";
  mode: 0 | 1 | 2 | 3; // 0: Auto, 1: Smart AI, 2: Dual, 3: Moni
  switchPressureBar: number;
  hysteresisBar: number;
  warnPressureBar: number;
  runTimeSec: number; // 4.0 ~ 6.0s
  mxFixedSec: number; // Auto 모드 고정 지연시간
  computedAiN: number; // Smart AI 산출 지연시간
  outputVoltage: number; // 12.0 ~ 15.0V
  standbyEmptyWarn?: boolean;
  standbyReady?: boolean;
  switchingRemainingSec?: number | null;
}

export interface TowerLampState {
  connected: boolean;
  portPath: string;
  mode: "NORMAL" | "WARNING" | "CRITICAL" | "TEST";
  red: "OFF" | "ON" | "BLINK";
  yellow: "OFF" | "ON" | "BLINK";
  green: "OFF" | "ON" | "BLINK";
  buzzer: "OFF" | "ON";
  buzzerMuted: boolean;
  testing: boolean;
  updatedAt?: string;
}

export interface DiagnosticsData {
  serverTime: string;
  lanInterfaces: { interface: string; address: string; netmask: string }[];
  primaryLanIp: string;
  plcConnected: boolean;
  protocol: string;
  plcIp: string;
  plcPort: number;
  latencyMs: number;
  lastPollAt: string | null;
  lastError: string | null;
  dbSizeBytes: number;
  dbSizeKB: number;
  dbSizeMB: number;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  level: "DANGER" | "WARN" | "INFO" | "FAULT";
  code: string;
  bankId?: string;
  channelId?: number;
  message: string;
}

export interface AuditLogItem {
  id: number;
  timestamp: string;
  actor: string;
  action_type: string;
  target: string;
  detail: string;
}

export interface ReplacementLogItem {
  id: number;
  timestamp: string;
  year_month: string;
  channel_id: number;
  gas_name: string;
  prev_pressure: number;
  new_pressure: number;
  delta_pressure: number;
}

export interface MonthlySummaryItem {
  year_month: string;
  gas_name: string;
  replace_count: number;
  total_consumed_bar: number;
}

export interface LeakTestLogItem {
  id?: number;
  timestamp: string;
  channel_id: number;
  gas_name: string;
  duration_sec: number;
  start_pressure: number;
  end_pressure: number;
  delta_pressure: number;
  threshold_bar: number;
  result: "PASS" | "FAIL";
  inspector: string;
}

export interface HistoryLogItem {
  id: number;
  timestamp: string;
  pressures_json: string;
  valves_json: string;
}

/**
 * 10번 스펙: FND 4단위 원클릭 변환기 (0: PSI, 1: Bar, 2: MPa, 3: %)
 */
export function formatPressureByUnit(
  barValue: number,
  unit: PressureUnit,
  maxBar = 150.0
): string {
  const safeBar = Number(barValue || 0);
  if (unit === 0) {
    // 0: PSI (x 14.5)
    return (safeBar * 14.5).toFixed(0);
  }
  if (unit === 1) {
    // 1: Bar (기본)
    return safeBar.toFixed(1);
  }
  if (unit === 2) {
    // 2: MPa (x 0.1)
    return (safeBar * 0.1).toFixed(2);
  }
  // 3: % (잔량%)
  const pct = Math.max(0, Math.min(100, (safeBar / (maxBar || 150)) * 100));
  return pct.toFixed(0);
}

export function getUnitLabel(unit: PressureUnit): string {
  switch (unit) {
    case 0:
      return "PSI";
    case 1:
      return "Bar";
    case 2:
      return "MPa";
    case 3:
      return "%";
  }
}

/**
 * Web Audio API 경고 비프음 출력
 */
export function playAlarmBeep(type: "DANGER" | "FAULT" = "DANGER") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === "DANGER" ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(type === "DANGER" ? 880 : 620, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // 브라우저 오디오 자동재생 정책 차단 시 무시
  }
}

/**
 * Web Speech API 한국어 TTS 음성 안내
 */
export function speakKoreanAlarm(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = 1.05;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {
    // TTS 미지원 환경 예외 방지
  }
}

/**
 * 엑셀 한글 깨짐 방지 UTF-8 BOM CSV 다운로드 유틸리티
 */
export function downloadUtf8BomCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvBody = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 파일명: src/components/dashboard/types.ts
 * 역할: [특수가스 스마트 관제 시스템] 11뱅크 · 22실린더(CH-01~22) 공통 타입 정의,
 *       표준 용어 포맷터(BANK-01~11, A/B실린더, CH-01~22, GC-01~05, ACM-01~06),
 *       Qwen3-TTS 기반 인간형 한국어 음성 안내 & 소프트 차임벨, CSV 유틸리티
 */

export type PressureUnit = 0 | 1 | 2 | 3; // 0: PSI, 1: Bar(기본), 2: MPa, 3: %

// 상용 버전 정식 출시 전까지 화면 상단에 표시할 최신 업데이트 일시 스탬프
export const APP_UPDATE_STAMP =
  "Beta v1.23 RC · 업데이트: 2026-11-04 12:45 (뱅크 내 중복 호기명 생략 & 가스명 가독성 극대화)";

export type FacilityZone = "CABINET" | "AUTO_CHANGE";

/**
 * 표준 PLC 계측 채널 번호 포맷터 (항상 대문자 CH- + 두 자리 숫자: CH-01 ~ CH-22)
 */
export function formatChannelCode(channelId: number): string {
  return `CH-${String(channelId).padStart(2, "0")}`;
}

/**
 * 표준 한글 뱅크 명칭 포맷터 (1번 뱅크 ~ 11번 뱅크)
 */
export function formatBankCode(bankNumber: number): string {
  return `${bankNumber}번 뱅크`;
}

/**
 * 표준 실린더 + 채널 통합 표기 포맷터 (줄바꿈 방지 한 줄용)
 */
export function formatCylinderLabel(
  side: "A" | "B",
  channelId: number,
  short = false
): string {
  const chCode = formatChannelCode(channelId);
  return short ? `${side}실린더 · ${chCode}` : `${side}실린더 [${chCode}]`;
}

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
 * 뱅크 번호(1~11)로 [가스캐비닛 1~5호] vs [오토체인지 1~6호] 순수 한글 표준 설비 메타데이터 반환
 */
export function getBankFacilityMeta(bankNumber: number) {
  const bankCode = `${bankNumber}번 뱅크`;
  if (bankNumber <= 5) {
    const unitCode = `캐비닛 ${bankNumber}호`;
    const unitName = `가스캐비닛 ${bankNumber}호`;
    return {
      bankCode,
      zone: "CABINET" as FacilityZone,
      zoneName: "제1구역: 가스캐비닛 구역",
      zoneLabel: "가스캐비닛",
      unitCode,
      unitName,
      facilityBadge: `🗄️ ${unitName}`,
      shortBadge: `🗄️ 캐비닛 ${bankNumber}호`,
      subLocation: "제1구역: 가스캐비닛실",
      purityType:
        bankNumber === 2
          ? "일반순도 (99.95%)"
          : bankNumber === 4
          ? "혼합가스 (Ar+H2)"
          : "초고순도 (99.999%)",
    };
  }
  const autoNum = bankNumber - 5;
  const unitCode = `오토 ${autoNum}호`;
  const unitName = `오토체인지 ${autoNum}호`;
  return {
    bankCode,
    zone: "AUTO_CHANGE" as FacilityZone,
    zoneName:
      bankNumber === 11
        ? "제3구역: 수소저장소 구역"
        : "제2구역: 오토체인지 구역",
    zoneLabel: "오토체인지",
    unitCode,
    unitName,
    facilityBadge:
      bankNumber === 11 ? `🏠 수소저장소 (6호)` : `🔄 ${unitName}`,
    shortBadge:
      bankNumber === 11 ? `🏠 수소저장소` : `🔄 오토 ${autoNum}호`,
    subLocation:
      bankNumber === 11
        ? "제3구역: 독립 수소저장소"
        : "제2구역: 벽면 오토체인지실",
    purityType:
      bankNumber === 7 || bankNumber === 11
        ? "일반순도 (99.95%)"
        : "초고순도 (99.999%)",
  };
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
    return (safeBar * 14.5).toFixed(0);
  }
  if (unit === 1) {
    return safeBar.toFixed(1);
  }
  if (unit === 2) {
    return (safeBar * 0.1).toFixed(2);
  }
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
 * [학술 논문 반영] 열역학 압축인자(Z-Factor, Peng-Robinson 상태방정식 근사) 기반 실제 가스 질량 잔량(%) 및 물리 특성 반환
 *  - 메탄(CH4): 150bar에서 Z ≈ 0.82 (과압축 기체 -> 실제 질량 잔량은 단순 압력비보다 높음)
 *  - 수소(H2)·헬륨(He): 150bar에서 Z ≈ 1.09 (비압축성 반발 -> 초반 압력 하강이 빠름)
 *  - 아세틸렌(C2H2): 다공성 물질 내 아세톤 용해 충전 (만충 25.0 bar, 절체 SV 2.5 bar)
 */
export function getGasPhysicsMeta(gasCode: string, pressureBar: number, maxBar = 150.0) {
  const p = Math.max(0, Number(pressureBar || 0));
  const pMax = Math.max(10, Number(maxBar || 150));
  const code = (gasCode || "").toUpperCase();

  let zAtP = 1.0;
  let zAtMax = 1.0;
  let physicsLabel = "압축가스 (Z≈1.00)";

  if (code.includes("C2H2")) {
    // 아세톤 용해 아세틸렌 (25bar 만충 기준)
    zAtP = 1 - 0.004 * p;
    zAtMax = 1 - 0.004 * pMax;
    physicsLabel = "아세톤 용해충전 (Max 25b · Z보정)";
  } else if (code.includes("CH4")) {
    // 메탄: 150bar에서 Z ≈ 0.82
    zAtP = Math.max(0.78, 1 - 0.0012 * p);
    zAtMax = Math.max(0.78, 1 - 0.0012 * pMax);
    physicsLabel = `과압축 기체 (Z=${zAtP.toFixed(2)})`;
  } else if (code.includes("H2") || code.includes("HE")) {
    // 수소·헬륨: 150bar에서 Z ≈ 1.09
    zAtP = 1 + 0.0006 * p;
    zAtMax = 1 + 0.0006 * pMax;
    physicsLabel = `양(+)압축 기체 (Z=${zAtP.toFixed(2)})`;
  } else {
    zAtP = 1 - 0.0001 * p;
    zAtMax = 1 - 0.0001 * pMax;
    physicsLabel = `표준 압축기체 (Z=${zAtP.toFixed(2)})`;
  }

  // 실제 질량 비율 m/m_max = (P / Z(P)) / (P_max / Z(P_max))
  const realMassRatio = (p / zAtP) / (pMax / zAtMax);
  const realMassPct = Math.max(0, Math.min(100, Math.round(realMassRatio * 100)));

  return {
    realMassPct,
    zFactor: Number(zAtP.toFixed(2)),
    physicsLabel,
    isDissolvedAcetylene: code.includes("C2H2"),
  };
}

/**
 * 고급 관제실 소프트 차임벨 (귀에 거슬리는 전자 톱니파 대신 부드러운 2단 화음 차임벨)
 */
export function playAlarmBeep(type: "DANGER" | "FAULT" = "DANGER") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = type === "DANGER" ? [587.33, 880.0] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.16 + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.4);
    });
  } catch {
    // 브라우저 오디오 자동재생 정책 차단 시 무시
  }
}

// 화학식 및 영문 기호를 실제 방송실 아나운서가 발음하듯 자연스러운 한국어 문장으로 변환
export function humanizeKoreanSpeech(raw: string): string {
  return raw
    .replace(/P-CH4\s*\[CH4\(N5\)\]/gi, "고순도 메탄")
    .replace(/G-CH4\s*\[CH4\(N35\)\]/gi, "일반 메탄")
    .replace(/P-H2\s*\[H2\(N5\)\]/gi, "고순도 수소")
    .replace(/G-H2\s*\[H2\(N35\)\]/gi, "일반 수소")
    .replace(/MIX\(Ar\+H2\)/gi, "아르곤 수소 혼합가스")
    .replace(/C2H2\s*\[C2H2\(N5\)\]/gi, "고순도 아세틸렌")
    .replace(/P-N2\s*\[N2\(N5\)\]/gi, "고순도 질소")
    .replace(/G-N2\s*\[N2\(N35\)\]/gi, "일반 질소")
    .replace(/He\s*\[He\(N5\)\]/gi, "고순도 헬륨")
    .replace(/Ar\s*\[Ar\(N5\)\]/gi, "고순도 아르곤")
    .replace(/O2\s*\[O2\(N5\)\]/gi, "고순도 산소")
    .replace(/P-CH4/gi, "고순도 메탄")
    .replace(/G-CH4/gi, "일반 메탄")
    .replace(/P-H2/gi, "고순도 수소")
    .replace(/G-H2/gi, "일반 수소")
    .replace(/P-N2/gi, "고순도 질소")
    .replace(/G-N2/gi, "일반 질소")
    .replace(/C2H2/gi, "아세틸렌")
    .replace(/CH-(\d+)/gi, "$1번 채널")
    .replace(/BANK-(\d+)/gi, "$1번 뱅크")
    .replace(/SENSOR_FAULT/gi, "센서 신호 이상")
    .replace(/4~20mA/gi, "사 에서 이십 밀리암페어")
    .replace(/(\d+)\.(\d+)\s*bar/gi, "$1점 $2 바")
    .replace(/(\d+)\s*bar/gi, "$1 바");
}

let activeTtsAudio: HTMLAudioElement | null = null;

/**
 * Qwen3-TTS (`/api/tts`) 기반 인간형 한국어 아나운서 음성 방송 (폐쇄망 오프라인 시 Natural Neural Voice 자동 폴백)
 */
export function speakKoreanAlarm(text: string, voice: "Cherry" | "Ethan" = "Cherry") {
  if (typeof window === "undefined") return;
  const cleanText = humanizeKoreanSpeech(text);

  try {
    if (activeTtsAudio) {
      activeTtsAudio.pause();
      activeTtsAudio = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const audio = new Audio(
      `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${voice}`
    );
    audio.playbackRate = 1.03;
    activeTtsAudio = audio;

    audio.play().catch(() => {
      // 오프라인 폐쇄망 환경이거나 브라우저 정책으로 실패 시 로컬 신경망(Natural) 한국어 음성 우선 선택
      speakLocalNaturalKorean(cleanText);
    });
  } catch {
    speakLocalNaturalKorean(cleanText);
  }
}

function speakLocalNaturalKorean(cleanText: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = "ko-KR";

    // Edge/Chrome에 내장된 Microsoft SunHi Online (Natural) 또는 Google 한국어 신경망 음성을 최우선 선택
    const voices = window.speechSynthesis.getVoices();
    const naturalKoVoice =
      voices.find(
        (v) =>
          v.lang.includes("ko") &&
          (v.name.includes("Natural") ||
            v.name.includes("SunHi") ||
            v.name.includes("InJoon") ||
            v.name.includes("Google"))
      ) || voices.find((v) => v.lang.includes("ko"));

    if (naturalKoVoice) {
      utter.voice = naturalKoVoice;
    }
    utter.rate = 0.98;
    utter.pitch = 1.02;
    window.speechSynthesis.speak(utter);
  } catch {
    // 무시
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

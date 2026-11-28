/**
 * 파일명: src/components/dashboard/controllerMenuSpec.ts
 * 역할: HANWON chemicals HW-2601A Auto Changeover System Controller
 *       매뉴얼(S-01~S-20 사용자 설정, H-01~H-09 시스템 설정, 에러코드 E-01~E-04) 규격 정의
 */

export type ControllerMenuCategory = "USER" | "SYSTEM";

export interface ControllerOptionItem {
  value: number | string;
  fndLabel: string; // 중앙 FND 또는 우측 FND 표시 문자
  desc: string;
}

export interface ControllerMenuSpec {
  code: string; // 예: "S-01", "H-01"
  category: ControllerMenuCategory;
  title: string; // 한글 항목명
  fndView: string; // 중앙 FND "보기" 기본 표시
  inputType: "select" | "number" | "ip4" | "mac6" | "action";
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: ControllerOptionItem[];
  description: string;
}

/**
 * HW-2601A 에러 코드 표
 */
export const HW2601A_ERROR_CODES = [
  { code: "E-01", desc: "센서 A 측정치가 2mA 이하 (단선 또는 센서 이상)" },
  { code: "E-02", desc: "센서 B 측정치가 2mA 이하 (단선 또는 센서 이상)" },
  { code: "E-03", desc: "밸브 A 동작 시 전류를 소모하지 않음 (코일/결선 단선)" },
  { code: "E-04", desc: "밸브 B 동작 시 전류를 소모하지 않음 (코일/결선 단선)" },
] as const;

/**
 * 사용자 메뉴 [S-01] ~ [S-20]
 */
export const USER_MENU_SPECS: ControllerMenuSpec[] = [
  {
    code: "S-01",
    category: "USER",
    title: "밸브 구성",
    fndView: "A.b.P",
    inputType: "select",
    defaultValue: 3,
    options: [
      { value: 0, fndLabel: "A.b", desc: "A + B" },
      { value: 1, fndLabel: "A", desc: "A 단독" },
      { value: 2, fndLabel: "A.P", desc: "A + Pou" },
      { value: 3, fndLabel: "A.b.P", desc: "A + B + Pou (기본)" },
    ],
    description: "장비에 연결된 밸브 구성을 선택합니다.",
  },
  {
    code: "S-02",
    category: "USER",
    title: "가스통 우선순위",
    fndView: "A-b",
    inputType: "select",
    defaultValue: 0,
    options: [
      { value: 0, fndLabel: "A-b", desc: "A, B 중 압력이 적은 쪽 우선 열림" },
      { value: 1, fndLabel: "A", desc: "A 실린더 우선" },
      { value: 2, fndLabel: "b", desc: "B 실린더 우선" },
    ],
    description: "초기 기동 또는 동일 조건 시 우선 공급할 가스통을 지정합니다.",
  },
  {
    code: "S-03",
    category: "USER",
    title: "A 압력 최대값",
    fndView: "toP.A",
    inputType: "number",
    defaultValue: 160,
    min: 20,
    max: 300,
    step: 1,
    unit: "bar",
    description: "A측 압력 센서의 최대 스케일(만충 기준)을 설정합니다. (20 ~ 300 bar)",
  },
  {
    code: "S-04",
    category: "USER",
    title: "B 압력 최대값",
    fndView: "toP.b",
    inputType: "number",
    defaultValue: 160,
    min: 20,
    max: 300,
    step: 1,
    unit: "bar",
    description: "B측 압력 센서의 최대 스케일(만충 기준)을 설정합니다. (20 ~ 300 bar)",
  },
  {
    code: "S-05",
    category: "USER",
    title: "A 교체 압력값",
    fndView: "CHG.A",
    inputType: "number",
    defaultValue: 7,
    min: 2,
    max: 250,
    step: 1,
    unit: "bar",
    description: "A측이 이 압력 이하로 떨어지면 절체 조건이 됩니다. (2 ~ 250 bar)",
  },
  {
    code: "S-06",
    category: "USER",
    title: "B 교체 압력값",
    fndView: "CHG.b",
    inputType: "number",
    defaultValue: 7,
    min: 2,
    max: 250,
    step: 1,
    unit: "bar",
    description: "B측이 이 압력 이하로 떨어지면 절체 조건이 됩니다. (2 ~ 250 bar)",
  },
  {
    code: "S-07",
    category: "USER",
    title: "Ready 압력값",
    fndView: "rEdY",
    inputType: "number",
    defaultValue: 3,
    min: 1,
    max: 250,
    step: 1,
    unit: "bar",
    description:
      "예비통이 [교체압력 + Ready압력] 이상일 때만 안전하게 절체됩니다. (1 ~ 250 bar)",
  },
  {
    code: "S-08",
    category: "USER",
    title: "알람주기 설정",
    fndView: "oFF",
    inputType: "select",
    defaultValue: 0,
    options: [
      { value: 0, fndLabel: "oFF", desc: "연속 (알람 반복 없음/즉시)" },
      { value: 1, fndLabel: "-01-", desc: "1분 주기" },
      { value: 2, fndLabel: "-15-", desc: "15분 주기" },
      { value: 3, fndLabel: "-30-", desc: "30분 주기" },
      { value: 4, fndLabel: "-60-", desc: "60분 주기" },
    ],
    description: "알람 발생 후 다시 울리는 반복 주기를 설정합니다.",
  },
  {
    code: "S-09",
    category: "USER",
    title: "알람소리 시간 설정",
    fndView: "on",
    inputType: "select",
    defaultValue: 0,
    options: [
      { value: 0, fndLabel: "on", desc: "연속 울림 (버튼 누를 때까지)" },
      { value: 1, fndLabel: "S_15", desc: "15초간 울림" },
      { value: 2, fndLabel: "S_30", desc: "30초간 울림" },
      { value: 3, fndLabel: "S_60", desc: "60초간 울림" },
    ],
    description: "알람 1회 발생 시 부저가 울리는 지속 시간을 설정합니다.",
  },
  {
    code: "S-10",
    category: "USER",
    title: "단위 표시 설정",
    fndView: "bAr",
    inputType: "select",
    defaultValue: 1,
    options: [
      { value: 0, fndLabel: "PSI", desc: "psi" },
      { value: 1, fndLabel: "bAr", desc: "bar (기본)" },
      { value: 2, fndLabel: "nPA", desc: "MPa" },
      { value: 3, fndLabel: "PEr", desc: "퍼센트 (%)" },
    ],
    description: "컨트롤러 FND 및 앱 화면에 표시할 기본 압력 단위를 선택합니다.",
  },
  {
    code: "S-11",
    category: "USER",
    title: "체인지오버 모드",
    fndView: "Auto",
    inputType: "select",
    defaultValue: 0,
    options: [
      { value: 0, fndLabel: "Auto", desc: "[S-05][S-06][S-07] 설정값으로 자동 절체" },
      { value: 1, fndLabel: "AI", desc: "AI 제어 (감압률 기반 지능형 절체)" },
      { value: 2, fndLabel: "duAL", desc: "A, B 동시 오픈 (Dual)" },
      { value: 3, fndLabel: "noni", desc: "모니터 전용 (절체 안 함)" },
    ],
    description: "자동절체기의 운전 방식을 선택합니다.",
  },
  {
    code: "S-12",
    category: "USER",
    title: "12V 전원 설정",
    fndView: "12.01",
    inputType: "number",
    defaultValue: 111,
    min: 0,
    max: 127,
    step: 1,
    unit: "",
    description: "밸브 구동용 12V 전원 디지털 트리밍 값을 설정합니다. (0 ~ 127)",
  },
  {
    code: "S-13",
    category: "USER",
    title: "A 밸브 동작 시간",
    fndView: "on A",
    inputType: "number",
    defaultValue: 5.0,
    min: 4.0,
    max: 8.0,
    step: 0.1,
    unit: "초",
    description: "A 밸브가 완전히 열리고 닫히는 동작 시간을 설정합니다. (4.0 ~ 8.0초)",
  },
  {
    code: "S-14",
    category: "USER",
    title: "B 밸브 동작 시간",
    fndView: "on b",
    inputType: "number",
    defaultValue: 5.0,
    min: 4.0,
    max: 8.0,
    step: 0.1,
    unit: "초",
    description: "B 밸브가 완전히 열리고 닫히는 동작 시간을 설정합니다. (4.0 ~ 8.0초)",
  },
  {
    code: "S-15",
    category: "USER",
    title: "크로스(교차) 지연 시간",
    fndView: "CroS",
    inputType: "number",
    defaultValue: 0.0,
    min: 0.0,
    max: 8.0,
    step: 0.1,
    unit: "초",
    description:
      "A 밸브가 닫히기 시작한 뒤 설정된 시간(초) 후 B 밸브가 열립니다. (0.0 ~ 8.0초)",
  },
  {
    code: "S-16",
    category: "USER",
    title: "밸브 강제 개폐 테스트",
    fndView: "tESt",
    inputType: "select",
    defaultValue: "oFF",
    options: [
      { value: "oFF", fndLabel: "oFF", desc: "A, B 둘 다 닫힘" },
      { value: "on A", fndLabel: "on A", desc: "B 닫히고 A 열림" },
      { value: "on b", fndLabel: "on b", desc: "A 닫히고 B 열림" },
    ],
    description: "유지보수 시 밸브를 강제로 열고 닫아 동작을 테스트합니다.",
  },
  {
    code: "S-17",
    category: "USER",
    title: "S-01 ~ S-15 설정값 저장",
    fndView: "SAUE",
    inputType: "action",
    defaultValue: "no",
    options: [
      { value: "no", fndLabel: "no", desc: "저장 안 함" },
      { value: "YES", fndLabel: "YES", desc: "현재 S-01~S-15 설정을 내부 메모리에 저장" },
    ],
    description: "S-01부터 S-15까지의 사용자 설정값을 영구 저장합니다.",
  },
  {
    code: "S-18",
    category: "USER",
    title: "S-01 ~ S-15 설정값 불러오기",
    fndView: "LOAd",
    inputType: "action",
    defaultValue: "no",
    options: [
      { value: "no", fndLabel: "no", desc: "불러오기 안 함" },
      { value: "YES", fndLabel: "YES", desc: "저장된 S-01~S-15 설정값 불러오기" },
    ],
    description: "S-17로 저장해 둔 S-01~S-15 설정값을 불러와 복원합니다.",
  },
  {
    code: "S-19",
    category: "USER",
    title: "A 압력 0점 설정",
    fndView: "0.0",
    inputType: "number",
    defaultValue: 0,
    min: -100,
    max: 100,
    step: 1,
    unit: "",
    description: "A측 압력 센서의 영점(Zero) 보정값입니다. (-100 ~ 100)",
  },
  {
    code: "S-20",
    category: "USER",
    title: "B 압력 0점 설정",
    fndView: "0.0",
    inputType: "number",
    defaultValue: 0,
    min: -100,
    max: 100,
    step: 1,
    unit: "",
    description: "B측 압력 센서의 영점(Zero) 보정값입니다. (-100 ~ 100)",
  },
];

/**
 * 시스템 설정 메뉴 [H-01] ~ [H-09] (Set 버튼 7초 이상 진입)
 */
export const SYSTEM_MENU_SPECS: ControllerMenuSpec[] = [
  {
    code: "H-01",
    category: "SYSTEM",
    title: "화면 밝기 조절",
    fndView: "brit",
    inputType: "number",
    defaultValue: 3,
    min: 0,
    max: 7,
    step: 1,
    unit: "단계",
    description: "전면 FND 표시창의 밝기를 0~7단계로 조절합니다.",
  },
  {
    code: "H-02",
    category: "SYSTEM",
    title: "IP 주소 설정",
    fndView: "IP 1.",
    inputType: "ip4",
    defaultValue: "192.168.0.200",
    min: 0,
    max: 255,
    description: "컨트롤러 고정 IP 주소를 설정합니다. (각 옥텟 0 ~ 255)",
  },
  {
    code: "H-03",
    category: "SYSTEM",
    title: "서브넷 마스크",
    fndView: "Sub.1.",
    inputType: "ip4",
    defaultValue: "255.255.255.0",
    min: 0,
    max: 255,
    description: "네트워크 서브넷 마스크를 설정합니다. (각 옥텟 0 ~ 255)",
  },
  {
    code: "H-04",
    category: "SYSTEM",
    title: "게이트웨이",
    fndView: "GAt.1.",
    inputType: "ip4",
    defaultValue: "192.168.0.1",
    min: 0,
    max: 255,
    description: "네트워크 기본 게이트웨이 주소를 설정합니다. (각 옥텟 0 ~ 255)",
  },
  {
    code: "H-05",
    category: "SYSTEM",
    title: "DNS 서버",
    fndView: "dnS.1.",
    inputType: "ip4",
    defaultValue: "168.126.63.1",
    min: 0,
    max: 255,
    description: "DNS 서버 주소를 설정합니다. (각 옥텟 0 ~ 255)",
  },
  {
    code: "H-06",
    category: "SYSTEM",
    title: "MAC 어드레스",
    fndView: "nAc.1.",
    inputType: "mac6",
    defaultValue: "00:08:dC:12:34:56",
    description: "이더넷 하드웨어 MAC 주소를 설정합니다. (각 바이트 00 ~ FF)",
  },
  {
    code: "H-07",
    category: "SYSTEM",
    title: "DHCP 설정",
    fndView: "dhcP",
    inputType: "select",
    defaultValue: "no",
    options: [
      { value: "no", fndLabel: "no", desc: "사용 안 함 (고정 IP)" },
      { value: "YES", fndLabel: "YES", desc: "자동 IP 할당 (DHCP 사용)" },
    ],
    description: "자동 IP 할당(DHCP) 사용 여부를 선택합니다.",
  },
  {
    code: "H-08",
    category: "SYSTEM",
    title: "소프트웨어 업데이트",
    fndView: "SoFt",
    inputType: "action",
    defaultValue: "dnLd",
    options: [{ value: "dnLd", fndLabel: "dnLd", desc: "펌웨어 다운로드 모드 (미정)" }],
    description: "컨트롤러 펌웨어 업데이트 기능입니다.",
  },
  {
    code: "H-09",
    category: "SYSTEM",
    title: "공장 초기화",
    fndView: "FACt",
    inputType: "action",
    defaultValue: "no",
    options: [
      { value: "no", fndLabel: "no", desc: "초기화 안 함" },
      { value: "YES", fndLabel: "YES", desc: "모든 설정값 공장 초기화" },
    ],
    description: "컨트롤러의 모든 설정값을 출하 초기값으로 되돌립니다.",
  },
];

export const ALL_CONTROLLER_MENUS: ControllerMenuSpec[] = [
  ...USER_MENU_SPECS,
  ...SYSTEM_MENU_SPECS,
];

/**
 * 단일 컨트롤러(뱅크)의 전체 설정 값 맵
 */
export type ControllerParamValues = Record<string, number | string>;

/**
 * 매뉴얼 기준 초기 설정값 생성기
 */
export function createDefaultControllerParams(): ControllerParamValues {
  const result: ControllerParamValues = {};
  for (const spec of ALL_CONTROLLER_MENUS) {
    result[spec.code] = spec.defaultValue;
  }
  return result;
}

/**
 * 숫자 입력값을 매뉴얼의 min ~ max 범위로 안전하게 보정(Clamp)합니다.
 */
export function clampControllerNumber(
  spec: ControllerMenuSpec,
  rawVal: number
): number {
  const num = Number.isFinite(rawVal) ? rawVal : Number(spec.defaultValue);
  const min = spec.min ?? -Infinity;
  const max = spec.max ?? Infinity;
  const clamped = Math.max(min, Math.min(max, num));
  const step = spec.step ?? 1;
  return step < 1 ? Number(clamped.toFixed(1)) : Math.round(clamped);
}

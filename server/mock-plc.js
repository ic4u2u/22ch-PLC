/**
 * [파일 1] server/mock-plc.js
 * 역할: LS ELECTRIC XGB PLC + XBL-EMTA (Modbus TCP Server) 22채널(11뱅크) 시뮬레이터
 * 주소: 127.0.0.1:8502 (Unit ID: 1)
 *
 * - Offset 0 ~ 21   (%MW100 ~ %MW121): 22채널 1차측 실린더 압력 (스케일: 실제압력 * 10)
 * - Offset 100 ~ 121 (%MW200 ~ %MW221): 22채널 솔레노이드 밸브 제어 (0: OPEN 공급중, 1: SHUTOFF 예비대기)
 * - 아세틸렌(5번 뱅크: CH09, CH10)은 용해가스 안전 규격(만충 24.0 bar) 적용
 * - 안전 인터록 시연 지원: 2번 뱅크 예비통(CH04)은 초기 빈 통(8.0 bar) 상태로 두어 빈 통 절체 차단 검증 지원
 */

const ModbusRTU = require("modbus-serial");

const HOST = process.env.MOCK_PLC_HOST || "127.0.0.1";
const PORT = Number(process.env.PLC_MODBUS_PORT || 8502);
const CHANNEL_COUNT = 22;

const ENABLE_DEMO_FAULTS = process.env.MOCK_DEMO_FAULTS === "1";

// 22채널 내부 압력 배열 (스케일 ×10: 1200 = 120.0 bar, 아세틸렌은 210 = 21.0 bar)
const pressures = Array.from({ length: CHANNEL_COUNT }, (_, idx) => {
  const isAcetylene = idx === 8 || idx === 9; // CH09, CH10 (5번 뱅크 아세틸렌)
  const isPrimaryA = idx % 2 === 0;
  if (ENABLE_DEMO_FAULTS && idx === 3) return 80; // 선택적 인터록 시연 모드일 때만 CH04 빈 통 세팅
  if (isAcetylene) return isPrimaryA ? 210 : 240; // 21.0 bar (공급중) / 24.0 bar (만충대기)
  return isPrimaryA ? 1200 : 1480; // 120.0 bar (공급중) / 148.0 bar (만충대기)
});

// 22채널 밸브 상태 배열 (초기: A통=0 OPEN 공급중, B통=1 SHUTOFF 예비대기)
const valves = Array.from({ length: CHANNEL_COUNT }, (_, idx) => (idx % 2 === 0 ? 0 : 1));

// 빈 통 교체 대기 카운터
const refillWaitTicks = Array.from({ length: CHANNEL_COUNT }, () => 0);

// 22번 채널(addr === 21) 센서 고장(SENSOR_FAULT) 20초 주기 시뮬레이션 상태
let faultMode22 = "NORMAL"; // "NORMAL" | "WIRE_BREAK" (0) | "NOISE_SPIKE" (1950)
let tickCount = 0;

// 1초 주기로 현재 열려 있는(OPEN=0) 주공급 채널만 압력 소모 및 닫힌 빈 통 리필 시뮬레이션
setInterval(() => {
  tickCount += 1;

  for (let i = 0; i < CHANNEL_COUNT; i++) {
    const isAcetylene = i === 8 || i === 9;
    const minRefillTrigger = isAcetylene ? 35 : 180; // 3.5 bar / 18.0 bar 이하 빈 통
    const fullChargeVal = isAcetylene ? 240 : 1480; // 만충 24.0 bar / 148.0 bar

    if (valves[i] === 0) {
      // 현재 공급 중인 열린 통만 완만하게 가스 소모 (정상 상태 오래 유지)
      const dropStep = isAcetylene ? 1 : 2 + (i % 2);
      pressures[i] = Math.max(0, pressures[i] - dropStep);
      refillWaitTicks[i] = 0;
    } else if (!(ENABLE_DEMO_FAULTS && i === 3) && pressures[i] <= minRefillTrigger) {
      // 절체되어 닫힌 빈 통은 작업자 용기 교체 모사를 위해 5초 후 새 만충 용기로 리필
      refillWaitTicks[i] += 1;
      if (refillWaitTicks[i] >= 5) {
        pressures[i] = fullChargeVal;
        refillWaitTicks[i] = 0;
        console.log(
          `[MOCK-PLC] 🔄 CH${String(i + 1).padStart(2, "0")} 새 실린더 교체 시뮬레이션 완료 -> ${(
            fullChargeVal / 10
          ).toFixed(1)} bar 충전`
        );
      }
    }
  }

  // 기본 운영/테스트 시에는 센서 고장 없이 정상 상태 유지 (MOCK_DEMO_FAULTS=1 일 때만 시연)
  if (ENABLE_DEMO_FAULTS) {
    const cycleSec = tickCount % 20;
    if (cycleSec >= 0 && cycleSec < 3) {
      faultMode22 = cycleSec % 2 === 0 ? "WIRE_BREAK" : "NOISE_SPIKE";
    } else {
      faultMode22 = "NORMAL";
    }
  } else {
    faultMode22 = "NORMAL";
  }
}, 1000);

// Modbus TCP Server Vector 정의
const vector = {
  getHoldingRegister: function (addr) {
    // Offset 0 ~ 21: 22채널 1차측 실린더 압력 영역 (%MW100 ~ %MW121)
    if (addr >= 0 && addr < CHANNEL_COUNT) {
      // 22번 채널(addr === 21) SENSOR_FAULT 시뮬레이션
      if (addr === CHANNEL_COUNT - 1) {
        if (faultMode22 === "WIRE_BREAK") return 0; // 4~20mA 단선 급락
        if (faultMode22 === "NOISE_SPIKE") return 1950; // 195.0 bar 노이즈 스파이크
      }
      return pressures[addr];
    }

    // Offset 100 ~ 121: 22채널 밸브 상태 읽기 (%MW200 ~ %MW221)
    if (addr >= 100 && addr < 100 + CHANNEL_COUNT) {
      return valves[addr - 100];
    }

    return 0;
  },

  getInputRegister: function (addr) {
    return vector.getHoldingRegister(addr);
  },

  setRegister: function (addr, value, unitID) {
    // Offset 100 ~ 121: 22채널 밸브 제어 쓰기 (Function Code 06 / 16)
    if (addr >= 100 && addr < 100 + CHANNEL_COUNT) {
      const chIdx = addr - 100;
      const normalized = value ? 1 : 0;
      valves[chIdx] = normalized;
      console.log(
        `[MOCK-PLC] 🛠️ 밸브 제어 수신 (Unit ${unitID}) -> CH${String(chIdx + 1).padStart(
          2,
          "0"
        )} (%MW${200 + chIdx}) = ${normalized === 0 ? "0 (OPEN)" : "1 (SHUTOFF)"}`
      );
      return;
    }

    // 테스트 편의를 위해 Offset 0 ~ 21 압력값 직접 변경도 허용
    if (addr >= 0 && addr < CHANNEL_COUNT) {
      pressures[addr] = Math.max(0, Math.min(3000, Number(value) || 0));
    }
  },
};

// Modbus TCP 서버 기동
const serverTCP = new ModbusRTU.ServerTCP(vector, {
  host: HOST,
  port: PORT,
  debug: false,
  unitID: 1,
});

serverTCP.on("socketError", (err) => {
  console.warn("[MOCK-PLC] 소켓 경고:", err.message);
});

console.log("==================================================================");
console.log(`🚀 [ACSC 22채널 가상 PLC 서버] LS ELECTRIC XBL-EMTA 시뮬레이터 가동 완료`);
console.log(`📡 접속 주소: ${HOST}:${PORT} (Modbus TCP, Unit ID: 1)`);
console.log(`📊 압력 영역: Offset 0~21 (%MW100~%MW121, 1차측 실압력 ×10, C2H2 25bar 규격 반영)`);
console.log(`🔧 밸브 영역: Offset 100~121 (%MW200~%MW221, A통 OPEN / B통 SHUTOFF 대기)`);
console.log(`🛡️ 안전 시연: CH04(2번뱅크 B통) 빈통(8.0bar) 절체차단 인터록 검증용 세팅`);
console.log("==================================================================");

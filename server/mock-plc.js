/**
 * [파일 1] server/mock-plc.js
 * 역할: LS ELECTRIC XGB PLC + XBL-EMTA (Modbus TCP Server) 22채널(11뱅크) 시뮬레이터
 * 주소: 127.0.0.1:8502 (Unit ID: 1)
 *
 * - Offset 0 ~ 21   (%MW100 ~ %MW121): 22채널 압력 (스케일: 실제압력 * 10)
 * - Offset 100 ~ 121 (%MW200 ~ %MW221): 22채널 밸브 제어 (0: OPEN, 1: SHUTOFF)
 */

const ModbusRTU = require("modbus-serial");

const HOST = process.env.MOCK_PLC_HOST || "127.0.0.1";
const PORT = Number(process.env.PLC_MODBUS_PORT || 8502);
const CHANNEL_COUNT = 22;

// 22채널 내부 압력 배열 (초기값 1200 = 120.0 bar)
// 홀수 채널(CH1, CH3, ..., CH21 -> index 0, 2, ..., 20)은 주 공급 실린더로 서서히 소모됨
// 짝수 채널(CH2, CH4, ..., CH22 -> index 1, 3, ..., 21)은 예비(Standby) 실린더로 대기
const pressures = Array.from({ length: CHANNEL_COUNT }, () => 1200);

// 22채널 밸브 상태 배열 (0: OPEN, 1: SHUTOFF)
const valves = Array.from({ length: CHANNEL_COUNT }, () => 0);

// 22번 채널(addr === 21) 센서 고장(SENSOR_FAULT) 20초 주기 시뮬레이션 상태
let faultMode22 = "NORMAL"; // "NORMAL" | "WIRE_BREAK" (0) | "NOISE_SPIKE" (1950)
let tickCount = 0;

// 1초 주기로 홀수 채널(1, 3, 5...21번 채널 -> index 0, 2, ..., 20) 압력 감소 및 자동 리필 시뮬레이션
setInterval(() => {
  tickCount += 1;

  for (let i = 0; i < CHANNEL_COUNT; i++) {
    const isOddChannelNumber = (i + 1) % 2 === 1; // CH01, CH03, ..., CH21
    if (valves[i] === 0 && isOddChannelNumber) {
      const dropStep = i === 0 ? 25 : i === 2 ? 15 : 4 + (i % 5);
      pressures[i] = Math.max(0, pressures[i] - dropStep);

      // 70 (7.0 bar) 이하 도달 시 실린더 교체 모사를 위해 1500 (150.0 bar)으로 자동 리필
      if (pressures[i] <= 70) {
        pressures[i] = 1500;
        console.log(
          `[MOCK-PLC] 🔄 CH${String(i + 1).padStart(
            2,
            "0"
          )} 실린더 교체 시뮬레이션: 7.0 bar 도달 -> 150.0 bar(1500) 자동 리필 완료`
        );
      }
    }
  }

  // 20초 주기로 22번 채널(addr === 21)에 단선(0) 또는 노이즈 스파이크(1950) 발생
  const cycleSec = tickCount % 20;
  if (cycleSec >= 0 && cycleSec < 3) {
    faultMode22 = cycleSec % 2 === 0 ? "WIRE_BREAK" : "NOISE_SPIKE";
  } else {
    faultMode22 = "NORMAL";
  }
}, 1000);

// Modbus TCP Server Vector 정의
const vector = {
  getHoldingRegister: function (addr, unitID) {
    // Offset 0 ~ 21: 22채널 압력 영역 (%MW100 ~ %MW121)
    if (addr >= 0 && addr < CHANNEL_COUNT) {
      // 밸브가 차단(1)된 채널은 압력 0 반환
      if (valves[addr] === 1) {
        return 0;
      }
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

  getInputRegister: function (addr, unitID) {
    return vector.getHoldingRegister(addr, unitID);
  },

  setRegister: function (addr, value, unitID) {
    // Offset 100 ~ 121: 22채널 밸브 제어 쓰기 (Function Code 06 / 16)
    if (addr >= 100 && addr < 100 + CHANNEL_COUNT) {
      const chIdx = addr - 100;
      const normalized = value ? 1 : 0;
      valves[chIdx] = normalized;
      console.log(
        `[MOCK-PLC] 🛠️ 밸브 제어 수신 (Unit ${unitID}) -> CH${String(
          chIdx + 1
        ).padStart(2, "0")} (%MW${200 + chIdx}) = ${
          normalized === 0 ? "0 (OPEN)" : "1 (SHUTOFF)"
        }`
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
console.log(`📊 압력 영역: Offset 0~21 (%MW100~%MW121, 22채널, 스케일: 실제압력 * 10)`);
console.log(`🔧 밸브 영역: Offset 100~121 (%MW200~%MW221, 22채널, 0:OPEN / 1:SHUTOFF)`);
console.log(`⚡ 특이 사항: 홀수 채널 실시간 소모/자동리필, CH22 20초 주기 SENSOR_FAULT 발생`);
console.log("==================================================================");

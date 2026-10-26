/**
 * [파일 1] server/mock-plc.js
 * 역할: LS ELECTRIC XGB PLC + XBL-EMTA (Modbus TCP Server) 시뮬레이터
 * 주소: 127.0.0.1:8502 (Unit ID: 1)
 *
 * - Offset 0 ~ 23   (%MW100 ~ %MW123): 24채널 압력 (스케일: 실제압력 * 10)
 * - Offset 100 ~ 123 (%MW200 ~ %MW223): 24채널 밸브 제어 (0: OPEN, 1: SHUTOFF)
 */

const ModbusRTU = require("modbus-serial");

const HOST = process.env.MOCK_PLC_HOST || "127.0.0.1";
const PORT = Number(process.env.PLC_MODBUS_PORT || 8502);

// 24채널 내부 압력 배열 (초기값 1200 = 120.0 bar)
// 홀수 채널(CH1, CH3, ..., CH23 -> index 0, 2, ..., 22)은 주 공급 실린더로 서서히 소모됨
// 짝수 채널(CH2, CH4, ..., CH24 -> index 1, 3, ..., 23)은 예비(Standby) 실린더로 대기
const pressures = Array.from({ length: 24 }, (_, idx) => {
  // 시뮬레이션 현실감을 위해 홀수 채널(index 0, 2, 4...)은 1200(120.0 bar),
  // 단, 빠른 절체 테스트를 위해 CH1(idx 0)은 240(24.0 bar), CH3(idx 2)은 380(38.0 bar) 근처로 설정하되
  // 기본 초기값 스펙(1200)을 준수하면서 일부 채널에 다양한 테스트 편차를 부여할 수도 있으나,
  // 명세에 따라 기본 초기값 1200으로 초기화합니다.
  return 1200;
});

// 24채널 밸브 상태 배열 (0: OPEN, 1: SHUTOFF)
const valves = Array.from({ length: 24 }, () => 0);

// 24번 채널(addr === 23) 센서 고장(SENSOR_FAULT) 20초 주기 시뮬레이션 상태
let faultMode24 = "NORMAL"; // "NORMAL" | "WIRE_BREAK" (0) | "NOISE_SPIKE" (1950)
let tickCount = 0;

// 1초 주기로 홀수 채널(1, 3, 5...번 채널 -> index 0, 2, 4...) 압력 감소 및 자동 리필 시뮬레이션
setInterval(() => {
  tickCount += 1;

  for (let i = 0; i < 24; i++) {
    const isOddChannelNumber = (i + 1) % 2 === 1; // CH01, CH03, ..., CH23
    // 밸브가 열려 있는(0) 홀수 채널(또는 현재 개방되어 공급 중인 채널) 압력 소모
    if (valves[i] === 0 && isOddChannelNumber) {
      // 채널별로 소모 속도를 조금씩 다르게 설정 (CH1은 빠른 확인을 위해 초당 15~25 감소)
      const dropStep = i === 0 ? 25 : i === 2 ? 15 : 4 + (i % 5);
      pressures[i] = Math.max(0, pressures[i] - dropStep);

      // 70 (7.0 bar) 이하 도달 시 실린더 교체 모사를 위해 1500 (150.0 bar)으로 자동 리필
      if (pressures[i] <= 70) {
        pressures[i] = 1500;
        console.log(
          `[MOCK-PLC] 🔄 CH${String(i + 1).padStart(2, "0")} 실린더 교체 시뮬레이션: 7.0 bar 도달 -> 150.0 bar(1500) 자동 리필 완료`
        );
      }
    }
  }

  // 20초 주기로 24번 채널(addr === 23)에 단선(0) 또는 노이즈 스파이크(1950) 발생 (4초간 유지 후 복구)
  const cycleSec = tickCount % 20;
  if (cycleSec >= 0 && cycleSec < 3) {
    faultMode24 = cycleSec % 2 === 0 ? "WIRE_BREAK" : "NOISE_SPIKE";
  } else {
    faultMode24 = "NORMAL";
  }
}, 1000);

// Modbus TCP Server Vector 정의
const vector = {
  getHoldingRegister: function (addr, unitID) {
    // Offset 0 ~ 23: 24채널 압력 영역 (%MW100 ~ %MW123)
    if (addr >= 0 && addr <= 23) {
      // 밸브가 차단(1)된 채널은 압력 0 반환
      if (valves[addr] === 1) {
        return 0;
      }
      // 24번 채널(addr === 23) SENSOR_FAULT 시뮬레이션
      if (addr === 23) {
        if (faultMode24 === "WIRE_BREAK") return 0; // 4~20mA 단선 급락
        if (faultMode24 === "NOISE_SPIKE") return 1950; // 195.0 bar 노이즈 스파이크
      }
      return pressures[addr];
    }

    // Offset 100 ~ 123: 24채널 밸브 상태 읽기 (%MW200 ~ %MW223)
    if (addr >= 100 && addr <= 123) {
      return valves[addr - 100];
    }

    return 0;
  },

  getInputRegister: function (addr, unitID) {
    return vector.getHoldingRegister(addr, unitID);
  },

  setRegister: function (addr, value, unitID) {
    // Offset 100 ~ 123: 24채널 밸브 제어 쓰기 (Function Code 06 / 16)
    if (addr >= 100 && addr <= 123) {
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

    // 테스트 편의를 위해 Offset 0 ~ 23 압력값 직접 변경도 허용
    if (addr >= 0 && addr <= 23) {
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
console.log(`🚀 [ACSC 가상 PLC 서버] LS ELECTRIC XBL-EMTA 시뮬레이터 가동 완료`);
console.log(`📡 접속 주소: ${HOST}:${PORT} (Modbus TCP, Unit ID: 1)`);
console.log(`📊 압력 영역: Offset 0~23 (%MW100~%MW123, 스케일: 실제압력 * 10)`);
console.log(`🔧 밸브 영역: Offset 100~123 (%MW200~%MW223, 0:OPEN / 1:SHUTOFF)`);
console.log(`⚡ 특이 사항: 홀수 채널 실시간 소모/자동리필, CH24 20초 주기 SENSOR_FAULT 발생`);
console.log("==================================================================");

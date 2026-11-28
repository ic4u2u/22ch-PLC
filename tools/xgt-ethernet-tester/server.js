/**
 * PC A용 — LS ELECTRIC XGT 가상 PLC 서버 (TCP 2004) & 자유 데이터 에코 서버
 * - 실행 방법: node server.js (또는 1_PC_A_서버실행(가상PLC).bat 더블클릭)
 * - 외부 라이브러리 없음 (Node.js 내장 net, os 모듈만 사용)
 */

const net = require("net");
const os = require("os");
const {
  CMD,
  DATA_TYPE,
  toHex,
  parseXgtFrame,
  buildWordReadResponse,
  buildContinuousReadResponse,
  buildWordWriteResponse,
} = require("./xgt-protocol");

const PORT = Number(process.env.XGT_PORT || 2004);
const HOST = "0.0.0.0";

// 가상 PLC 워드 메모리 (%MW0, %MW100~121 압력×10, %MW200~221 밸브상태) 초기 샘플 데이터
const plcMemory = new Map([
  ["%MW0", 486],
]);
for (let i = 0; i < 22; i++) {
  const isAcetylene = i === 8 || i === 9; // CH09, CH10 아세틸렌
  const isPrimaryA = i % 2 === 0;
  const pVal = isAcetylene ? (isPrimaryA ? 210 : 240) : (isPrimaryA ? 1200 : 1480);
  plcMemory.set(`%MW${100 + i}`, pVal);
  plcMemory.set(`%MW${200 + i}`, isPrimaryA ? 0 : 1); // 0: OPEN, 1: SHUTOFF
}

/** 현재 시각 문자열 (HH:MM:SS.mmm) */
function nowStr() {
  const d = new Date();
  return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
}

/** 이 PC의 IPv4 주소 목록 조회 (PC B에서 접속할 IP 안내용) */
function getLocalIPv4List() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(nets)) {
    for (const info of nets[name] || []) {
      if (info.family === "IPv4" && !info.internal) {
        list.push(`${name}: ${info.address}`);
      }
    }
  }
  return list;
}

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`\n[${nowStr()}] 🔗 클라이언트 접속됨: ${remote}`);

  socket.on("data", (data) => {
    const parsed = parseXgtFrame(data);
    console.log(`[${nowStr()}] 📥 RX (${data.length}B) from ${remote}`);
    console.log(`   HEX : ${toHex(data)}`);

    if (parsed.isXgt) {
      // 1) LSIS-XGT 읽기 요청 처리
      if (parsed.command === CMD.READ_REQ) {
        const varName = parsed.variableName || "%MW0";
        if (parsed.dataType === DATA_TYPE.CONTINUOUS && parsed.byteCount > 0) {
          const byteCount = Math.min(256, parsed.byteCount);
          const mbMatch = /^%MB(\d+)$/i.exec(varName.trim());
          const mwMatch = /^%MW(\d+)$/i.exec(varName.trim());
          const startWord = mbMatch
            ? Math.floor(Number(mbMatch[1]) / 2)
            : mwMatch
            ? Number(mwMatch[1])
            : 0;
          const wordCount = Math.ceil(byteCount / 2);
          const dataBuf = Buffer.alloc(byteCount, 0);
          for (let w = 0; w < wordCount; w++) {
            const key = `%MW${startWord + w}`;
            const val = plcMemory.has(key) ? plcMemory.get(key) : 0;
            if (w * 2 + 1 < byteCount) {
              dataBuf.writeUInt16LE(val & 0xffff, w * 2);
            }
          }
          const res = buildContinuousReadResponse(parsed.invokeId, dataBuf, 0x0000);
          socket.write(res);
          console.log(
            `   해석: [XGT 연속읽기] ${varName} (${byteCount}B / ${wordCount}W -> %MW${startWord}~%MW${
              startWord + wordCount - 1
            })`
          );
          console.log(`[${nowStr()}] 📤 TX (${res.length}B): ${toHex(res)}`);
          return;
        }

        const val = plcMemory.has(varName) ? plcMemory.get(varName) : 0;
        const res = buildWordReadResponse(parsed.invokeId, val, 0x0000);
        socket.write(res);
        console.log(`   해석: [XGT 읽기] ${varName} -> 현재값 ${val} (${(val / 10).toFixed(1)})`);
        console.log(`[${nowStr()}] 📤 TX (${res.length}B): ${toHex(res)}`);
        return;
      }

      // 2) LSIS-XGT 쓰기 요청 처리
      if (parsed.command === CMD.WRITE_REQ) {
        const varName = parsed.variableName || "%MW0";
        const newVal = typeof parsed.value === "number" ? parsed.value : 0;
        plcMemory.set(varName, newVal);
        const res = buildWordWriteResponse(parsed.invokeId, 0x0000);
        socket.write(res);
        console.log(`   해석: [XGT 쓰기] ${varName} = ${newVal} 저장 완료`);
        console.log(`[${nowStr()}] 📤 TX (${res.length}B): ${toHex(res)}`);
        return;
      }

      // 기타 XGT 프레임은 정상 에코
      socket.write(data);
      console.log(`   해석: [XGT 기타 명령 0x${parsed.command.toString(16)}] 그대로 응답`);
      return;
    }

    // 3) 일반 자유 텍스트 / 사용자 정의 패킷 테스트 모드 (PC 2대 간 일반 데이터 송수신)
    const text = data.toString("utf8").replace(/\r?\n/g, " ");
    const reply = Buffer.from(`[PC_A 수신확인 ${nowStr()}] ${text}`, "utf8");
    socket.write(reply);
    console.log(`   해석: [일반 텍스트] "${text}"`);
    console.log(`[${nowStr()}] 📤 TX (${reply.length}B): "${reply.toString("utf8")}"`);
  });

  socket.on("close", () => {
    console.log(`[${nowStr()}] 🔌 클라이언트 연결 종료: ${remote}`);
  });

  socket.on("error", (err) => {
    console.log(`[${nowStr()}] ⚠️ 소켓 오류 (${remote}): ${err.message}`);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ 포트 ${PORT}번이 이미 사용 중입니다. 기존 서버 창을 닫고 다시 실행해 주세요.`);
  } else {
    console.error(`❌ 서버 오류:`, err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("=================================================================");
  console.log("🚀 [PC A] LS ELECTRIC XGT 가상 PLC & 이더넷 통신 서버 가동 완료");
  console.log(`📡 대기 포트 : TCP ${PORT} (LS XGT 전용 프로토콜 표준 포트)`);
  console.log("🌐 PC B(클라이언트)에서 아래 IP 중 하나로 접속하세요:");
  const ips = getLocalIPv4List();
  if (ips.length === 0) {
    console.log("   - 127.0.0.1 (같은 PC 내부 테스트용)");
  } else {
    ips.forEach((ip) => console.log(`   - ${ip}`));
    console.log("   - 127.0.0.1 (같은 PC 혼자 테스트할 때)");
  }
  console.log("💾 기본 세팅 메모리: %MW0=486, %MW100=486, %MW101=1130, %MW102=428");
  console.log("=================================================================");
  console.log("※ 방화벽 경고창이 뜨면 반드시 [액세스 허용]을 눌러주세요!\n");
});

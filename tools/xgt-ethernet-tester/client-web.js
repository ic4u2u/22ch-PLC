/**
 * PC B용 — 웹 기반 LS Enet Client 서버 (외부 패키지 불필요, 순수 Node.js 내장 모듈)
 * - 브라우저 UI(http://localhost:3100) <-> TCP 소켓(대상 PC A 또는 실물 LS PLC:2004)
 */

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const {
  toHex,
  fromHex,
  buildWordReadRequest,
  buildWordWriteRequest,
  parseXgtFrame,
} = require("./xgt-protocol");

const WEB_PORT = Number(process.env.WEB_PORT || 3100);
const HTML_PATH = path.join(__dirname, "public", "index.html");

let tcpSocket = null;
let connectedTarget = null;
let invokeCounter = 1;
let lastTxTime = 0;
let txCount = 0;
let rxCount = 0;

// SSE(실시간 로그 스트림) 구독 브라우저 목록
const sseClients = new Set();

function nowStr() {
  const d = new Date();
  return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

function pushLog(type, title, detail, hex = "", elapsedMs = null) {
  broadcast("log", {
    time: nowStr(),
    type, // 'tx' | 'rx' | 'info' | 'error'
    title,
    detail,
    hex,
    elapsedMs,
    txCount,
    rxCount,
  });
}

function pushStatus() {
  broadcast("status", {
    connected: Boolean(tcpSocket && !tcpSocket.destroyed && connectedTarget),
    target: connectedTarget,
    txCount,
    rxCount,
  });
}

/** 소켓 에러 코드를 초보자용 한글 안내(PDF 6페이지 기준)로 변환 */
function friendlySocketError(err) {
  if (err.code === "ECONNREFUSED") {
    return "연결 거부 (10061): 대상 PC/PLC의 포트(2004)가 닫혀 있거나 서버가 실행되지 않았습니다.";
  }
  if (err.code === "ETIMEDOUT" || err.code === "EHOSTUNREACH") {
    return "응답 시간 초과 (10060): IP 주소가 다르거나 방화벽 차단, 또는 랜선이 연결되지 않았습니다.";
  }
  if (err.code === "ECONNRESET") {
    return "연결 끊김 (10053/10054): 상대방(PC A 또는 PLC)이 연결을 종료했습니다.";
  }
  return `통신 오류 (${err.code || "ERR"}): ${err.message}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error("잘못된 JSON 요청입니다."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function closeTcp(reason) {
  if (tcpSocket) {
    tcpSocket.removeAllListeners();
    tcpSocket.destroy();
    tcpSocket = null;
  }
  if (connectedTarget) {
    pushLog("info", "연결 종료", `${connectedTarget} (${reason || "사용자 요청"})`);
    connectedTarget = null;
  }
  pushStatus();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${WEB_PORT}`);

  // 1) 메인 UI HTML
  if (req.method === "GET" && url.pathname === "/") {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // 2) SSE 실시간 이벤트 스트림
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    sseClients.add(res);
    pushStatus();
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // 3) TCP 연결 요청
  if (req.method === "POST" && url.pathname === "/api/connect") {
    try {
      const { host = "127.0.0.1", port = 2004 } = await readJsonBody(req);
      closeTcp("재연결");
      const targetStr = `${host.trim()}:${Number(port)}`;
      pushLog("info", "연결 시도", `${targetStr} 접속 중...`);

      const sock = new net.Socket();
      sock.setTimeout(5000);
      tcpSocket = sock;

      let settled = false;
      sock.connect(Number(port), host.trim(), () => {
        if (settled) return;
        settled = true;
        sock.setTimeout(0);
        connectedTarget = targetStr;
        pushLog("info", "연결 성공 (Connected!)", `${targetStr} TCP 통신 준비 완료`);
        pushStatus();
        sendJson(res, 200, { ok: true, target: targetStr });
      });

      sock.on("data", (data) => {
        rxCount += 1;
        const elapsed = lastTxTime ? Date.now() - lastTxTime : null;
        const parsed = parseXgtFrame(data);
        if (parsed.isXgt) {
          let summary = `[LSIS-XGT] ${parsed.direction} · Cmd=0x${parsed.command.toString(16).toUpperCase()}`;
          if (typeof parsed.value === "number") {
            summary += ` · 수신값 = ${parsed.value} (×0.1 환산: ${(parsed.value / 10).toFixed(1)})`;
          } else if (parsed.errorCode === 0) {
            summary += " · 정상 처리 완료 (Error=0)";
          } else if (typeof parsed.errorCode === "number") {
            summary += ` · PLC 에러코드=0x${parsed.errorCode.toString(16)}`;
          }
          pushLog("rx", `RX 수신 (${data.length}B)`, summary, toHex(data), elapsed);
        } else {
          const text = data.toString("utf8");
          pushLog("rx", `RX 수신 (${data.length}B)`, `텍스트: ${text}`, toHex(data), elapsed);
        }
      });

      sock.on("timeout", () => {
        if (settled) return;
        settled = true;
        const msg = friendlySocketError({ code: "ETIMEDOUT" });
        pushLog("error", "연결 시간 초과", msg);
        closeTcp("타임아웃");
        sendJson(res, 504, { ok: false, error: msg });
      });

      sock.on("error", (err) => {
        const msg = friendlySocketError(err);
        pushLog("error", "소켓 오류", msg);
        if (!settled) {
          settled = true;
          closeTcp("오류");
          sendJson(res, 500, { ok: false, error: msg });
        } else {
          closeTcp("오류");
        }
      });

      sock.on("close", () => {
        if (connectedTarget) {
          closeTcp("원격 종료");
        }
      });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // 4) 연결 종료
  if (req.method === "POST" && url.pathname === "/api/disconnect") {
    closeTcp("사용자 끊기 클릭");
    sendJson(res, 200, { ok: true });
    return;
  }

  // 5) 데이터 송신 (XGT 읽기 / XGT 쓰기 / HEX / 일반 텍스트)
  if (req.method === "POST" && url.pathname === "/api/send") {
    try {
      if (!tcpSocket || !connectedTarget) {
        return sendJson(res, 400, { ok: false, error: "먼저 [연결] 버튼을 눌러 서버/PLC에 접속해 주세요." });
      }
      const { mode, variableName = "%MW0", wordValue = 0, payload = "" } = await readJsonBody(req);
      let buf;
      let detail = "";

      if (mode === "xgt_read") {
        buf = buildWordReadRequest(variableName, invokeCounter++);
        detail = `[XGT 읽기 요청] 번지: ${variableName.toUpperCase()}`;
      } else if (mode === "xgt_write") {
        buf = buildWordWriteRequest(variableName, Number(wordValue) || 0, invokeCounter++);
        detail = `[XGT 쓰기 요청] 번지: ${variableName.toUpperCase()} ← 값 ${Number(wordValue) || 0}`;
      } else if (mode === "hex") {
        buf = fromHex(payload);
        detail = `[HEX 직접 송신] ${buf.length} Bytes`;
      } else {
        if (!payload) throw new Error("보낼 메시지를 입력해 주세요.");
        buf = Buffer.from(payload, "utf8");
        detail = `[텍스트 송신] "${payload}"`;
      }

      lastTxTime = Date.now();
      txCount += 1;
      tcpSocket.write(buf);
      pushLog("tx", `TX 송신 (${buf.length}B)`, detail, toHex(buf));
      sendJson(res, 200, { ok: true, hex: toHex(buf), bytes: buf.length });
    } catch (e) {
      pushLog("error", "송신 오류", e.message);
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // 6) XGT 프레임 미리보기 생성
  if (req.method === "POST" && url.pathname === "/api/build-frame") {
    try {
      const { mode = "xgt_read", variableName = "%MW0", wordValue = 0 } = await readJsonBody(req);
      const buf =
        mode === "xgt_write"
          ? buildWordWriteRequest(variableName, Number(wordValue) || 0, 0)
          : buildWordReadRequest(variableName, 0);
      sendJson(res, 200, { ok: true, hex: toHex(buf), bytes: buf.length });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(WEB_PORT, "127.0.0.1", () => {
  console.log("=================================================================");
  console.log("🖥️  [PC B] 웹 기반 LS Enet Client (이더넷 통신 테스터) 가동 완료");
  console.log(`🌐 브라우저 주소: http://localhost:${WEB_PORT}`);
  console.log("=================================================================");
});

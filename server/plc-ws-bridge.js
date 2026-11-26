/**
 * [파일 3] server/plc-ws-bridge.js
 * 역할: 중앙 브릿지 서버 (Modbus TCP / LS XGT 듀얼 프로토콜 0.5초 폴링 + WebSocket + REST API)
 * 포트: 4000 (HTTP REST API & WebSocket 공유, CORS 전면 허용)
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const url = require("url");
const { WebSocketServer } = require("ws");
const ModbusRTU = require("modbus-serial");
const { LsXgtClient } = require("./ls-xgt-client");
const { usbTowerLamp } = require("./usb-tower-lamp");
const { db, DB_PATH, CHANNEL_COUNT, getSetting, setSetting, logAudit } = require("./lib/db");
const {
  extractClientIp,
  authenticatePin,
  verifyAdminToken,
  revokeAdminToken,
  changeAdminPin,
  isUsingDefaultPin,
  isValidChannelId,
} = require("./lib/security");
const { evaluateChannels, evaluateBanksAndSwitch } = require("./lib/smart-ai-engine");
const { executeSafeValveSwitch } = require("./lib/safety-interlock");
const {
  recordChannelSnapshot,
  sendTelegramAlert,
  startMaintenanceScheduler,
} = require("./lib/backup-logger");

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 4000);
const PLC_PROTOCOL = (process.env.PLC_PROTOCOL || "MODBUS").toUpperCase(); // "MODBUS" | "XGT"
const PLC_IP = process.env.PLC_IP || "127.0.0.1";
const PLC_MODBUS_PORT = Number(process.env.PLC_MODBUS_PORT || 8502);
const PLC_XGT_PORT = Number(process.env.PLC_XGT_PORT || 2004);

// 통신 상태 및 최신 런타임 캐시 (22채널 / 11뱅크)
const runtimeState = {
  plcConnected: false,
  protocol: PLC_PROTOCOL,
  plcIp: PLC_IP,
  plcPort: PLC_PROTOCOL === "XGT" ? PLC_XGT_PORT : PLC_MODBUS_PORT,
  latencyMs: 0,
  lastPollAt: null,
  lastError: null,
  rawPressures: Array(CHANNEL_COUNT).fill(1200),
  rawValves: Array(CHANNEL_COUNT).fill(0),
  channels: [],
  banks: [],
  recentAlerts: [],
  packetLogs: [],
  dumpWaitingRx: false,
};

// 드라이버 인스턴스 준비
const modbusClient = new ModbusRTU();
modbusClient.setTimeout(1200);
const xgtClient = new LsXgtClient({ host: PLC_IP, port: PLC_XGT_PORT });

async function ensurePlcConnected() {
  if (PLC_PROTOCOL === "XGT") {
    await xgtClient.connect();
    return;
  }
  if (!modbusClient.isOpen) {
    await modbusClient.connectTCP(PLC_IP, { port: PLC_MODBUS_PORT });
    modbusClient.setID(1);
  }
}

let modbusTxSeq = 0;

function toHexSpaced(buf) {
  return buf.toString("hex").toUpperCase().replace(/(.{2})/g, "$1 ").trim();
}

function pushPacketLog(entry) {
  const first = runtimeState.packetLogs[0];
  if (first && first.rxBytes === 0 && !first.error && first.txHex === entry.txHex) {
    runtimeState.packetLogs = [entry, ...runtimeState.packetLogs.slice(1)].slice(0, 30);
    return;
  }
  runtimeState.packetLogs = [entry, ...runtimeState.packetLogs].slice(0, 30);
}

function buildModbusReadDump(startAddr, count, words) {
  modbusTxSeq = (modbusTxSeq + 1) & 0xffff;
  const tx = Buffer.alloc(12);
  tx.writeUInt16BE(modbusTxSeq, 0);
  tx.writeUInt16BE(0x0000, 2);
  tx.writeUInt16BE(6, 4);
  tx.writeUInt8(1, 6);
  tx.writeUInt8(0x03, 7);
  tx.writeUInt16BE(startAddr, 8);
  tx.writeUInt16BE(count, 10);

  const byteCount = words.length * 2;
  const rx = Buffer.alloc(9 + byteCount);
  rx.writeUInt16BE(modbusTxSeq, 0);
  rx.writeUInt16BE(0x0000, 2);
  rx.writeUInt16BE(3 + byteCount, 4);
  rx.writeUInt8(1, 6);
  rx.writeUInt8(0x03, 7);
  rx.writeUInt8(byteCount, 8);
  for (let i = 0; i < words.length; i++) {
    rx.writeUInt16BE(words[i] & 0xffff, 9 + i * 2);
  }

  return {
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
    protocol: "MODBUS",
    op: `FC03 HoldingReg ${startAddr}~${startAddr + count - 1} (${count}W)`,
    txHex: toHexSpaced(tx),
    txBytes: tx.length,
    rxHex: toHexSpaced(rx),
    rxBytes: rx.length,
    error: null,
  };
}

async function readPlcRegisters({ onTx = null } = {}) {
  const startNs = process.hrtime.bigint();
  await ensurePlcConnected();

  if (PLC_PROTOCOL === "XGT") {
    // %MW100~%MW121 (22워드 압력), %MW200~%MW221 (22워드 밸브)
    const pressures = await xgtClient.readWords(100, CHANNEL_COUNT, onTx);
    const pressurePkt = xgtClient.lastPacket ? { ...xgtClient.lastPacket } : null;
    const valves = await xgtClient.readWords(200, CHANNEL_COUNT);
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    if (pressurePkt) pushPacketLog(pressurePkt);
    return { pressures, valves, latencyMs: Number(elapsedMs.toFixed(2)) };
  } else {
    // Modbus Holding Register Offset 0~21 (22채널 압력), Offset 100~121 (22채널 밸브)
    if (typeof onTx === "function") {
      const txPreview = buildModbusReadDump(0, CHANNEL_COUNT, []);
      onTx({
        ...txPreview,
        rxHex: "",
        rxBytes: 0,
      });
    }
    const pRes = await modbusClient.readHoldingRegisters(0, CHANNEL_COUNT);
    const vRes = await modbusClient.readHoldingRegisters(100, CHANNEL_COUNT);
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    pushPacketLog(buildModbusReadDump(0, CHANNEL_COUNT, pRes.data));
    return {
      pressures: pRes.data,
      valves: vRes.data,
      latencyMs: Number(elapsedMs.toFixed(2)),
    };
  }
}

async function writePlcValve(channelIndex0to23, value0or1, reason = "원격 제어") {
  const cleanVal = value0or1 ? 1 : 0;
  try {
    await ensurePlcConnected();
    if (PLC_PROTOCOL === "XGT") {
      await xgtClient.writeSingleWord(200 + channelIndex0to23, cleanVal);
    } else {
      await modbusClient.writeRegister(100 + channelIndex0to23, cleanVal);
    }
    runtimeState.rawValves[channelIndex0to23] = cleanVal;
  } catch (err) {
    console.warn(`[BRIDGE] PLC 밸브 쓰기 실패 (${reason}):`, err.message);
    runtimeState.rawValves[channelIndex0to23] = cleanVal;
  }
}

function getNetworkDiagnostics() {
  const nets = os.networkInterfaces();
  const ipv4List = [];
  for (const name of Object.keys(nets)) {
    for (const netInfo of nets[name] || []) {
      if (netInfo.family === "IPv4" && !netInfo.internal) {
        ipv4List.push({ interface: name, address: netInfo.address, netmask: netInfo.netmask });
      }
    }
  }
  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) dbSizeBytes = fs.statSync(DB_PATH).size;
  } catch {}

  return {
    serverTime: new Date().toISOString(),
    lanInterfaces: ipv4List,
    primaryLanIp: ipv4List[0]?.address || "127.0.0.1",
    plcConnected: runtimeState.plcConnected,
    protocol: runtimeState.protocol,
    plcIp: runtimeState.plcIp,
    plcPort: runtimeState.plcPort,
    latencyMs: runtimeState.latencyMs,
    lastPollAt: runtimeState.lastPollAt,
    lastError: runtimeState.lastError,
    dbSizeBytes,
    dbSizeKB: Number((dbSizeBytes / 1024).toFixed(1)),
    dbSizeMB: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
  };
}

function pushAlert(alertObj) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    ...alertObj,
  };
  runtimeState.recentAlerts = [item, ...runtimeState.recentAlerts].slice(0, 100);
  sendTelegramAlert(item.message);
  broadcast({ type: "ALERT", payload: item });
}

function readJsonBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error("요청 본문 크기 초과"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("잘못된 JSON 형식"));
      }
    });
    req.on("error", reject);
  });
}

// HTTP REST API 서버 (Port 4000, 사내망 CORS 허용 및 인증 API 탑재)
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const clientIp = extractClientIp(req);
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  const sendJson = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "POST" && pathname === "/api/auth/verify-pin") {
    try {
      const body = await readJsonBody(req);
      const result = authenticatePin(body.pin, clientIp);
      return sendJson(result.ok ? 200 : result.locked ? 429 : 401, result);
    } catch (err) {
      return sendJson(400, { ok: false, message: err.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/auth/change-pin") {
    try {
      const body = await readJsonBody(req);
      const result = changeAdminPin(body.currentPin, body.newPin, clientIp);
      return sendJson(result.ok ? 200 : 400, result);
    } catch (err) {
      return sendJson(400, { ok: false, message: err.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    try {
      const body = await readJsonBody(req);
      revokeAdminToken(body.token);
      logAudit(`ADMIN (${clientIp})`, "PIN_LOCK", "AUTH", "관리자 수동 잠금 (세션 즉시 만료)");
      return sendJson(200, { ok: true });
    } catch {
      return sendJson(200, { ok: true });
    }
  }

  if (req.method === "GET" && pathname === "/api/diagnostics") {
    return sendJson(200, getNetworkDiagnostics());
  }

  if (req.method === "GET" && pathname === "/api/plc-dump") {
    return sendJson(200, {
      plcConnected: runtimeState.plcConnected,
      protocol: runtimeState.protocol,
      plcIp: runtimeState.plcIp,
      plcPort: runtimeState.plcPort,
      latencyMs: runtimeState.latencyMs,
      lastPollAt: runtimeState.lastPollAt,
      lastError: runtimeState.lastError,
      rawPressures:
        runtimeState.dumpWaitingRx || !runtimeState.plcConnected
          ? []
          : runtimeState.rawPressures,
      rawValves:
        runtimeState.dumpWaitingRx || !runtimeState.plcConnected
          ? []
          : runtimeState.rawValves,
      packetLogs: runtimeState.packetLogs,
      dumpWaitingRx: runtimeState.dumpWaitingRx,
    });
  }

  if (req.method === "POST" && pathname === "/api/plc-poll-once") {
    // 1) 기존 버퍼 값 모두 클리어
    runtimeState.dumpWaitingRx = true;
    runtimeState.packetLogs = [];
    runtimeState.lastError = null;
    runtimeState.lastPollAt = null;
    try {
      // 2) TX 송신 시 TX 버퍼 먼저 기록 -> 3) PLC RX 수신 시 값 채움
      const { pressures, valves, latencyMs } = await readPlcRegisters({
        onTx: (txEntry) => {
          runtimeState.packetLogs = [txEntry];
        },
      });
      runtimeState.dumpWaitingRx = false;
      runtimeState.plcConnected = true;
      runtimeState.latencyMs = latencyMs;
      runtimeState.lastPollAt = new Date().toISOString();
      runtimeState.lastError = null;
      runtimeState.rawPressures = pressures;
      runtimeState.rawValves = valves;
      return sendJson(200, {
        ok: true,
        plcConnected: true,
        protocol: runtimeState.protocol,
        plcIp: runtimeState.plcIp,
        plcPort: runtimeState.plcPort,
        latencyMs,
        lastPollAt: runtimeState.lastPollAt,
        lastError: null,
        rawPressures: pressures,
        rawValves: valves,
        packetLogs: runtimeState.packetLogs,
        dumpWaitingRx: false,
      });
    } catch (err) {
      runtimeState.dumpWaitingRx = false;
      runtimeState.plcConnected = false;
      runtimeState.lastError = err.message;
      if (PLC_PROTOCOL === "XGT" && xgtClient.lastPacket) {
        pushPacketLog({ ...xgtClient.lastPacket, error: err.message });
      }
      return sendJson(502, {
        ok: false,
        plcConnected: false,
        protocol: runtimeState.protocol,
        plcIp: runtimeState.plcIp,
        plcPort: runtimeState.plcPort,
        latencyMs: runtimeState.latencyMs,
        lastPollAt: runtimeState.lastPollAt,
        lastError: err.message,
        rawPressures: [],
        rawValves: [],
        packetLogs: runtimeState.packetLogs,
        dumpWaitingRx: false,
      });
    }
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return sendJson(200, {
      channel_configs: getSetting("channel_configs", []),
      bank_configs: getSetting("bank_configs", []),
      fa_preset: getSetting("fa_preset", null),
      floorplan_bg: getSetting("floorplan_bg", { dataUrl: "" }),
      isDefaultPin: isUsingDefaultPin(),
    });
  }

  if (req.method === "GET" && pathname === "/api/history") {
    const limit = Math.min(500, Number(parsedUrl.query.limit || 180));
    const rows = db
      .prepare(
        "SELECT id, timestamp, pressures_json, valves_json FROM channel_logs WHERE is_deleted = 0 ORDER BY id DESC LIMIT ?"
      )
      .all(limit)
      .reverse();
    return sendJson(200, { logs: rows });
  }

  if (req.method === "GET" && pathname === "/api/audit") {
    const limit = Math.min(300, Number(parsedUrl.query.limit || 100));
    const rows = db
      .prepare(
        "SELECT id, timestamp, actor, action_type, target, detail FROM audit_logs WHERE is_deleted = 0 ORDER BY id DESC LIMIT ?"
      )
      .all(limit);
    return sendJson(200, { logs: rows });
  }

  if (req.method === "GET" && pathname === "/api/replacements") {
    const logs = db
      .prepare(
        "SELECT * FROM cylinder_replacements WHERE is_deleted = 0 ORDER BY id DESC LIMIT 100"
      )
      .all();
    const monthlySummary = db
      .prepare(`
        SELECT year_month, gas_name, COUNT(*) as replace_count, ROUND(SUM(delta_pressure), 1) as total_consumed_bar
        FROM cylinder_replacements
        WHERE is_deleted = 0
        GROUP BY year_month, gas_name
        ORDER BY year_month DESC, replace_count DESC
      `)
      .all();
    return sendJson(200, { logs, monthlySummary });
  }

  if (req.method === "GET" && pathname === "/api/leak-tests") {
    const logs = db
      .prepare("SELECT * FROM leak_test_logs WHERE is_deleted = 0 ORDER BY id DESC LIMIT 100")
      .all();
    return sendJson(200, { logs });
  }

  return sendJson(404, { error: "Not Found" });
});

// WebSocket 서버 (HTTP Port 4000 공유)
const wss = new WebSocketServer({ server });

function broadcast(messageObj) {
  const data = JSON.stringify(messageObj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

wss.on("connection", (ws, req) => {
  const clientIp = extractClientIp(req);

  // 최초 접속 시 현재 전체 상태 및 설정 즉시 전송 (주의: 비밀번호 원본 절대 전송 금지!)
  ws.send(
    JSON.stringify({
      type: "INIT_STATE",
      payload: {
        diagnostics: getNetworkDiagnostics(),
        towerLamp: usbTowerLamp.getState(),
        channels: runtimeState.channels,
        banks: runtimeState.banks,
        recentAlerts: runtimeState.recentAlerts,
        settings: {
          channel_configs: getSetting("channel_configs", []),
          bank_configs: getSetting("bank_configs", []),
          fa_preset: getSetting("fa_preset", null),
          floorplan_bg: getSetting("floorplan_bg", { dataUrl: "" }),
          isDefaultPin: isUsingDefaultPin(),
        },
      },
    })
  );

  // 관리자 세션 토큰 필수 검증 명령 목록
  const PROTECTED_COMMANDS = new Set([
    "SET_VALVE",
    "UPDATE_CHANNEL_CONFIG",
    "UPDATE_BANK_CONFIG",
    "SAVE_FA_PRESET",
    "RESTORE_FA_PRESET",
    "UPDATE_FLOORPLAN",
    "SAVE_LEAK_TEST",
    "TOWER_LAMP_TEST",
  ]);

  ws.on("message", async (rawMsg) => {
    try {
      const strMsg = rawMsg.toString();
      if (strMsg.length > 2 * 1024 * 1024) return; // 비정상 대용량 패킷 방어
      const msg = JSON.parse(strMsg);
      const { type, payload = {}, authToken } = msg;
      const actorTag = `ADMIN (${clientIp})`;

      if (PROTECTED_COMMANDS.has(type)) {
        const tokenCheck = verifyAdminToken(authToken || payload.authToken);
        if (!tokenCheck.valid) {
          logAudit(
            `GUEST (${clientIp})`,
            "UNAUTHORIZED_BLOCK",
            type,
            "인증 토큰 없음 또는 만료된 상태에서 제어 명령 시도 차단됨"
          );
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "AUTH_ERROR",
                payload: {
                  message: "⛔ 관리자 인증 세션이 없거나 만료되었습니다. PIN 잠금을 다시 해제해 주세요.",
                },
              })
            );
          }
          return;
        }
      }

      if (type === "SET_VALVE") {
        const chId = Number(payload.channelId);
        if (!isValidChannelId(chId)) {
          logAudit(actorTag, "INVALID_PARAM", `CH-${payload.channelId}`, "유효하지 않은 채널 번호 요청 차단");
          return;
        }
        const switchRes = await executeSafeValveSwitch({
          channelId: chId,
          requestedValveState: payload.valveState,
          forceEmergency: Boolean(payload.forceEmergency),
          runtimeState,
          writePlcValve,
          actorTag,
          pushAlert,
        });
        if (!switchRes.ok) {
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "SAFETY_INTERLOCK",
                payload: { message: switchRes.message },
              })
            );
          }
          return;
        }
        broadcast({
          type: "VALVE_SWITCH_OK",
          payload: switchRes,
        });
      } else if (type === "UPDATE_CHANNEL_CONFIG") {
        const chId = Number(payload.id);
        if (!isValidChannelId(chId)) return;
        const configs = getSetting("channel_configs", []);
        const updated = configs.map((c) =>
          c.id === chId ? { ...c, ...payload.updates } : c
        );
        setSetting("channel_configs", updated);
        logAudit(
          actorTag,
          payload.actionType || "CHANNEL_CONFIG",
          `CH-${String(chId).padStart(2, "0")}`,
          payload.detail || `채널 설정/영점보정 업데이트: ${JSON.stringify(payload.updates)}`
        );
        broadcast({ type: "SETTINGS_SYNC", payload: { channel_configs: updated } });
      } else if (type === "UPDATE_BANK_CONFIG") {
        const banks = getSetting("bank_configs", []);
        const updated = banks.map((b) =>
          b.id === payload.id ? { ...b, ...payload.updates } : b
        );
        setSetting("bank_configs", updated);
        logAudit(
          actorTag,
          "BANK_CONFIG",
          String(payload.id || "BANK"),
          payload.detail || `뱅크 설정 변경: ${JSON.stringify(payload.updates)}`
        );
        broadcast({ type: "SETTINGS_SYNC", payload: { bank_configs: updated } });
      } else if (type === "SAVE_FA_PRESET") {
        // 16) 현재 설정을 FA 표준값으로 저장
        const faObj = {
          savedAt: new Date().toISOString(),
          channelConfigs: getSetting("channel_configs", []),
          bankConfigs: getSetting("bank_configs", []),
        };
        setSetting("fa_preset", faObj);
        logAudit(actorTag, "FA_PRESET_SAVE", "ALL_CHANNELS_BANKS", "16) 현재 운전 및 채널 설정을 공장표준(FA)으로 저장");
        broadcast({ type: "SETTINGS_SYNC", payload: { fa_preset: faObj } });
      } else if (type === "RESTORE_FA_PRESET") {
        // 17) 영점 보정값(calibrationOffset)은 보존하면서 2~15번 운전 설정만 FA 표준값으로 복원
        const faPreset = getSetting("fa_preset", null);
        if (faPreset && faPreset.channelConfigs && faPreset.bankConfigs) {
          const currentChannels = getSetting("channel_configs", []);
          const restoredChannels = faPreset.channelConfigs.map((faCh, idx) => ({
            ...faCh,
            // 기존 각 채널의 정밀 영점 보정값(calibrationOffset)은 철저히 보존!
            calibrationOffset: Number(currentChannels[idx]?.calibrationOffset ?? 0.0),
          }));
          setSetting("channel_configs", restoredChannels);
          setSetting("bank_configs", faPreset.bankConfigs);
          logAudit(
            actorTag,
            "FA_PRESET_RESTORE",
            "ALL_CHANNELS_BANKS",
            "17) 영점 보정값(calibrationOffset) 보존 & 2~15번 운전 설정 FA 표준값 복원 완료"
          );
          broadcast({
            type: "SETTINGS_SYNC",
            payload: {
              channel_configs: restoredChannels,
              bank_configs: faPreset.bankConfigs,
            },
          });
        }
      } else if (type === "UPDATE_FLOORPLAN") {
        if (payload.floorplan_bg !== undefined) {
          setSetting("floorplan_bg", { dataUrl: payload.floorplan_bg });
        }
        if (payload.channel_configs) {
          setSetting("channel_configs", payload.channel_configs);
        }
        logAudit(actorTag, "FLOORPLAN_SYNC", "MAP", payload.detail || "공장 도면 핀 위치/배경 업데이트");
        broadcast({
          type: "SETTINGS_SYNC",
          payload: {
            floorplan_bg: getSetting("floorplan_bg", { dataUrl: "" }),
            channel_configs: getSetting("channel_configs", []),
          },
        });
      } else if (type === "SAVE_LEAK_TEST") {
        const chId = Number(payload.channelId);
        if (!isValidChannelId(chId)) return;
        const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
        db.prepare(`
          INSERT INTO leak_test_logs (timestamp, channel_id, gas_name, duration_sec, start_pressure, end_pressure, delta_pressure, threshold_bar, result, inspector)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ts,
          chId,
          payload.gasName,
          payload.durationSec,
          payload.startPressure,
          payload.endPressure,
          payload.deltaPressure,
          payload.thresholdBar ?? 0.2,
          payload.result,
          actorTag
        );
        logAudit(
          actorTag,
          "LEAK_TEST",
          `CH-${String(chId).padStart(2, "0")}`,
          `기밀 시험(${payload.durationSec}s) 판정: ${payload.result} (ΔP=${payload.deltaPressure} bar)`
        );
        broadcast({ type: "LEAK_TEST_SAVED", payload: { timestamp: ts, ...payload } });
      } else if (type === "TOWER_LAMP_MUTE_BUZZER") {
        const res = usbTowerLamp.muteBuzzer(
          payload?.mute !== undefined ? Boolean(payload.mute) : true
        );
        logAudit(
          `OPERATOR (${clientIp})`,
          "TOWER_LAMP_MUTE",
          "USB_TOWER_LAMP",
          "경광등 적색 점멸 유지 & 내장 부저만 음소거(OFF) 처리"
        );
        broadcast({ type: "TOWER_LAMP_SYNC", payload: res.state });
      } else if (type === "TOWER_LAMP_TEST") {
        const testState = usbTowerLamp.triggerTest(() => {
          const restored = usbTowerLamp.updateFromChannels(runtimeState.channels);
          broadcast({ type: "TOWER_LAMP_SYNC", payload: restored.state });
        });
        logAudit(
          actorTag,
          "TOWER_LAMP_TEST",
          "USB_TOWER_LAMP",
          "USB 3색 타워램프(적+황+녹+부저) 3초 전체 점등 테스트 실행"
        );
        broadcast({ type: "TOWER_LAMP_SYNC", payload: testState });
      } else if (type === "AUDIT_EVENT") {
        logAudit(
          `CLIENT (${clientIp})`,
          payload.actionType || "AUTH",
          payload.target || "SYSTEM",
          payload.detail || "클라이언트 이벤트"
        );
      }
    } catch (err) {
      console.error("[WS] 메시지 처리 오류:", err.message);
    }
  });
});

// 0.5초 주기 메인 폴링 루프 및 Fail-Safe 통신 감시 / 5초 주기 히스토리 로깅
let pollTick = 0;
let consecutivePollFailures = 0;
let commLostAlerted = false;

setInterval(async () => {
  pollTick += 1;
  try {
    const { pressures, valves, latencyMs } = await readPlcRegisters();
    const wasLost = commLostAlerted;
    consecutivePollFailures = 0;
    commLostAlerted = false;
    runtimeState.plcConnected = true;
    runtimeState.latencyMs = latencyMs;
    runtimeState.lastPollAt = new Date().toISOString();
    runtimeState.lastError = null;
    runtimeState.rawPressures = pressures;
    runtimeState.rawValves = valves;

    if (wasLost) {
      logAudit("SYSTEM", "PLC_COMM_RESTORED", "PLC-LAN", "현장 PLC 제어반 이더넷 통신 정상 복구됨");
      pushAlert({
        level: "INFO",
        code: "PLC_COMM_RESTORED",
        message: "✅ [통신 복구 완료] 현장 PLC 제어반과의 실시간 통신이 정상 복구되었습니다.",
      });
    }
  } catch (err) {
    consecutivePollFailures += 1;
    runtimeState.lastError = err.message;
    // 3회(1.5초) 연속 폴링 실패 시 통신 두절(Fail-Safe) 판정 -> 가짜 정상 표시 차단
    if (consecutivePollFailures >= 3) {
      runtimeState.plcConnected = false;
      if (!commLostAlerted) {
        commLostAlerted = true;
        const lostMsg = `🚨 [긴급 통신 두절] 현장 PLC(${PLC_IP}:${runtimeState.plcPort}) 응답 없음! 제어반 전원 및 차폐 랜선을 즉시 점검하세요.`;
        logAudit("SYSTEM", "PLC_COMM_LOST", "PLC-LAN", `${lostMsg} (${err.message})`);
        pushAlert({
          level: "DANGER",
          code: "PLC_COMM_LOST",
          message: lostMsg,
        });
      }
    }
  }

  const channelConfigs = getSetting("channel_configs", []);
  const bankConfigs = getSetting("bank_configs", []);

  const evaluatedChannels = evaluateChannels(
    runtimeState.rawPressures,
    runtimeState.rawValves,
    channelConfigs
  );

  // [Fail-Safe] PLC 통신이 살아 있을 때만 자동 절체 엔진 구동 (통신 끊김 중 오절체 원천 차단)
  const evaluatedBanks = runtimeState.plcConnected
    ? await evaluateBanksAndSwitch(
        bankConfigs,
        evaluatedChannels,
        writePlcValve,
        pushAlert
      )
    : bankConfigs;

  runtimeState.channels = evaluatedChannels;
  runtimeState.banks = evaluatedBanks;

  // 통신 두절 상태면 가짜 정상(녹색) 대신 강제 경보(DANGER) 모드로 USB 타워램프 구동
  const lampRes = runtimeState.plcConnected
    ? usbTowerLamp.updateFromChannels(evaluatedChannels)
    : usbTowerLamp.updateFromChannels([{ status: "DANGER" }]);
  if (lampRes.changed) {
    broadcast({ type: "TOWER_LAMP_SYNC", payload: lampRes.state });
  }

  // 0.5초마다 전 클라이언트에 실시간 브로드캐스트
  broadcast({
    type: "REALTIME_TICK",
    payload: {
      diagnostics: getNetworkDiagnostics(),
      towerLamp: lampRes.state,
      channels: evaluatedChannels,
      banks: evaluatedBanks,
    },
  });

  // [Fail-Safe] PLC 통신이 정상일 때만 5초(10 틱)마다 실제 측정치를 SQLite + CSV에 기록 (가짜 데이터 오염 방지)
  if (runtimeState.plcConnected && pollTick % 10 === 0) {
    recordChannelSnapshot(evaluatedChannels);
  }
}, 500);

startMaintenanceScheduler();

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  console.log("==================================================================");
  console.log(`🌐 [ACSC 중앙 브릿지 서버] HTTP REST & WebSocket 가동 완료 (Port: ${BRIDGE_PORT})`);
  console.log(`🔌 PLC 프로토콜: ${PLC_PROTOCOL} (${PLC_IP}:${runtimeState.plcPort})`);
  console.log(`💾 SQLite WAL DB: ${DB_PATH}`);
  console.log("==================================================================");
});

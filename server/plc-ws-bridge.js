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
const { evaluateChannels, evaluateBanksAndSwitch } = require("./lib/smart-ai-engine");
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

async function readPlcRegisters() {
  const startNs = process.hrtime.bigint();
  await ensurePlcConnected();

  if (PLC_PROTOCOL === "XGT") {
    // %MW100~%MW121 (22워드 압력), %MW200~%MW221 (22워드 밸브)
    const pressures = await xgtClient.readWords(100, CHANNEL_COUNT);
    const valves = await xgtClient.readWords(200, CHANNEL_COUNT);
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    return { pressures, valves, latencyMs: Number(elapsedMs.toFixed(2)) };
  } else {
    // Modbus Holding Register Offset 0~21 (22채널 압력), Offset 100~121 (22채널 밸브)
    const pRes = await modbusClient.readHoldingRegisters(0, CHANNEL_COUNT);
    const vRes = await modbusClient.readHoldingRegisters(100, CHANNEL_COUNT);
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
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

// HTTP REST API 서버 (Port 4000, CORS 허용)
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  const sendJson = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && pathname === "/api/diagnostics") {
    return sendJson(200, getNetworkDiagnostics());
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return sendJson(200, {
      channel_configs: getSetting("channel_configs", []),
      bank_configs: getSetting("bank_configs", []),
      fa_preset: getSetting("fa_preset", null),
      floorplan_bg: getSetting("floorplan_bg", { dataUrl: "" }),
      admin_pin: getSetting("admin_pin", "1234"),
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

wss.on("connection", (ws) => {
  // 최초 접속 시 현재 전체 상태 및 설정 즉시 전송
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
          admin_pin: getSetting("admin_pin", "1234"),
        },
      },
    })
  );

  ws.on("message", async (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      const { type, payload } = msg;

      if (type === "SET_VALVE") {
        const chId = Number(payload.channelId);
        const val = Number(payload.valveState) ? 1 : 0;
        await writePlcValve(chId - 1, val, payload.reason || "관리자 수동 제어");
        logAudit(
          payload.actor || "ADMIN",
          "VALVE_CONTROL",
          `CH-${String(chId).padStart(2, "0")}`,
          `밸브 ${val === 0 ? "개방(OPEN)" : "차단(SHUTOFF)"} 실행`
        );
      } else if (type === "UPDATE_CHANNEL_CONFIG") {
        const configs = getSetting("channel_configs", []);
        const updated = configs.map((c) =>
          c.id === payload.id ? { ...c, ...payload.updates } : c
        );
        setSetting("channel_configs", updated);
        logAudit(
          payload.actor || "ADMIN",
          payload.actionType || "CHANNEL_CONFIG",
          `CH-${String(payload.id).padStart(2, "0")}`,
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
          payload.actor || "ADMIN",
          "BANK_CONFIG",
          payload.id,
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
        logAudit("ADMIN", "FA_PRESET_SAVE", "ALL_CHANNELS_BANKS", "16) 현재 운전 및 채널 설정을 공장표준(FA)으로 저장");
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
            "ADMIN",
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
        logAudit("ADMIN", "FLOORPLAN_SYNC", "MAP", payload.detail || "공장 도면 핀 위치/배경 업데이트");
        broadcast({
          type: "SETTINGS_SYNC",
          payload: {
            floorplan_bg: getSetting("floorplan_bg", { dataUrl: "" }),
            channel_configs: getSetting("channel_configs", []),
          },
        });
      } else if (type === "SAVE_LEAK_TEST") {
        const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
        db.prepare(`
          INSERT INTO leak_test_logs (timestamp, channel_id, gas_name, duration_sec, start_pressure, end_pressure, delta_pressure, threshold_bar, result, inspector)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ts,
          payload.channelId,
          payload.gasName,
          payload.durationSec,
          payload.startPressure,
          payload.endPressure,
          payload.deltaPressure,
          payload.thresholdBar ?? 0.2,
          payload.result,
          payload.inspector || "ADMIN"
        );
        logAudit(
          "ADMIN",
          "LEAK_TEST",
          `CH-${String(payload.channelId).padStart(2, "0")}`,
          `기밀 시험(${payload.durationSec}s) 판정: ${payload.result} (ΔP=${payload.deltaPressure} bar)`
        );
        broadcast({ type: "LEAK_TEST_SAVED", payload: { timestamp: ts, ...payload } });
      } else if (type === "TOWER_LAMP_MUTE_BUZZER") {
        const res = usbTowerLamp.muteBuzzer(
          payload?.mute !== undefined ? Boolean(payload.mute) : true
        );
        logAudit(
          payload?.actor || "ADMIN",
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
          payload?.actor || "ADMIN",
          "TOWER_LAMP_TEST",
          "USB_TOWER_LAMP",
          "USB 3색 타워램프(적+황+녹+부저) 3초 전체 점등 테스트 실행"
        );
        broadcast({ type: "TOWER_LAMP_SYNC", payload: testState });
      } else if (type === "AUDIT_EVENT") {
        logAudit(
          payload.actor || "ADMIN",
          payload.actionType || "AUTH",
          payload.target || "SYSTEM",
          payload.detail || "관리자 인증 이벤트"
        );
      }
    } catch (err) {
      console.error("[WS] 메시지 처리 오류:", err.message);
    }
  });
});

// 0.5초 주기 메인 폴링 루프 및 5초 주기 히스토리 로깅
let pollTick = 0;
setInterval(async () => {
  pollTick += 1;
  try {
    const { pressures, valves, latencyMs } = await readPlcRegisters();
    runtimeState.plcConnected = true;
    runtimeState.latencyMs = latencyMs;
    runtimeState.lastPollAt = new Date().toISOString();
    runtimeState.lastError = null;
    runtimeState.rawPressures = pressures;
    runtimeState.rawValves = valves;
  } catch (err) {
    runtimeState.plcConnected = false;
    runtimeState.lastError = err.message;
  }

  const channelConfigs = getSetting("channel_configs", []);
  const bankConfigs = getSetting("bank_configs", []);

  const evaluatedChannels = evaluateChannels(
    runtimeState.rawPressures,
    runtimeState.rawValves,
    channelConfigs
  );
  const evaluatedBanks = await evaluateBanksAndSwitch(
    bankConfigs,
    evaluatedChannels,
    writePlcValve,
    pushAlert
  );

  runtimeState.channels = evaluatedChannels;
  runtimeState.banks = evaluatedBanks;

  // 22채널 실시간 상태에 따른 USB 3색 타워램프(경광등) 상태 업데이트 및 동기화
  const lampRes = usbTowerLamp.updateFromChannels(evaluatedChannels);
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

  // 5초(10 틱)마다 SQLite channel_logs + 일자별 CSV 기록
  if (pollTick % 10 === 0) {
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

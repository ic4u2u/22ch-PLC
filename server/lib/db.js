/**
 * 파일명: server/lib/db.js
 * 역할: SQLite (logs/acsc_history.db, WAL 모드) 5대 테이블 초기화 및 22채널(11뱅크) 설정/이력 관리 모듈
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const LOGS_DIR = path.join(process.cwd(), "logs");
const BACKUP_DIR = path.join(LOGS_DIR, "backups");
const DB_PATH = path.join(LOGS_DIR, "acsc_history.db");

const CHANNEL_COUNT = 22;
const BANK_COUNT = 11;

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = new Database(DB_PATH);
// 고성능 동시 읽기/쓰기를 위한 WAL(Write-Ahead Logging) 모드 활성화
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// 11뱅크(22채널) 특수가스 기본 구성 프리셋 생성 함수
const GAS_LIST = [
  { name: "H2 (수소)", code: "H2", color: "#ef4444" },
  { name: "SiH4 (모노실란)", code: "SiH4", color: "#f97316" },
  { name: "NH3 (암모니아)", code: "NH3", color: "#eab308" },
  { name: "NF3 (삼불화질소)", code: "NF3", color: "#84cc16" },
  { name: "Cl2 (염소)", code: "Cl2", color: "#10b981" },
  { name: "BCl3 (삼염화붕소)", code: "BCl3", color: "#14b8a6" },
  { name: "CF4 (사불화탄소)", code: "CF4", color: "#06b6d4" },
  { name: "SF6 (육불화황)", code: "SF6", color: "#0ea5e9" },
  { name: "N2O (아산화질소)", code: "N2O", color: "#3b82f6" },
  { name: "PH3 (포스핀)", code: "PH3", color: "#6366f1" },
  { name: "Ar (고순도 아르곤)", code: "Ar", color: "#8b5cf6" },
];

function createDefaultChannelConfigs() {
  return Array.from({ length: CHANNEL_COUNT }, (_, idx) => {
    const chId = idx + 1;
    const bankIdx = Math.floor(idx / 2);
    const side = idx % 2 === 0 ? "A" : "B";
    const gas = GAS_LIST[bankIdx];
    const col = idx % 6;
    const row = Math.floor(idx / 6);
    return {
      id: chId,
      bankId: `BANK-${String(bankIdx + 1).padStart(2, "0")}`,
      side,
      name: `CH-${String(chId).padStart(2, "0")} [${side}]`,
      gasName: gas.name,
      gasCode: gas.code,
      color: gas.color,
      maxBar: 150.0,
      warnBar: 35.0,
      dangerBar: 15.0,
      calibrationOffset: 0.0,
      pinX: 12 + col * 15,
      pinY: 20 + row * 20,
    };
  });
}

function createDefaultBankConfigs() {
  return Array.from({ length: BANK_COUNT }, (_, idx) => {
    const bankNum = idx + 1;
    const gas = GAS_LIST[idx];
    return {
      id: `BANK-${String(bankNum).padStart(2, "0")}`,
      bankNumber: bankNum,
      gasName: gas.name,
      gasCode: gas.code,
      chA: idx * 2 + 1,
      chB: idx * 2 + 2,
      activeSide: "A", // 현재 주 공급 실린더 ("A" 또는 "B")
      mode: 1, // 0: Auto, 1: Smart AI (기본), 2: Dual, 3: Moni
      switchPressureBar: 20.0, // 교체(절체) 기준 압력 (bar)
      hysteresisBar: 3.0, // Standby 유효 판정 히스테리시스 (3 bar)
      warnPressureBar: 35.0, // 주의 기준 압력 (bar)
      runTimeSec: 5.0, // RUN Time (4.0 ~ 6.0s, 0.1단위)
      mxFixedSec: 2.5, // Auto 모드 고정 지연시간 MX (초)
      computedAiN: 1.8, // Smart AI 실시간 산출 지연시간 N (초)
      outputVoltage: 13.5, // 밸브 구동 출력전압 (12.0 ~ 15.0V, 0.1단위)
    };
  });
}

// 마이그레이션 SQL 실행 및 22채널(11뱅크) 자동 마이그레이션/시딩
function initDatabase() {
  const migrationFile = path.join(
    process.cwd(),
    "db",
    "migrations",
    "001_init_acsc_schema.sql"
  );
  if (fs.existsSync(migrationFile)) {
    const sql = fs.readFileSync(migrationFile, "utf8");
    db.exec(sql);
  }

  const defaultChannels = createDefaultChannelConfigs();
  const defaultBanks = createDefaultBankConfigs();

  const getSettingStmt = db.prepare(
    "SELECT value FROM system_settings WHERE key = ? AND is_deleted = 0"
  );
  const upsertSettingStmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at, is_deleted)
    VALUES (?, ?, datetime('now', 'localtime'), 0)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now', 'localtime'),
      is_deleted = 0
  `);

  const existingChRow = getSettingStmt.get("channel_configs");
  let needResetTo22 = !existingChRow;
  if (existingChRow) {
    try {
      const parsed = JSON.parse(existingChRow.value);
      if (!Array.isArray(parsed) || parsed.length !== CHANNEL_COUNT) {
        needResetTo22 = true;
      }
    } catch {
      needResetTo22 = true;
    }
  }

  if (needResetTo22) {
    upsertSettingStmt.run("channel_configs", JSON.stringify(defaultChannels));
    upsertSettingStmt.run("bank_configs", JSON.stringify(defaultBanks));
    upsertSettingStmt.run(
      "fa_preset",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        channelConfigs: defaultChannels,
        bankConfigs: defaultBanks,
      })
    );
  } else {
    if (!getSettingStmt.get("bank_configs")) {
      upsertSettingStmt.run("bank_configs", JSON.stringify(defaultBanks));
    }
    if (!getSettingStmt.get("fa_preset")) {
      upsertSettingStmt.run(
        "fa_preset",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          channelConfigs: defaultChannels,
          bankConfigs: defaultBanks,
        })
      );
    }
  }

  if (!getSettingStmt.get("floorplan_bg")) {
    upsertSettingStmt.run("floorplan_bg", JSON.stringify({ dataUrl: "" }));
  }
  if (!getSettingStmt.get("admin_pin")) {
    upsertSettingStmt.run("admin_pin", JSON.stringify("1234"));
  }

  // 초기 목업(Mock) 이력 데이터 시딩 (빈 화면 방지 및 즉시 시연 지원)
  const auditCount = db.prepare("SELECT COUNT(*) as cnt FROM audit_logs").get().cnt;
  if (auditCount === 0) {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const ts = now.toISOString().replace("T", " ").slice(0, 19);

    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (timestamp, actor, action_type, target, detail)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAudit.run(ts, "SYSTEM", "BOOT", "ACSC-SERVER", "ACSC 22채널 스마트 관제 브릿지 서버 및 SQLite WAL 엔진 기동 완료");
    insertAudit.run(ts, "SMART-AI", "MODE_INIT", "BANK-01~11", "11뱅크 Smart AI 밸브 스위칭 엔진 활성화 (Hysteresis: 3.0 bar)");

    const insertRep = db.prepare(`
      INSERT INTO cylinder_replacements (timestamp, year_month, channel_id, gas_name, prev_pressure, new_pressure, delta_pressure)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertRep.run(ts, ym, 1, "H2 (수소)", 7.2, 149.8, 142.6);
    insertRep.run(ts, ym, 3, "SiH4 (모노실란)", 9.5, 148.0, 138.5);

    const insertLeak = db.prepare(`
      INSERT INTO leak_test_logs (timestamp, channel_id, gas_name, duration_sec, start_pressure, end_pressure, delta_pressure, threshold_bar, result, inspector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLeak.run(ts, 1, "H2 (수소)", 60, 120.0, 119.9, 0.1, 0.2, "PASS", "ADMIN");
  }
}

initDatabase();

function getSetting(key, fallback = null) {
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = ? AND is_deleted = 0")
    .get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function setSetting(key, valueObj) {
  const payload = typeof valueObj === "string" ? valueObj : JSON.stringify(valueObj);
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at, is_deleted)
    VALUES (?, ?, datetime('now', 'localtime'), 0)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now', 'localtime'),
      is_deleted = 0
  `).run(key, payload);
}

function logAudit(actor, actionType, target, detail) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare(`
    INSERT INTO audit_logs (timestamp, actor, action_type, target, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(ts, actor, actionType, detail ? target : "SYSTEM", detail || "");
}

module.exports = {
  db,
  DB_PATH,
  LOGS_DIR,
  BACKUP_DIR,
  CHANNEL_COUNT,
  BANK_COUNT,
  getSetting,
  setSetting,
  logAudit,
  createDefaultChannelConfigs,
  createDefaultBankConfigs,
};

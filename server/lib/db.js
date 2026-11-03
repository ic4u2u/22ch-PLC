/**
 * 파일명: server/lib/db.js
 * 역할: SQLite (logs/acsc_history.db, WAL 모드) 5대 테이블 초기화 및 22채널(11뱅크) 설정/이력 관리 모듈
 *       (현장 도면 반영: 가스캐비넷 5뱅크[10통] + 오토체인지 6뱅크[12통] = 총 11뱅크/22실린더)
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

// 11뱅크(22채널) 특수가스 실제 현장 구성 프리셋 (가스캐비넷 5CH + 오토체인지 6CH)
const GAS_LIST = [
  // [구역 1] 하단 가스저장소 (CABINET 5CH = 10 실린더)
  {
    name: "P-CH4 [CH4(N5)] 고순도메탄",
    code: "P-CH4(N5)",
    color: "#ef4444",
    pinAX: 15,
    pinAY: 78,
    pinBX: 22,
    pinBY: 78,
  },
  {
    name: "G-CH4 [CH4(N35)] 일반메탄",
    code: "G-CH4(N35)",
    color: "#f97316",
    pinAX: 30,
    pinAY: 78,
    pinBX: 37,
    pinBY: 78,
  },
  {
    name: "P-H2 [H2(N5)] 고순도수소",
    code: "P-H2(N5)",
    color: "#eab308",
    pinAX: 45,
    pinAY: 78,
    pinBX: 52,
    pinBY: 78,
  },
  {
    name: "MIX(Ar+H2) 혼합가스",
    code: "MIX(Ar+H2)",
    color: "#84cc16",
    pinAX: 60,
    pinAY: 78,
    pinBX: 67,
    pinBY: 78,
  },
  {
    name: "C2H2 [C2H2(N5)] 아세틸렌",
    code: "C2H2(N5)",
    color: "#ec4899",
    pinAX: 75,
    pinAY: 78,
    pinBX: 82,
    pinBY: 78,
  },
  // [구역 2] 상단 벽면 오토체인지 (자동절체기 5세트 = 10 실린더)
  {
    name: "P-N2 [N2(N5)] 고순도질소",
    code: "P-N2(N5)",
    color: "#10b981",
    pinAX: 27,
    pinAY: 43,
    pinBX: 34,
    pinBY: 43,
  },
  {
    name: "G-N2 [N2(N35)] 일반질소",
    code: "G-N2(N35)",
    color: "#14b8a6",
    pinAX: 41,
    pinAY: 43,
    pinBX: 48,
    pinBY: 43,
  },
  {
    name: "He [He(N5)] 고순도헬륨",
    code: "He(N5)",
    color: "#06b6d4",
    pinAX: 55,
    pinAY: 43,
    pinBX: 62,
    pinBY: 43,
  },
  {
    name: "Ar [Ar(N5)] 고순도아르곤",
    code: "Ar(N5)",
    color: "#3b82f6",
    pinAX: 69,
    pinAY: 43,
    pinBX: 76,
    pinBY: 43,
  },
  {
    name: "O2 [O2(N5)] 고순도산소",
    code: "O2(N5)",
    color: "#6366f1",
    pinAX: 83,
    pinAY: 43,
    pinBX: 90,
    pinBY: 43,
  },
  // [구역 3] 좌상단 별도 H2 저장소 (오토체인지 6번째 세트 = 2 실린더)
  {
    name: "G-H2 [H2(N35)] 일반수소",
    code: "G-H2(N35)",
    color: "#a855f7",
    pinAX: 20,
    pinAY: 16,
    pinBX: 30,
    pinBY: 16,
  },
];

function createDefaultChannelConfigs() {
  return Array.from({ length: CHANNEL_COUNT }, (_, idx) => {
    const chId = idx + 1;
    const bankIdx = Math.floor(idx / 2);
    const side = idx % 2 === 0 ? "A" : "B";
    const gas = GAS_LIST[bankIdx];
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
      pinX: side === "A" ? gas.pinAX : gas.pinBX,
      pinY: side === "A" ? gas.pinAY : gas.pinBY,
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
      // 22채널이 아니거나 이전 임시 가스명(SiH4 등)으로 되어 있으면 현장 도면 가스명으로 자동 업데이트
      if (
        !Array.isArray(parsed) ||
        parsed.length !== CHANNEL_COUNT ||
        (parsed[0] && parsed[0].gasCode === "H2")
      ) {
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
    insertAudit.run(ts, "SMART-AI", "MODE_INIT", "BANK-01~11", "11뱅크(가스캐비넷 5CH + 오토체인지 6CH) Smart AI 스위칭 엔진 활성화");

    const insertRep = db.prepare(`
      INSERT INTO cylinder_replacements (timestamp, year_month, channel_id, gas_name, prev_pressure, new_pressure, delta_pressure)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertRep.run(ts, ym, 1, "P-CH4 [CH4(N5)] 고순도메탄", 7.2, 149.8, 142.6);
    insertRep.run(ts, ym, 11, "P-N2 [N2(N5)] 고순도질소", 9.5, 148.0, 138.5);

    const insertLeak = db.prepare(`
      INSERT INTO leak_test_logs (timestamp, channel_id, gas_name, duration_sec, start_pressure, end_pressure, delta_pressure, threshold_bar, result, inspector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLeak.run(ts, 1, "P-CH4 [CH4(N5)] 고순도메탄", 60, 120.0, 119.9, 0.1, 0.2, "PASS", "ADMIN");
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

/**
 * 파일명: server/lib/backup-logger.js
 * 역할:
 *  1) 5초 주기 24채널 압력/밸브 SQLite(channel_logs) 저장 및 일자별 CSV(UTF-8 BOM) 자동 기록
 *  2) 텔레그램 푸시 알림 발송 (사내 공유기 LAN 2 경유)
 *  3) 24시간 주기 SQLite 무중단 온라인 백업 (db.backup())
 *  4) 30일 경과 일자별 CSV 파일 자동 .gz 압축 스케줄러
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const https = require("https");
const { db, LOGS_DIR, BACKUP_DIR, logAudit } = require("./db");

const insertChannelLogStmt = db.prepare(`
  INSERT INTO channel_logs (timestamp, pressures_json, valves_json, is_deleted)
  VALUES (?, ?, ?, 0)
`);

/**
 * 5초 주기로 24채널 압력 및 밸브 상태를 SQLite와 일자별 CSV(UTF-8 BOM)에 기록
 * @param {Array} evaluatedChannels 24채널 평가 데이터
 */
function recordChannelSnapshot(evaluatedChannels) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const tsStr = now.toISOString().replace("T", " ").slice(0, 19);

  const pressures = evaluatedChannels.map((ch) => ch.pressureBar);
  const valves = evaluatedChannels.map((ch) => ch.valveState);

  // 1. SQLite channel_logs 기록
  insertChannelLogStmt.run(
    tsStr,
    JSON.stringify(pressures),
    JSON.stringify(valves)
  );

  // 2. 일자별 CSV (logs/acsc_24ch_YYYY-MM-DD.csv, UTF-8 BOM) 기록
  const csvPath = path.join(LOGS_DIR, `acsc_24ch_${dateStr}.csv`);
  const exists = fs.existsSync(csvPath);

  if (!exists) {
    const headers = [
      "Timestamp",
      ...Array.from({ length: 24 }, (_, i) => `CH${String(i + 1).padStart(2, "0")}_Bar`),
      ...Array.from({ length: 24 }, (_, i) => `CH${String(i + 1).padStart(2, "0")}_Valve`),
    ];
    // 엑셀 한글/숫자 깨짐 방지를 위한 UTF-8 BOM (\uFEFF) 추가
    fs.writeFileSync(csvPath, "\uFEFF" + headers.join(",") + "\r\n", "utf8");
  }

  const row = [tsStr, ...pressures, ...valves].join(",") + "\r\n";
  fs.appendFileSync(csvPath, row, "utf8");
}

/**
 * 텔레그램 푸시 알림 전송 (LAN 2 사내 공유기 인터넷 경유)
 * @param {string} message 알림 메시지
 */
function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // 토큰 미설정 시 콘솔 안내만 출력하고 정상 진행
    return;
  }

  const payload = JSON.stringify({
    chat_id: chatId,
    text: `🚨 [ACSC 24채널 특수가스 관제 알림]\n${message}`,
  });

  const req = https.request(
    {
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 4000,
    },
    (res) => {
      res.on("data", () => {});
    }
  );

  req.on("error", (err) => {
    console.warn("[TELEGRAM] 알림 전송 실패:", err.message);
  });

  req.write(payload);
  req.end();
}

/**
 * SQLite 무중단 온라인 백업 (better-sqlite3 db.backup API 활용)
 * 및 30일 경과 CSV 자동 .gz 압축
 */
async function runMaintenanceBackupAndCompress() {
  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `acsc_history_backup_${dateStr}.db`);

    await db.backup(backupFile);
    logAudit(
      "SCHEDULER",
      "DB_BACKUP",
      "SQLITE_WAL",
      `무중단 온라인 DB 백업 완료: ${path.basename(backupFile)}`
    );

    // 30일 경과 CSV 파일 자동 .gz 압축
    const files = fs.readdirSync(LOGS_DIR);
    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith("acsc_24ch_") && file.endsWith(".csv")) {
        const fullPath = path.join(LOGS_DIR, file);
        const stat = fs.statSync(fullPath);
        if (nowMs - stat.mtimeMs >= thirtyDaysMs) {
          const gzPath = `${fullPath}.gz`;
          if (!fs.existsSync(gzPath)) {
            const rawContent = fs.readFileSync(fullPath);
            const compressed = zlib.gzipSync(rawContent);
            fs.writeFileSync(gzPath, compressed);
            logAudit(
              "SCHEDULER",
              "CSV_COMPRESS",
              file,
              `30일 경과 CSV 로그 자동 GZIP 압축 완료 (${file}.gz)`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[BACKUP-SCHEDULER] 백업/압축 중 오류:", err.message);
  }
}

/**
 * 24시간 주기 무중단 백업 및 30일 경과 CSV 압축 스케줄러 시작
 */
function startMaintenanceScheduler() {
  // 서버 기동 10초 후 최초 1회 무중단 백업 점검 수행, 이후 24시간마다 반복
  setTimeout(() => {
    runMaintenanceBackupAndCompress();
  }, 10000);

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runMaintenanceBackupAndCompress();
  }, TWENTY_FOUR_HOURS);
}

module.exports = {
  recordChannelSnapshot,
  sendTelegramAlert,
  runMaintenanceBackupAndCompress,
  startMaintenanceScheduler,
};

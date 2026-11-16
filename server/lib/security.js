/**
 * 파일명: server/lib/security.js
 * 역할:
 *  1) 관리자 PIN 단방향 솔트 암호화 해싱(crypto.scrypt) 및 타이밍 공격 방어 검증
 *  2) IP 기반 무차별 대입(Brute-force) 방어 (5회 연속 오입력 시 60초간 인증 차단)
 *  3) HMAC-SHA256 서명 기반 5분(300초) 유효 세션 토큰 발급·검증·즉시 폐기
 *  4) 채널 ID(1~22) 및 제어 파라미터 유효성 검증 헬퍼
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { db, LOGS_DIR, CHANNEL_COUNT, logAudit } = require("./db");

const SESSION_TTL_MS = 5 * 60 * 1000; // 5분(300초) 자동 만료
const MAX_PIN_ATTEMPTS = 5; // 최대 연속 실패 허용 횟수
const LOCKOUT_DURATION_MS = 60 * 1000; // 5회 실패 시 60초 잠금
const SECRET_FILE_PATH = path.join(LOGS_DIR, ".auth_secret");

// 폐기(로그아웃)된 토큰 블랙리스트 (만료 시간까지만 메모리 보관)
const revokedTokens = new Map();

/**
 * 서명용 시크릿 키 로드 (환경변수 우선 -> 없으면 logs/.auth_secret에 난수 생성·격리)
 */
function loadOrCreateAuthSecret() {
  if (process.env.ACSC_AUTH_SECRET && process.env.ACSC_AUTH_SECRET.length >= 16) {
    return process.env.ACSC_AUTH_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE_PATH)) {
      const saved = fs.readFileSync(SECRET_FILE_PATH, "utf8").trim();
      if (saved.length >= 32) return saved;
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE_PATH, generated, { encoding: "utf8", mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString("hex");
  }
}

const AUTH_SECRET = loadOrCreateAuthSecret();

/**
 * PIN 번호 단방향 암호화 해싱 (scrypt + 16바이트 랜덤 솔트)
 */
function hashPin(plainPin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(plainPin), salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

/**
 * 입력된 PIN과 저장된 단방향 해시 비교 (타이밍 공격 방지 timingSafeEqual 적용)
 */
function verifyPinHash(plainPin, storedHash) {
  if (!plainPin || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const derivedBuf = crypto.scryptSync(String(plainPin), salt, 64);
  const storedBuf = Buffer.from(hashHex, "hex");
  if (derivedBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, storedBuf);
}

/**
 * 서버 기동 시 기존 평문 admin_pin을 단방향 해시(admin_pin_hash)로 안전 마이그레이션
 */
function ensureHashedPinInitialized() {
  const getStmt = db.prepare(
    "SELECT value FROM system_settings WHERE key = ? AND is_deleted = 0"
  );
  const upsertStmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at, is_deleted)
    VALUES (?, ?, datetime('now', 'localtime'), 0)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now', 'localtime'),
      is_deleted = 0
  `);

  const hashRow = getStmt.get("admin_pin_hash");
  const legacyRow = getStmt.get("admin_pin");

  if (!hashRow) {
    let initialPin = process.env.INITIAL_ADMIN_PIN || "1234";
    if (legacyRow) {
      try {
        const parsed = JSON.parse(legacyRow.value);
        if (typeof parsed === "string" && /^\d{4,6}$/.test(parsed)) {
          initialPin = parsed;
        }
      } catch {}
    }
    upsertStmt.run("admin_pin_hash", JSON.stringify(hashPin(initialPin)));
    upsertStmt.run("admin_pin_is_default", JSON.stringify(initialPin === "1234"));
  }

  // 기존 평문 admin_pin 레코드는 Soft Delete(is_deleted = 1) 및 빈 값 처리하여 평문 잔존 제거
  if (legacyRow) {
    db.prepare(`
      UPDATE system_settings
      SET value = '""', is_deleted = 1, updated_at = datetime('now', 'localtime')
      WHERE key = 'admin_pin'
    `).run();
  }
}

ensureHashedPinInitialized();

function isUsingDefaultPin() {
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = 'admin_pin_is_default' AND is_deleted = 0")
    .get();
  if (!row) return false;
  try {
    return Boolean(JSON.parse(row.value));
  } catch {
    return false;
  }
}

/**
 * 클라이언트 접속 IP 정규화 추출
 */
function extractClientIp(req) {
  const xff = req?.headers?.["x-forwarded-for"];
  const raw =
    (typeof xff === "string" ? xff.split(",")[0].trim() : null) ||
    req?.socket?.remoteAddress ||
    "unknown";
  return raw.replace(/^::ffff:/, "");
}

/**
 * IP 잠금 여부 조회 및 인증 검증
 */
function authenticatePin(inputPin, clientIp) {
  const nowMs = Date.now();
  const lockRow = db
    .prepare("SELECT fail_count, locked_until_ms FROM auth_attempt_locks WHERE client_ip = ? AND is_deleted = 0")
    .get(clientIp);

  if (lockRow && lockRow.locked_until_ms > nowMs) {
    const remainSec = Math.ceil((lockRow.locked_until_ms - nowMs) / 1000);
    return {
      ok: false,
      locked: true,
      remainSec,
      message: `PIN 연속 오입력으로 잠겼습니다. ${remainSec}초 후 다시 시도하세요.`,
    };
  }

  const hashRow = db
    .prepare("SELECT value FROM system_settings WHERE key = 'admin_pin_hash' AND is_deleted = 0")
    .get();
  const storedHash = hashRow ? JSON.parse(hashRow.value) : "";

  if (!verifyPinHash(String(inputPin || ""), storedHash)) {
    const prevFails = lockRow && lockRow.locked_until_ms <= nowMs && lockRow.fail_count >= MAX_PIN_ATTEMPTS
      ? 0
      : (lockRow?.fail_count || 0);
    const nextFails = prevFails + 1;
    const lockedUntil = nextFails >= MAX_PIN_ATTEMPTS ? nowMs + LOCKOUT_DURATION_MS : 0;

    db.prepare(`
      INSERT INTO auth_attempt_locks (client_ip, fail_count, locked_until_ms, updated_at, is_deleted)
      VALUES (?, ?, ?, datetime('now', 'localtime'), 0)
      ON CONFLICT(client_ip) DO UPDATE SET
        fail_count = excluded.fail_count,
        locked_until_ms = excluded.locked_until_ms,
        updated_at = datetime('now', 'localtime'),
        is_deleted = 0
    `).run(clientIp, nextFails, lockedUntil);

    logAudit(
      `GUEST (${clientIp})`,
      lockedUntil > 0 ? "PIN_LOCKOUT" : "PIN_FAIL",
      "AUTH",
      lockedUntil > 0
        ? `PIN ${MAX_PIN_ATTEMPTS}회 연속 실패로 60초간 접속 차단됨`
        : `관리자 PIN 인증 실패 (${nextFails}/${MAX_PIN_ATTEMPTS}회)`
    );

    if (lockedUntil > 0) {
      return {
        ok: false,
        locked: true,
        remainSec: 60,
        message: "PIN 5회 연속 오입력으로 60초간 잠금 처리되었습니다.",
      };
    }

    return {
      ok: false,
      locked: false,
      remainingAttempts: MAX_PIN_ATTEMPTS - nextFails,
      message: `PIN 번호가 일치하지 않습니다. (남은 기회: ${MAX_PIN_ATTEMPTS - nextFails}회)`,
    };
  }

  // 인증 성공 시 실패 카운트 초기화 및 서명 토큰 발급
  db.prepare(`
    INSERT INTO auth_attempt_locks (client_ip, fail_count, locked_until_ms, updated_at, is_deleted)
    VALUES (?, 0, 0, datetime('now', 'localtime'), 0)
    ON CONFLICT(client_ip) DO UPDATE SET
      fail_count = 0, locked_until_ms = 0, updated_at = datetime('now', 'localtime'), is_deleted = 0
  `).run(clientIp);

  const token = issueAdminToken(clientIp);
  logAudit(`ADMIN (${clientIp})`, "PIN_UNLOCK", "AUTH", "관리자 PIN 인증 성공 (5분 세션 발급)");

  return {
    ok: true,
    token,
    expiresInSec: Math.floor(SESSION_TTL_MS / 1000),
    isDefaultPin: isUsingDefaultPin(),
  };
}

function issueAdminToken(clientIp) {
  const payloadObj = {
    ip: clientIp,
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(12).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return { valid: false };
  const [payloadB64, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return { valid: false };
    if (revokedTokens.has(payload.jti)) return { valid: false };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function revokeAdminToken(token) {
  const res = verifyAdminToken(token);
  if (res.valid && res.payload?.jti) {
    revokedTokens.set(res.payload.jti, res.payload.exp);
    // 만료된 블랙리스트 항목 정리
    const now = Date.now();
    for (const [k, exp] of revokedTokens.entries()) {
      if (exp < now) revokedTokens.delete(k);
    }
  }
}

function changeAdminPin(currentPin, newPin, clientIp) {
  if (!/^\d{4,6}$/.test(String(newPin || ""))) {
    return { ok: false, message: "새 PIN 번호는 4~6자리 숫자로 입력해 주세요." };
  }
  const authRes = authenticatePin(currentPin, clientIp);
  if (!authRes.ok) {
    return { ok: false, message: authRes.message };
  }
  const newHash = hashPin(String(newPin));
  const upsertStmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at, is_deleted)
    VALUES (?, ?, datetime('now', 'localtime'), 0)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value, updated_at = datetime('now', 'localtime'), is_deleted = 0
  `);
  upsertStmt.run("admin_pin_hash", JSON.stringify(newHash));
  upsertStmt.run("admin_pin_is_default", JSON.stringify(String(newPin) === "1234"));
  logAudit(`ADMIN (${clientIp})`, "PIN_CHANGED", "AUTH", "관리자 PIN 비밀번호 단방향 암호화 변경 완료");
  return { ok: true, isDefaultPin: String(newPin) === "1234", token: authRes.token, expiresInSec: authRes.expiresInSec };
}

function isValidChannelId(chId) {
  return Number.isInteger(chId) && chId >= 1 && chId <= CHANNEL_COUNT;
}

module.exports = {
  extractClientIp,
  authenticatePin,
  verifyAdminToken,
  revokeAdminToken,
  changeAdminPin,
  isUsingDefaultPin,
  isValidChannelId,
};

-- =============================================================================
-- 파일명: 001_init_acsc_schema.sql
-- 설명: ACSC 24채널 특수가스 스마트 관제 시스템 초기 테이블 생성 마이그레이션
-- 주의: DROP TABLE 절대 금지 (데이터 보존 및 Soft Delete 'is_deleted' 컬럼 기본 적용)
-- 보안: 클라우드/PostgreSQL 확장 시 각 테이블에 RLS(Row Level Security) 정책 기본 적용 전제
-- =============================================================================

-- 1. 시스템 설정 테이블 (channel_configs, bank_configs, fa_preset, floorplan_bg, admin_pin)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  is_deleted INTEGER DEFAULT 0
);

-- 2. 24채널 압력 이력 테이블 (5초 주기 기록)
CREATE TABLE IF NOT EXISTS channel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  pressures_json TEXT NOT NULL,
  valves_json TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_channel_logs_timestamp ON channel_logs(timestamp);

-- 3. 관리자 조작 및 Smart AI 절체 감사 로그 테이블 (Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 4. 실린더 자동 교체 및 월간 소모량 집계 테이블
CREATE TABLE IF NOT EXISTS cylinder_replacements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  year_month TEXT NOT NULL,
  channel_id INTEGER NOT NULL,
  gas_name TEXT NOT NULL,
  prev_pressure REAL NOT NULL,
  new_pressure REAL NOT NULL,
  delta_pressure REAL NOT NULL,
  is_deleted INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_replacements_ym ON cylinder_replacements(year_month);

-- 5. 배관 기밀/누출 시험(PASS/FAIL) 성적서 영구 기록 테이블
CREATE TABLE IF NOT EXISTS leak_test_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  channel_id INTEGER NOT NULL,
  gas_name TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  start_pressure REAL NOT NULL,
  end_pressure REAL NOT NULL,
  delta_pressure REAL NOT NULL,
  threshold_bar REAL NOT NULL,
  result TEXT NOT NULL,
  inspector TEXT DEFAULT 'ADMIN',
  is_deleted INTEGER DEFAULT 0
);

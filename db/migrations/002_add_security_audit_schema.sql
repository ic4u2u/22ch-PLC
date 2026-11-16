-- =============================================================================
-- 파일명: 002_add_security_audit_schema.sql
-- 설명: 관리자 PIN 오입력 브루트포스 차단(Lockout) 이력 및 보안 세션 감사 테이블 추가
-- 주의: DROP TABLE 절대 금지, 물리적 DELETE 대신 Soft Delete(is_deleted) 기본 적용
-- 보안: 클라우드/PostgreSQL(Supabase) 이관 시 관리자 전용 RLS(Row Level Security) 정책 필수 적용 전제
-- =============================================================================

-- 1. IP별 인증 시도 및 잠금 상태 관리 테이블 (5회 연속 실패 시 60초 잠금)
CREATE TABLE IF NOT EXISTS auth_attempt_locks (
  client_ip TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  is_deleted INTEGER DEFAULT 0
);

-- 2. 보안 이벤트 전용 로그 인덱스 보강 (기존 audit_logs 조회 속도 향상)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);

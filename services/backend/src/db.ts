import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "smartcar.db");

const db: DatabaseType = new Database(DB_PATH);

// WAL 모드: 읽기/쓰기 동시성 향상
db.pragma("journal_mode = WAL");

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS uploaded_files (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    language    TEXT,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analysis_results (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL DEFAULT '',
    module          TEXT NOT NULL,
    status          TEXT NOT NULL,
    vulnerabilities TEXT NOT NULL,   -- JSON
    summary         TEXT NOT NULL,   -- JSON
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rules (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL DEFAULT '',
    suggestion  TEXT NOT NULL DEFAULT '',
    pattern     TEXT NOT NULL DEFAULT '',
    fix_code    TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    built_in    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 기존 DB 마이그레이션
try { db.exec(`ALTER TABLE analysis_results ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE uploaded_files ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE uploaded_files ADD COLUMN path TEXT NOT NULL DEFAULT ''`); } catch {}

// 인덱스 (마이그레이션 이후)
db.exec(`CREATE INDEX IF NOT EXISTS idx_uploaded_files_project ON uploaded_files(project_id)`);

// 동적 분석 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS dynamic_analysis_sessions (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'connected',
    source        TEXT NOT NULL DEFAULT '{}',
    message_count INTEGER NOT NULL DEFAULT 0,
    alert_count   INTEGER NOT NULL DEFAULT 0,
    started_at    TEXT NOT NULL,
    ended_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS dynamic_analysis_alerts (
    id               TEXT PRIMARY KEY,
    session_id       TEXT NOT NULL,
    severity         TEXT NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    llm_analysis     TEXT,
    related_messages TEXT NOT NULL DEFAULT '[]',
    detected_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dynamic_analysis_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    can_id      TEXT NOT NULL,
    dlc         INTEGER NOT NULL,
    data        TEXT NOT NULL,
    flagged     INTEGER NOT NULL DEFAULT 0
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_dyn_sessions_project ON dynamic_analysis_sessions(project_id);
  CREATE INDEX IF NOT EXISTS idx_dyn_alerts_session ON dynamic_analysis_alerts(session_id);
  CREATE INDEX IF NOT EXISTS idx_dyn_messages_session ON dynamic_analysis_messages(session_id);
`);

// 동적 분석 세션 마이그레이션
try { db.exec(`ALTER TABLE dynamic_analysis_sessions ADD COLUMN source TEXT NOT NULL DEFAULT '{}'`); } catch {}

// 동적 분석 메시지 injected 컬럼 마이그레이션
try { db.exec(`ALTER TABLE dynamic_analysis_messages ADD COLUMN injected INTEGER NOT NULL DEFAULT 0`); } catch {}

// 정적 분석 warnings 마이그레이션
try { db.exec(`ALTER TABLE analysis_results ADD COLUMN warnings TEXT NOT NULL DEFAULT '[]'`); } catch {}
// 분석 대상 파일 ID 목록
try { db.exec(`ALTER TABLE analysis_results ADD COLUMN analyzed_file_ids TEXT NOT NULL DEFAULT '[]'`); } catch {}

// 동적 테스트 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS dynamic_test_results (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    config      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    total_runs  INTEGER NOT NULL DEFAULT 0,
    crashes     INTEGER NOT NULL DEFAULT 0,
    anomalies   INTEGER NOT NULL DEFAULT 0,
    findings    TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_dyn_test_project ON dynamic_test_results(project_id);
`);

// 어댑터 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS adapters (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── 프로젝트 스코프 마이그레이션 ──

// rules: project_id 추가 + 기존 글로벌 데이터 삭제
try {
  db.exec(`ALTER TABLE rules ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
  db.exec(`DELETE FROM rules WHERE project_id = ''`);
} catch {}

// adapters: project_id 추가 + 기존 글로벌 데이터 삭제
try {
  db.exec(`ALTER TABLE adapters ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
  db.exec(`DELETE FROM adapters WHERE project_id = ''`);
} catch {}

db.exec(`CREATE INDEX IF NOT EXISTS idx_rules_project ON rules(project_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_adapters_project ON adapters(project_id)`);

// 프로젝트 설정 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS project_settings (
    project_id TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, key)
  );
  CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id);
`);

export default db;

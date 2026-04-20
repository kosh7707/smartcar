import crypto from "crypto";
import Database, { type Database as DatabaseType } from "better-sqlite3";
import { createLogger } from "./lib/logger";
import { config } from "./config";

const logger = createLogger("db");

/** DB 인스턴스 생성 (테스트: ":memory:", 프로덕션: 파일 경로) */
export function createDatabase(dbPath?: string): DatabaseType {
  const resolvedPath = dbPath ?? config.dbPath;
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/** 전체 스키마 + 마이그레이션 실행 */
export function initSchema(db: DatabaseType): void {
  // ── 테이블 생성 (최종 스키마) ──

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
      path        TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id                     TEXT PRIMARY KEY,
      project_id             TEXT NOT NULL DEFAULT '',
      build_target_id        TEXT,
      analysis_execution_id  TEXT,
      module                 TEXT NOT NULL,
      status                 TEXT NOT NULL,
      vulnerabilities        TEXT NOT NULL,            -- JSON
      summary                TEXT NOT NULL,            -- JSON
      warnings               TEXT NOT NULL DEFAULT '[]',
      analyzed_file_ids      TEXT NOT NULL DEFAULT '[]',
      file_coverage          TEXT NOT NULL DEFAULT '[]',
      caveats                TEXT NOT NULL DEFAULT '[]',
      confidence_score       REAL,
      confidence_breakdown   TEXT,
      needs_human_review     INTEGER,
      recommended_next_steps TEXT NOT NULL DEFAULT '[]',
      policy_flags           TEXT NOT NULL DEFAULT '[]',
      sca_libraries          TEXT NOT NULL DEFAULT '[]',
      agent_audit            TEXT,
      created_at             TEXT NOT NULL,
      CHECK (
        module NOT IN ('static_analysis', 'deep_analysis')
        OR (build_target_id IS NOT NULL AND analysis_execution_id IS NOT NULL)
      )
    );
  `);

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
      flagged     INTEGER NOT NULL DEFAULT 0,
      injected    INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dyn_sessions_project ON dynamic_analysis_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_dyn_alerts_session ON dynamic_analysis_alerts(session_id);
    CREATE INDEX IF NOT EXISTS idx_dyn_messages_session ON dynamic_analysis_messages(session_id);
  `);

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
      project_id  TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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

  // 감사 로그 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      actor       TEXT NOT NULL DEFAULT 'system',
      action      TEXT NOT NULL,
      resource    TEXT NOT NULL,
      resource_id TEXT,
      detail      TEXT NOT NULL DEFAULT '{}',
      request_id  TEXT
    );
  `);

  // 코어 도메인 테이블: Run, Finding, EvidenceRef
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id                 TEXT PRIMARY KEY,
      project_id         TEXT NOT NULL,
      build_target_id    TEXT,
      analysis_execution_id TEXT,
      module             TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'completed',
      analysis_result_id TEXT NOT NULL,
      finding_count      INTEGER NOT NULL DEFAULT 0,
      started_at         TEXT,
      ended_at           TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        module NOT IN ('static_analysis', 'deep_analysis')
        OR (build_target_id IS NOT NULL AND analysis_execution_id IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_runs_analysis_result ON runs(analysis_result_id);

    CREATE TABLE IF NOT EXISTS findings (
      id          TEXT PRIMARY KEY,
      run_id      TEXT NOT NULL,
      project_id  TEXT NOT NULL,
      build_target_id TEXT,
      analysis_execution_id TEXT,
      module      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      severity    TEXT NOT NULL,
      confidence  TEXT NOT NULL DEFAULT 'medium',
      source_type TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location    TEXT,
      suggestion  TEXT,
      rule_id     TEXT,
      detail      TEXT,
      fingerprint TEXT,
      cwe_id      TEXT,
      cve_ids     TEXT NOT NULL DEFAULT '[]',
      confidence_score REAL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        module NOT IN ('static_analysis', 'deep_analysis')
        OR (build_target_id IS NOT NULL AND analysis_execution_id IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(run_id);
    CREATE INDEX IF NOT EXISTS idx_findings_project ON findings(project_id);
    CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
    CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(project_id, fingerprint);

    CREATE TABLE IF NOT EXISTS evidence_refs (
      id            TEXT PRIMARY KEY,
      finding_id    TEXT NOT NULL,
      artifact_id   TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      locator_type  TEXT NOT NULL,
      locator       TEXT NOT NULL DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_refs_finding ON evidence_refs(finding_id);
  `);

  // Quality Gate + Approval + BuildTarget 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS gate_results (
      id           TEXT PRIMARY KEY,
      run_id       TEXT NOT NULL,
      project_id   TEXT NOT NULL,
      status       TEXT NOT NULL,
      rules        TEXT NOT NULL DEFAULT '[]',
      evaluated_at TEXT NOT NULL,
      override     TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_gate_results_run ON gate_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_gate_results_project ON gate_results(project_id);

    CREATE TABLE IF NOT EXISTS approvals (
      id            TEXT PRIMARY KEY,
      action_type   TEXT NOT NULL,
      requested_by  TEXT NOT NULL DEFAULT 'analyst',
      target_id     TEXT NOT NULL,
      project_id    TEXT NOT NULL,
      reason        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      decision      TEXT,
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(project_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_target ON approvals(target_id);

    CREATE TABLE IF NOT EXISTS build_targets (
      id                    TEXT PRIMARY KEY,
      project_id            TEXT NOT NULL,
      name                  TEXT NOT NULL,
      relative_path         TEXT NOT NULL,
      build_profile         TEXT NOT NULL DEFAULT '{}',
      sdk_choice_state      TEXT NOT NULL DEFAULT 'sdk-unresolved',
      build_system          TEXT,
      status                TEXT NOT NULL DEFAULT 'discovered',
      compile_commands_path TEXT,
      build_log             TEXT,
      sast_scan_id          TEXT,
      sca_libraries         TEXT NOT NULL DEFAULT '[]',
      code_graph_status     TEXT NOT NULL DEFAULT 'pending',
      code_graph_node_count INTEGER DEFAULT 0,
      last_built_at         TEXT,
      included_paths        TEXT NOT NULL DEFAULT '[]',
      source_path           TEXT,
      build_command         TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_build_targets_project ON build_targets(project_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_executions (
      id                         TEXT PRIMARY KEY,
      project_id                 TEXT NOT NULL,
      build_target_id            TEXT NOT NULL,
      build_target_name          TEXT NOT NULL,
      build_target_relative_path TEXT NOT NULL,
      build_profile_snapshot     TEXT NOT NULL DEFAULT '{}',
      sdk_choice_state           TEXT NOT NULL,
      status                     TEXT NOT NULL DEFAULT 'active',
      quick_build_prep_status    TEXT NOT NULL DEFAULT 'pending',
      quick_graphrag_status      TEXT NOT NULL DEFAULT 'pending',
      quick_sast_status          TEXT NOT NULL DEFAULT 'pending',
      deep_status                TEXT NOT NULL DEFAULT 'pending',
      superseded_by_execution_id TEXT,
      created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_analysis_executions_project ON analysis_executions(project_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_executions_target ON analysis_executions(build_target_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_executions_target_status ON analysis_executions(build_target_id, status);
  `);

  // 프로젝트별 SDK 업로드/등록 surface (현재 runtime + contract test 호환)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sdk_registry (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT,
      path         TEXT NOT NULL,
      profile      TEXT,
      status       TEXT NOT NULL DEFAULT 'uploading',
      verify_error TEXT,
      verified     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sdk_registry_project ON sdk_registry(project_id, created_at DESC);
  `);

  // S2 canonical build persistence + S3 read projections
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_source_assets (
      id                 TEXT PRIMARY KEY,
      project_id         TEXT NOT NULL,
      root_path          TEXT NOT NULL,
      source_type        TEXT NOT NULL,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_source_assets_project ON project_source_assets(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sdk_assets (
      id                 TEXT PRIMARY KEY,
      project_id         TEXT NOT NULL,
      name               TEXT NOT NULL,
      description        TEXT,
      storage_path       TEXT NOT NULL,
      profile            TEXT NOT NULL DEFAULT '{}',
      status             TEXT NOT NULL DEFAULT 'uploading',
      verify_error       TEXT,
      verified           INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sdk_assets_project ON sdk_assets(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS build_units (
      id                 TEXT PRIMARY KEY,
      project_id         TEXT NOT NULL,
      name               TEXT NOT NULL,
      relative_path      TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'active',
      latest_revision_id TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_units_project ON build_units(project_id);
    CREATE INDEX IF NOT EXISTS idx_build_units_project_path ON build_units(project_id, relative_path);

    CREATE TABLE IF NOT EXISTS build_unit_revisions (
      id                     TEXT PRIMARY KEY,
      build_unit_id          TEXT NOT NULL,
      project_id             TEXT NOT NULL,
      source_asset_id        TEXT NOT NULL,
      build_target_asset_id    TEXT NOT NULL,
      sdk_asset_id           TEXT,
      revision_number        INTEGER NOT NULL,
      included_paths         TEXT NOT NULL DEFAULT '[]',
      selection_manifest     TEXT NOT NULL DEFAULT '{"files":[],"excluded":[]}',
      declared_build         TEXT NOT NULL DEFAULT '{}',
      expected_artifacts     TEXT NOT NULL DEFAULT '[]',
      frozen_at              TEXT NOT NULL,
      supersedes_revision_id TEXT,
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_unit_revisions_unit ON build_unit_revisions(build_unit_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_build_unit_revisions_unit_revnum ON build_unit_revisions(build_unit_id, revision_number);

    CREATE TABLE IF NOT EXISTS build_requests (
      id                     TEXT PRIMARY KEY,
      project_id             TEXT NOT NULL,
      build_unit_id          TEXT NOT NULL,
      build_unit_revision_id TEXT NOT NULL,
      request_type           TEXT NOT NULL,
      requested_by           TEXT NOT NULL,
      requested_snapshot_id  TEXT,
      requested_attempt_id   TEXT,
      build_script_ref       TEXT,
      status                 TEXT NOT NULL DEFAULT 'submitted',
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_requests_project ON build_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_build_requests_unit ON build_requests(build_unit_id);
    CREATE INDEX IF NOT EXISTS idx_build_requests_revision ON build_requests(build_unit_revision_id);

    CREATE TABLE IF NOT EXISTS build_attempt_projections (
      id                     TEXT PRIMARY KEY,
      project_id             TEXT NOT NULL,
      build_request_id       TEXT NOT NULL,
      build_unit_id          TEXT NOT NULL,
      build_unit_revision_id TEXT NOT NULL,
      attempt_number         INTEGER NOT NULL,
      status                 TEXT NOT NULL,
      failure_category       TEXT,
      failure_detail         TEXT,
      execution_material     TEXT NOT NULL DEFAULT '{}',
      produced_artifacts     TEXT NOT NULL DEFAULT '[]',
      started_at             TEXT,
      completed_at           TEXT,
      retry_of_attempt_id    TEXT,
      created_at             TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_build_attempt_projections_request ON build_attempt_projections(build_request_id);
    CREATE INDEX IF NOT EXISTS idx_build_attempt_projections_unit ON build_attempt_projections(build_unit_id);
    CREATE INDEX IF NOT EXISTS idx_build_attempt_projections_revision ON build_attempt_projections(build_unit_revision_id);

    CREATE TABLE IF NOT EXISTS build_snapshot_projections (
      id                      TEXT PRIMARY KEY,
      project_id              TEXT NOT NULL,
      snapshot_schema_version TEXT NOT NULL,
      build_unit_id           TEXT NOT NULL,
      build_unit_revision_id  TEXT NOT NULL,
      source_build_attempt_id TEXT NOT NULL,
      declared_build          TEXT NOT NULL DEFAULT '{}',
      execution_material      TEXT NOT NULL DEFAULT '{}',
      produced_artifacts      TEXT NOT NULL DEFAULT '[]',
      third_party_inventory_ref TEXT,
      success_metadata        TEXT,
      parent_snapshot_id      TEXT,
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_build_snapshot_projections_unit ON build_snapshot_projections(build_unit_id);
    CREATE INDEX IF NOT EXISTS idx_build_snapshot_projections_revision ON build_snapshot_projections(build_unit_revision_id);
    CREATE INDEX IF NOT EXISTS idx_build_snapshot_projections_attempt ON build_snapshot_projections(source_build_attempt_id);

    CREATE TABLE IF NOT EXISTS build_target_assets (
      id                     TEXT PRIMARY KEY,
      project_id             TEXT NOT NULL,
      build_unit_id          TEXT NOT NULL,
      build_unit_revision_id TEXT NOT NULL,
      source_asset_id        TEXT NOT NULL,
      root_path              TEXT NOT NULL,
      selection_manifest     TEXT NOT NULL DEFAULT '{"files":[],"excluded":[]}',
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_target_assets_project ON build_target_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_build_target_assets_unit ON build_target_assets(build_unit_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_build_target_assets_revision ON build_target_assets(build_unit_revision_id);
  `);

  // 알림 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL DEFAULT '',
      severity    TEXT,
      job_kind    TEXT,
      resource_id TEXT,
      correlation_id TEXT,
      read        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(project_id, read);
  `);

  // 사용자/세션
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'analyst',
      organization_id TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS organizations (
      id                 TEXT PRIMARY KEY,
      code               TEXT NOT NULL UNIQUE,
      name               TEXT NOT NULL,
      region             TEXT NOT NULL,
      default_role       TEXT NOT NULL DEFAULT 'viewer',
      email_domain_hint  TEXT,
      admin_display_name TEXT NOT NULL,
      admin_email        TEXT NOT NULL,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registration_requests (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      full_name         TEXT NOT NULL,
      email             TEXT NOT NULL,
      password_hash     TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending_admin_review',
      assigned_role     TEXT,
      decision_reason   TEXT,
      approved_user_id  TEXT,
      reviewed_by_user_id TEXT,
      terms_accepted_at TEXT NOT NULL,
      audit_accepted_at TEXT NOT NULL,
      lookup_token_hash TEXT NOT NULL UNIQUE,
      lookup_expires_at TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at       TEXT,
      rejected_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_registration_requests_org ON registration_requests(organization_id);
    CREATE INDEX IF NOT EXISTS idx_registration_requests_email ON registration_requests(email);
    CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      token_hash   TEXT NOT NULL UNIQUE,
      expires_at   TEXT NOT NULL,
      consumed_at  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

    CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
      id          TEXT PRIMARY KEY,
      scope       TEXT NOT NULL,
      key         TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_scope_key_time ON auth_rate_limit_events(scope, key, occurred_at);
  `);

  // 서드파티 라이브러리 (타겟별)
  db.exec(`
    CREATE TABLE IF NOT EXISTS target_libraries (
      id              TEXT PRIMARY KEY,
      target_id       TEXT NOT NULL,
      project_id      TEXT NOT NULL,
      name            TEXT NOT NULL,
      version         TEXT,
      path            TEXT NOT NULL,
      included        INTEGER NOT NULL DEFAULT 0,
      modified_files  TEXT NOT NULL DEFAULT '[]',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_target_libs_target ON target_libraries(target_id);
  `);

  // ── 레거시 DB 호환 마이그레이션 (기존 DB에서만 실행됨) ──

  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN build_target_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN analysis_execution_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE uploaded_files ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE uploaded_files ADD COLUMN path TEXT NOT NULL DEFAULT ''`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE dynamic_analysis_sessions ADD COLUMN source TEXT NOT NULL DEFAULT '{}'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE dynamic_analysis_messages ADD COLUMN injected INTEGER NOT NULL DEFAULT 0`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN warnings TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN analyzed_file_ids TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN file_coverage TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN caveats TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN confidence_score REAL`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN confidence_breakdown TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN needs_human_review INTEGER`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN recommended_next_steps TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN policy_flags TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN sca_libraries TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE analysis_results ADD COLUMN agent_audit TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN detail TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN fingerprint TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN cwe_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN cve_ids TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN confidence_score REAL`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE users ADD COLUMN organization_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'`); } catch { /* 이미 존재 */ }
  try {
    db.exec(`ALTER TABLE adapters ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
    db.exec(`DELETE FROM adapters WHERE project_id = ''`);
  } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE runs ADD COLUMN build_target_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE runs ADD COLUMN analysis_execution_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN build_target_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE findings ADD COLUMN analysis_execution_id TEXT`); } catch { /* 이미 존재 */ }

  try {
    const rows = db.prepare(`SELECT token FROM sessions`).all() as Array<{ token: string }>;
    const update = db.prepare(`UPDATE sessions SET token = ? WHERE token = ?`);
    for (const row of rows) {
      if (/^[a-f0-9]{64}$/i.test(row.token)) continue;
      const hashed = crypto.createHash("sha256").update(row.token).digest("hex");
      update.run(hashed, row.token);
    }
  } catch {
    /* sessions migration best-effort */
  }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN sdk_choice_state TEXT NOT NULL DEFAULT 'sdk-unresolved'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN status TEXT NOT NULL DEFAULT 'discovered'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN compile_commands_path TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN build_log TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN sast_scan_id TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN sca_libraries TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN code_graph_status TEXT NOT NULL DEFAULT 'pending'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN code_graph_node_count INTEGER DEFAULT 0`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN last_built_at TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN included_paths TEXT NOT NULL DEFAULT '[]'`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN source_path TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE build_targets ADD COLUMN build_command TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE notifications ADD COLUMN job_kind TEXT`); } catch { /* 이미 존재 */ }
  try { db.exec(`ALTER TABLE notifications ADD COLUMN correlation_id TEXT`); } catch { /* 이미 존재 */ }

  // 레거시: rules 테이블이 남아있는 기존 DB에서 DROP
  try { db.exec(`DROP TABLE IF EXISTS rules`); } catch { /* 이미 제거됨 */ }
}

export type { DatabaseType };

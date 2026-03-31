"""ProjectMemoryService — Neo4j 기반 프로젝트별 에이전트 메모리."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import neo4j

logger = logging.getLogger(__name__)

_VALID_TYPES = {"analysis_history", "false_positive", "resolved", "preference"}
_NO_EXPIRY = "9999-12-31T23:59:59+00:00"


class ProjectMemoryService:
    """프로젝트별 에이전트 메모리를 Neo4j에서 관리한다.

    (:Project {id})-[:HAS_MEMORY]->(:Memory {id, type, data, createdAt, content_hash, expiresAt?})
    """

    def __init__(self, driver: neo4j.Driver, *, memory_limit: int = 1000) -> None:
        self._driver = driver
        self._memory_limit = memory_limit
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Memory 노드 인덱스 생성 + 기존 노드 expiresAt 마이그레이션."""
        with self._driver.session() as session:
            session.run(
                "CREATE INDEX IF NOT EXISTS FOR (n:Project) ON (n.id)"
            )
            session.run(
                "CREATE INDEX IF NOT EXISTS FOR (n:Memory) ON (n.id)"
            )
            session.run(
                "CREATE INDEX IF NOT EXISTS FOR (n:Memory) ON (n.content_hash)"
            )
            # expiresAt 속성이 없는 기존 Memory 노드에 센티넬 값 설정
            result = session.run(
                "MATCH (m:Memory) WHERE m.expiresAt IS NULL "
                "SET m.expiresAt = $sentinel "
                "RETURN count(m) AS cnt",
                sentinel=_NO_EXPIRY,
            ).single()
            migrated = result["cnt"] if result else 0
            if migrated > 0:
                logger.info("expiresAt 마이그레이션: %d개 Memory 노드에 센티넬 값 설정", migrated)

    @staticmethod
    def _compute_hash(project_id: str, memory_type: str, data: dict) -> str:
        """content-based dedup 해시를 계산한다."""
        payload = f"{project_id}:{memory_type}:{json.dumps(data, sort_keys=True, ensure_ascii=False)}"
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def list_memories(
        self, project_id: str, memory_type: str | None = None,
    ) -> list[dict]:
        """프로젝트의 메모리 목록을 반환한다 (만료된 메모리 제외)."""
        now = datetime.now(timezone.utc).isoformat()

        type_clause = "AND m.type = $type " if memory_type else ""
        expire_clause = "AND (m.expiresAt IS NULL OR m.expiresAt > $now) "

        query = (
            "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory) "
            f"WHERE true {type_clause}{expire_clause}"
            "RETURN m.id AS id, m.type AS type, m.data AS data, "
            "m.createdAt AS createdAt, m.expiresAt AS expiresAt "
            "ORDER BY m.createdAt DESC"
        )
        params: dict = {"pid": project_id, "now": now}
        if memory_type:
            params["type"] = memory_type

        with self._driver.session() as session:
            result = session.run(query, **params)
            memories = []
            for rec in result:
                data_raw = rec["data"]
                try:
                    data = json.loads(data_raw) if data_raw else {}
                except (json.JSONDecodeError, TypeError):
                    data = {}
                entry = {
                    "id": rec["id"],
                    "type": rec["type"],
                    "data": data,
                    "createdAt": rec["createdAt"],
                }
                if rec["expiresAt"] and rec["expiresAt"] != _NO_EXPIRY:
                    entry["expiresAt"] = rec["expiresAt"]
                memories.append(entry)
            return memories

    def create_memory(
        self,
        project_id: str,
        memory_type: str,
        data: dict,
        *,
        ttl_seconds: int | None = None,
    ) -> dict:
        """프로젝트 메모리를 생성한다.

        - content-hash 기반 중복 제거: 동일 (project, type, data)이면 기존 메모리 반환
        - ttl_seconds: 설정 시 만료 시각 계산, None이면 영구
        - memory_limit: 프로젝트당 메모리 한도 초과 시 MemoryLimitError
        """
        if memory_type not in _VALID_TYPES:
            raise ValueError(f"Invalid memory type: {memory_type}. Must be one of {_VALID_TYPES}")

        content_hash = self._compute_hash(project_id, memory_type, data)

        with self._driver.session() as session:
            # 1) 중복 체크
            dup = session.run(
                "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory) "
                "WHERE m.content_hash = $hash "
                "RETURN m.id AS id, m.type AS type, m.createdAt AS createdAt",
                pid=project_id, hash=content_hash,
            ).single()

            if dup is not None:
                logger.info(
                    "중복 메모리 감지 (dedup): project=%s, hash=%s, existing_id=%s",
                    project_id, content_hash, dup["id"],
                )
                return {
                    "id": dup["id"], "type": dup["type"],
                    "createdAt": dup["createdAt"], "deduplicated": True,
                }

            # 2) 한도 체크
            now = datetime.now(timezone.utc).isoformat()
            cnt_result = session.run(
                "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory) "
                "WHERE m.expiresAt IS NULL OR m.expiresAt > $now "
                "RETURN count(m) AS cnt",
                pid=project_id, now=now,
            ).single()
            if cnt_result and cnt_result["cnt"] >= self._memory_limit:
                raise MemoryLimitError(
                    f"Project '{project_id}' memory limit reached ({self._memory_limit})"
                )

            # 3) 생성
            memory_id = f"mem-{uuid.uuid4().hex[:8]}"
            created_at = now
            data_json = json.dumps(data, ensure_ascii=False)
            if ttl_seconds is not None:
                expires_at = (
                    datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
                ).isoformat()
            else:
                expires_at = _NO_EXPIRY

            session.run(
                "MERGE (p:Project {id: $pid}) "
                "CREATE (m:Memory {"
                "  id: $mid, type: $type, data: $data,"
                "  createdAt: $createdAt, content_hash: $hash,"
                "  expiresAt: $expiresAt"
                "}) "
                "CREATE (p)-[:HAS_MEMORY]->(m)",
                pid=project_id, mid=memory_id, type=memory_type,
                data=data_json, createdAt=created_at,
                hash=content_hash, expiresAt=expires_at,
            )

        logger.info(
            "프로젝트 메모리 생성: project=%s, type=%s, id=%s",
            project_id, memory_type, memory_id,
        )
        result = {"id": memory_id, "type": memory_type, "createdAt": created_at}
        if expires_at and expires_at != _NO_EXPIRY:
            result["expiresAt"] = expires_at
        return result


    def delete_memory(self, project_id: str, memory_id: str) -> bool:
        """프로젝트 메모리를 삭제한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory {id: $mid}) "
                "WITH m, count(m) AS cnt "
                "DETACH DELETE m "
                "RETURN cnt",
                pid=project_id, mid=memory_id,
            )
            record = result.single()
            deleted = record is not None and record["cnt"] > 0

        if deleted:
            logger.info("프로젝트 메모리 삭제: project=%s, id=%s", project_id, memory_id)
        return deleted


class MemoryLimitError(Exception):
    """프로젝트당 메모리 한도 초과."""

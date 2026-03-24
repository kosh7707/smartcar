"""ProjectMemoryService — Neo4j 기반 프로젝트별 에이전트 메모리."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import neo4j

logger = logging.getLogger(__name__)

_VALID_TYPES = {"analysis_history", "false_positive", "resolved", "preference"}


class ProjectMemoryService:
    """프로젝트별 에이전트 메모리를 Neo4j에서 관리한다.

    (:Project {id})-[:HAS_MEMORY]->(:Memory {id, type, data, createdAt})
    """

    def __init__(self, driver: neo4j.Driver) -> None:
        self._driver = driver
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Memory 노드 인덱스 생성."""
        with self._driver.session() as session:
            session.run(
                "CREATE INDEX IF NOT EXISTS FOR (n:Project) ON (n.id)"
            )
            session.run(
                "CREATE INDEX IF NOT EXISTS FOR (n:Memory) ON (n.id)"
            )

    def list_memories(
        self, project_id: str, memory_type: str | None = None,
    ) -> list[dict]:
        """프로젝트의 메모리 목록을 반환한다."""
        with self._driver.session() as session:
            if memory_type:
                result = session.run(
                    "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory) "
                    "WHERE m.type = $type "
                    "RETURN m.id AS id, m.type AS type, m.data AS data, m.createdAt AS createdAt "
                    "ORDER BY m.createdAt DESC",
                    pid=project_id, type=memory_type,
                )
            else:
                result = session.run(
                    "MATCH (p:Project {id: $pid})-[:HAS_MEMORY]->(m:Memory) "
                    "RETURN m.id AS id, m.type AS type, m.data AS data, m.createdAt AS createdAt "
                    "ORDER BY m.createdAt DESC",
                    pid=project_id,
                )
            memories = []
            for rec in result:
                data_raw = rec["data"]
                try:
                    data = json.loads(data_raw) if data_raw else {}
                except (json.JSONDecodeError, TypeError):
                    data = {}
                memories.append({
                    "id": rec["id"],
                    "type": rec["type"],
                    "data": data,
                    "createdAt": rec["createdAt"],
                })
            return memories

    def create_memory(
        self, project_id: str, memory_type: str, data: dict,
    ) -> dict:
        """프로젝트 메모리를 생성한다."""
        if memory_type not in _VALID_TYPES:
            raise ValueError(f"Invalid memory type: {memory_type}. Must be one of {_VALID_TYPES}")

        memory_id = f"mem-{uuid.uuid4().hex[:8]}"
        created_at = datetime.now(timezone.utc).isoformat()
        data_json = json.dumps(data, ensure_ascii=False)

        with self._driver.session() as session:
            session.run(
                "MERGE (p:Project {id: $pid}) "
                "CREATE (m:Memory {id: $mid, type: $type, data: $data, createdAt: $createdAt}) "
                "CREATE (p)-[:HAS_MEMORY]->(m)",
                pid=project_id, mid=memory_id, type=memory_type,
                data=data_json, createdAt=created_at,
            )

        logger.info(
            "프로젝트 메모리 생성: project=%s, type=%s, id=%s",
            project_id, memory_type, memory_id,
        )
        return {"id": memory_id, "type": memory_type, "createdAt": created_at}

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

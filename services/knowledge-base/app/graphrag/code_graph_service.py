"""CodeGraphService — Neo4j 기반 프로젝트별 코드 함수 호출 그래프."""

from __future__ import annotations

import logging

import neo4j

logger = logging.getLogger(__name__)


class CodeGraphService:
    """프로젝트별 코드 함수 호출 그래프를 Neo4j에서 관리한다."""

    def __init__(self, driver: neo4j.Driver) -> None:
        self._driver = driver

    @staticmethod
    def _normalize_provenance(provenance: dict | None) -> dict[str, str | None]:
        source = provenance or {}
        return {
            "build_snapshot_id": source.get("build_snapshot_id") or source.get("buildSnapshotId"),
            "build_unit_id": source.get("build_unit_id") or source.get("buildUnitId"),
            "source_build_attempt_id": (
                source.get("source_build_attempt_id") or source.get("sourceBuildAttemptId")
            ),
        }

    @classmethod
    def _attach_provenance(cls, item: dict, provenance: dict | None) -> dict:
        normalized = item.copy()
        for key, value in cls._normalize_provenance(provenance).items():
            if value is not None:
                normalized[key] = value
        normalized["provenance"] = {
            "buildSnapshotId": normalized.get("build_snapshot_id"),
            "buildUnitId": normalized.get("build_unit_id"),
            "sourceBuildAttemptId": normalized.get("source_build_attempt_id"),
        }
        if all(value is None for value in normalized["provenance"].values()):
            normalized.pop("provenance")
        return normalized

    @classmethod
    def _normalize_functions(cls, functions: list[dict], provenance: dict | None = None) -> list[dict]:
        """S4 camelCase → snake_case 변환 + origin/provenance 정규화."""
        normalized_provenance = cls._normalize_provenance(provenance)
        normalized = []
        for func in functions:
            item = {
                "name": func["name"],
                "file": func.get("file"),
                "line": func.get("line"),
                "origin": func.get("origin"),
                "original_lib": func.get("original_lib") or func.get("originalLib"),
                "original_version": func.get("original_version") or func.get("originalVersion"),
            }
            item.update(cls._normalize_provenance(func.get("provenance")))
            for key, value in normalized_provenance.items():
                item[key] = item.get(key) or value
            normalized.append(item)
        return normalized

    def ingest(self, project_id: str, functions: list[dict], *, provenance: dict | None = None) -> dict:
        """함수 목록에서 Function 노드 + CALLS 관계를 생성한다.

        기존 project_id 데이터는 삭제 후 재생성.
        functions: [{"name": "postJson", "file": "src/http_client.cpp", "line": 8, "calls": ["popen", "fgets"]}]
        선택 필드: origin, originalLib/original_lib, originalVersion/original_version
        """
        normalized = self._normalize_functions(functions, provenance=provenance)
        normalized_provenance = self._normalize_provenance(provenance)

        with self._driver.session() as session:
            # 기존 프로젝트 데이터 삭제 (현재는 프로젝트당 활성 그래프 1개 유지)
            session.run(
                "MATCH (n:Function {project_id: $pid}) DETACH DELETE n",
                pid=project_id,
            )

            # Function 노드 생성 (배치)
            for batch_start in range(0, len(normalized), 100):
                batch = normalized[batch_start:batch_start + 100]
                session.run(
                    "UNWIND $batch AS f "
                    "MERGE (fn:Function {project_id: $pid, name: f.name}) "
                    "SET fn.file = f.file, fn.line = f.line, "
                    "fn.origin = f.origin, fn.original_lib = f.original_lib, "
                    "fn.original_version = f.original_version, "
                    "fn.build_snapshot_id = f.build_snapshot_id, "
                    "fn.build_unit_id = f.build_unit_id, "
                    "fn.source_build_attempt_id = f.source_build_attempt_id",
                    batch=batch, pid=project_id,
                )

            # CALLS 관계 생성
            edges = []
            for func in functions:
                for callee in func.get("calls", []):
                    edges.append({"caller": func["name"], "callee": callee})

            for batch_start in range(0, len(edges), 200):
                batch = edges[batch_start:batch_start + 200]
                session.run(
                    "UNWIND $batch AS e "
                    "MERGE (caller:Function {project_id: $pid, name: e.caller}) "
                    "MERGE (callee:Function {project_id: $pid, name: e.callee}) "
                    "SET callee.build_snapshot_id = $build_snapshot_id, "
                    "callee.build_unit_id = $build_unit_id, "
                    "callee.source_build_attempt_id = $source_build_attempt_id "
                    "MERGE (caller)-[:CALLS]->(callee)",
                    batch=batch,
                    pid=project_id,
                    build_snapshot_id=normalized_provenance.get("build_snapshot_id"),
                    build_unit_id=normalized_provenance.get("build_unit_id"),
                    source_build_attempt_id=normalized_provenance.get("source_build_attempt_id"),
                )

        stats = self.get_stats(
            project_id,
            build_snapshot_id=normalized_provenance.get("build_snapshot_id"),
        )
        logger.info(
            "코드 그래프 구축: project=%s, nodes=%d, edges=%d",
            project_id, stats["nodeCount"], stats["edgeCount"],
        )
        result = {"project_id": project_id, **stats}
        if any(normalized_provenance.values()):
            result["provenance"] = {
                "buildSnapshotId": normalized_provenance.get("build_snapshot_id"),
                "buildUnitId": normalized_provenance.get("build_unit_id"),
                "sourceBuildAttemptId": normalized_provenance.get("source_build_attempt_id"),
            }
        return result

    def get_callers(
        self,
        project_id: str,
        function_name: str,
        depth: int = 2,
        *,
        build_snapshot_id: str | None = None,
    ) -> list[dict]:
        """해당 함수를 호출하는 함수 체인을 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                f"MATCH (target:Function {{project_id: $pid, name: $name}})"
                f"<-[:CALLS*1..{depth}]-(caller:Function) "
                "WHERE ($build_snapshot_id IS NULL OR (target.build_snapshot_id = $build_snapshot_id "
                "AND caller.build_snapshot_id = $build_snapshot_id)) "
                "RETURN DISTINCT caller.name AS name, caller.file AS file, caller.line AS line, "
                "coalesce(caller.origin, null) AS origin, coalesce(caller.original_lib, null) AS original_lib, "
                "coalesce(caller.original_version, null) AS original_version, "
                "coalesce(caller.build_snapshot_id, null) AS build_snapshot_id, "
                "coalesce(caller.build_unit_id, null) AS build_unit_id, "
                "coalesce(caller.source_build_attempt_id, null) AS source_build_attempt_id",
                pid=project_id, name=function_name, build_snapshot_id=build_snapshot_id,
            )
            return [self._attach_provenance(dict(rec), None) for rec in result]

    def get_function(
        self,
        project_id: str,
        function_name: str,
        *,
        build_snapshot_id: str | None = None,
    ) -> dict | None:
        """단일 함수 노드 정보를 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (fn:Function {project_id: $pid, name: $name}) "
                "WHERE ($build_snapshot_id IS NULL OR fn.build_snapshot_id = $build_snapshot_id) "
                "RETURN fn.name AS name, fn.file AS file, fn.line AS line, "
                "coalesce(fn.origin, null) AS origin, "
                "coalesce(fn.original_lib, null) AS original_lib, "
                "coalesce(fn.original_version, null) AS original_version, "
                "coalesce(fn.build_snapshot_id, null) AS build_snapshot_id, "
                "coalesce(fn.build_unit_id, null) AS build_unit_id, "
                "coalesce(fn.source_build_attempt_id, null) AS source_build_attempt_id",
                pid=project_id, name=function_name, build_snapshot_id=build_snapshot_id,
            )
            record = result.single()
            if record is None:
                return None
            return self._attach_provenance(dict(record), None)

    def get_callees(
        self,
        project_id: str,
        function_name: str,
        *,
        build_snapshot_id: str | None = None,
    ) -> list[dict]:
        """해당 함수가 호출하는 함수를 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (fn:Function {project_id: $pid, name: $name})"
                "-[:CALLS]->(callee:Function) "
                "WHERE ($build_snapshot_id IS NULL OR (fn.build_snapshot_id = $build_snapshot_id "
                "AND callee.build_snapshot_id = $build_snapshot_id)) "
                "RETURN callee.name AS name, callee.file AS file, callee.line AS line, "
                "coalesce(callee.origin, null) AS origin, coalesce(callee.original_lib, null) AS original_lib, "
                "coalesce(callee.original_version, null) AS original_version, "
                "coalesce(callee.build_snapshot_id, null) AS build_snapshot_id, "
                "coalesce(callee.build_unit_id, null) AS build_unit_id, "
                "coalesce(callee.source_build_attempt_id, null) AS source_build_attempt_id",
                pid=project_id, name=function_name, build_snapshot_id=build_snapshot_id,
            )
            return [self._attach_provenance(dict(rec), None) for rec in result]

    def find_dangerous_callers(
        self,
        project_id: str,
        dangerous_functions: list[str],
        *,
        build_snapshot_id: str | None = None,
    ) -> list[dict]:
        """위험 함수(system, popen 등)를 호출하는 사용자 코드 함수를 식별한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (caller:Function {project_id: $pid})"
                "-[:CALLS]->(d:Function {project_id: $pid}) "
                "WHERE ($build_snapshot_id IS NULL OR caller.build_snapshot_id = $build_snapshot_id) "
                "AND d.name IN $dangerous AND caller.file IS NOT NULL "
                "RETURN caller.name AS name, caller.file AS file, "
                "caller.line AS line, collect(DISTINCT d.name) AS dangerous_calls, "
                "coalesce(caller.origin, null) AS origin, coalesce(caller.original_lib, null) AS original_lib, "
                "coalesce(caller.original_version, null) AS original_version, "
                "coalesce(caller.build_snapshot_id, null) AS build_snapshot_id, "
                "coalesce(caller.build_unit_id, null) AS build_unit_id, "
                "coalesce(caller.source_build_attempt_id, null) AS source_build_attempt_id",
                pid=project_id, dangerous=dangerous_functions, build_snapshot_id=build_snapshot_id,
            )
            return [self._attach_provenance(dict(rec), None) for rec in result]

    def get_stats(self, project_id: str, *, build_snapshot_id: str | None = None) -> dict:
        """프로젝트 코드 그래프 통계."""
        with self._driver.session() as session:
            node_result = session.run(
                "MATCH (n:Function {project_id: $pid}) "
                "WHERE ($build_snapshot_id IS NULL OR n.build_snapshot_id = $build_snapshot_id) "
                "RETURN count(n) AS cnt",
                pid=project_id, build_snapshot_id=build_snapshot_id,
            )
            node_count = node_result.single()["cnt"]

            edge_result = session.run(
                "MATCH (:Function {project_id: $pid})-[r:CALLS]->(:Function {project_id: $pid}) "
                "WHERE ($build_snapshot_id IS NULL OR (startNode(r).build_snapshot_id = $build_snapshot_id "
                "AND endNode(r).build_snapshot_id = $build_snapshot_id)) "
                "RETURN count(r) AS cnt",
                pid=project_id, build_snapshot_id=build_snapshot_id,
            )
            edge_count = edge_result.single()["cnt"]

            files_result = session.run(
                "MATCH (n:Function {project_id: $pid}) "
                "WHERE ($build_snapshot_id IS NULL OR n.build_snapshot_id = $build_snapshot_id) "
                "AND n.file IS NOT NULL "
                "RETURN DISTINCT n.file AS file",
                pid=project_id, build_snapshot_id=build_snapshot_id,
            )
            files = [rec["file"] for rec in files_result]

        result = {"nodeCount": node_count, "edgeCount": edge_count, "files": files}
        if build_snapshot_id is not None:
            result["provenance"] = {"buildSnapshotId": build_snapshot_id}
        return result

    def delete_project(self, project_id: str) -> bool:
        """프로젝트 코드 그래프를 삭제한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (n:Function {project_id: $pid}) "
                "WITH count(n) AS cnt "
                "MATCH (n:Function {project_id: $pid}) DETACH DELETE n "
                "RETURN cnt",
                pid=project_id,
            )
            record = result.single()
            return record is not None and record["cnt"] > 0

    def list_projects(self) -> list[str]:
        """등록된 프로젝트 ID 목록을 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (n:Function) RETURN DISTINCT n.project_id AS pid"
            )
            return [rec["pid"] for rec in result]

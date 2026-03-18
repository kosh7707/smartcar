"""CodeGraphService — Neo4j 기반 프로젝트별 코드 함수 호출 그래프."""

from __future__ import annotations

import logging

import neo4j

logger = logging.getLogger(__name__)


class CodeGraphService:
    """프로젝트별 코드 함수 호출 그래프를 Neo4j에서 관리한다."""

    def __init__(self, driver: neo4j.Driver) -> None:
        self._driver = driver

    def ingest(self, project_id: str, functions: list[dict]) -> dict:
        """함수 목록에서 Function 노드 + CALLS 관계를 생성한다.

        기존 project_id 데이터는 삭제 후 재생성.
        functions: [{"name": "postJson", "file": "src/http_client.cpp", "line": 8, "calls": ["popen", "fgets"]}]
        """
        with self._driver.session() as session:
            # 기존 프로젝트 데이터 삭제
            session.run(
                "MATCH (n:Function {project_id: $pid}) DETACH DELETE n",
                pid=project_id,
            )

            # Function 노드 생성 (배치)
            for batch_start in range(0, len(functions), 100):
                batch = functions[batch_start:batch_start + 100]
                session.run(
                    "UNWIND $batch AS f "
                    "MERGE (fn:Function {project_id: $pid, name: f.name}) "
                    "SET fn.file = f.file, fn.line = f.line",
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
                    "MERGE (caller)-[:CALLS]->(callee)",
                    batch=batch, pid=project_id,
                )

        stats = self.get_stats(project_id)
        logger.info(
            "코드 그래프 구축: project=%s, nodes=%d, edges=%d",
            project_id, stats["nodeCount"], stats["edgeCount"],
        )
        return {"project_id": project_id, **stats}

    def get_callers(
        self, project_id: str, function_name: str, depth: int = 2,
    ) -> list[dict]:
        """해당 함수를 호출하는 함수 체인을 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                f"MATCH (target:Function {{project_id: $pid, name: $name}})"
                f"<-[:CALLS*1..{depth}]-(caller:Function) "
                "RETURN DISTINCT caller.name AS name, caller.file AS file, caller.line AS line",
                pid=project_id, name=function_name,
            )
            return [dict(rec) for rec in result]

    def get_callees(self, project_id: str, function_name: str) -> list[dict]:
        """해당 함수가 호출하는 함수를 반환한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (fn:Function {project_id: $pid, name: $name})"
                "-[:CALLS]->(callee:Function) "
                "RETURN callee.name AS name, callee.file AS file, callee.line AS line",
                pid=project_id, name=function_name,
            )
            return [dict(rec) for rec in result]

    def find_dangerous_callers(
        self, project_id: str, dangerous_functions: list[str],
    ) -> list[dict]:
        """위험 함수(system, popen 등)를 호출하는 사용자 코드 함수를 식별한다."""
        with self._driver.session() as session:
            result = session.run(
                "MATCH (caller:Function {project_id: $pid})"
                "-[:CALLS]->(d:Function {project_id: $pid}) "
                "WHERE d.name IN $dangerous AND caller.file IS NOT NULL "
                "RETURN caller.name AS name, caller.file AS file, "
                "caller.line AS line, collect(DISTINCT d.name) AS dangerous_calls",
                pid=project_id, dangerous=dangerous_functions,
            )
            return [dict(rec) for rec in result]

    def get_stats(self, project_id: str) -> dict:
        """프로젝트 코드 그래프 통계."""
        with self._driver.session() as session:
            node_result = session.run(
                "MATCH (n:Function {project_id: $pid}) RETURN count(n) AS cnt",
                pid=project_id,
            )
            node_count = node_result.single()["cnt"]

            edge_result = session.run(
                "MATCH (:Function {project_id: $pid})-[r:CALLS]->(:Function {project_id: $pid}) "
                "RETURN count(r) AS cnt",
                pid=project_id,
            )
            edge_count = edge_result.single()["cnt"]

            files_result = session.run(
                "MATCH (n:Function {project_id: $pid}) "
                "WHERE n.file IS NOT NULL "
                "RETURN DISTINCT n.file AS file",
                pid=project_id,
            )
            files = [rec["file"] for rec in files_result]

        return {"nodeCount": node_count, "edgeCount": edge_count, "files": files}

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

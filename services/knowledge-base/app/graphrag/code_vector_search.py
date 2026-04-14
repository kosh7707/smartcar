"""CodeVectorSearch — 코드 함수 벡터 검색 + 적재 (Qdrant code_functions 컬렉션)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, FilterSelector, MatchValue

logger = logging.getLogger(__name__)

COLLECTION = "code_functions"

_DANGEROUS_FUNCS = frozenset({
    "system", "popen", "exec", "execl", "execle", "execlp", "execv", "execve", "execvp",
    "memcpy", "memmove", "strcpy", "strncpy", "strcat", "strncat", "sprintf", "vsprintf",
    "gets", "scanf", "fscanf", "sscanf", "fgets",
    "malloc", "calloc", "realloc", "free",
    "fork", "dlopen", "dlsym",
})


@dataclass
class CodeFunctionHit:
    """코드 함수 벡터 검색 결과 단건."""

    name: str
    file: str | None = None
    line: int | None = None
    calls: list[str] = field(default_factory=list)
    origin: str | None = None
    original_lib: str | None = None
    original_version: str | None = None
    build_snapshot_id: str | None = None
    build_unit_id: str | None = None
    source_build_attempt_id: str | None = None
    score: float = 0.0


class CodeVectorSearch:
    """코드 함수 Qdrant 벡터 검색 + 적재."""

    def __init__(self, client: QdrantClient) -> None:
        self._client = client

    @staticmethod
    def _project_filter(project_id: str) -> Filter:
        return Filter(must=[FieldCondition(key="project_id", match=MatchValue(value=project_id))])

    @staticmethod
    def _normalize_provenance(source: dict | None) -> dict[str, str | None]:
        src = source or {}
        return {
            "build_snapshot_id": src.get("build_snapshot_id") or src.get("buildSnapshotId"),
            "build_unit_id": src.get("build_unit_id") or src.get("buildUnitId"),
            "source_build_attempt_id": (
                src.get("source_build_attempt_id") or src.get("sourceBuildAttemptId")
            ),
        }

    @staticmethod
    def _build_document(func: dict) -> str:
        """Function 메타데이터를 임베딩용 자연어 텍스트로 변환한다."""
        parts = [f"Function: {func['name']}"]

        if func.get("file"):
            loc = f"File: {func['file']}"
            if func.get("line"):
                loc += f" (line {func['line']})"
            parts.append(loc)

        calls = func.get("calls", [])
        if calls:
            parts.append(f"Calls: {', '.join(calls)}")
            dangerous = [c for c in calls if c in _DANGEROUS_FUNCS]
            if dangerous:
                parts.append(f"Calls dangerous functions: {', '.join(dangerous)}")

        if func.get("origin"):
            origin_text = f"Origin: {func['origin']}"
            lib = func.get("original_lib") or func.get("originalLib")
            ver = func.get("original_version") or func.get("originalVersion")
            if lib:
                origin_text += f" ({lib}"
                if ver:
                    origin_text += f" {ver}"
                origin_text += ")"
            parts.append(origin_text)

        return "\n".join(parts)

    def ingest(self, project_id: str, functions: list[dict], *, provenance: dict | None = None) -> int:
        """함수 목록을 Qdrant에 벡터로 적재한다. 기존 project_id 데이터는 먼저 삭제."""
        normalized_provenance = self._normalize_provenance(provenance)
        self.delete_project(project_id)

        if not functions:
            return 0

        documents = []
        metadata_list = []

        for func in functions:
            item_provenance = self._normalize_provenance(func.get("provenance"))
            documents.append(self._build_document(func))
            metadata_list.append({
                "project_id": project_id,
                "name": func["name"],
                "file": func.get("file"),
                "line": func.get("line"),
                "calls": func.get("calls", []),
                "origin": func.get("origin"),
                "original_lib": func.get("original_lib") or func.get("originalLib"),
                "original_version": func.get("original_version") or func.get("originalVersion"),
                "build_snapshot_id": item_provenance.get("build_snapshot_id") or normalized_provenance.get("build_snapshot_id"),
                "build_unit_id": item_provenance.get("build_unit_id") or normalized_provenance.get("build_unit_id"),
                "source_build_attempt_id": (
                    item_provenance.get("source_build_attempt_id")
                    or normalized_provenance.get("source_build_attempt_id")
                ),
            })

        batch_size = 100
        for start in range(0, len(documents), batch_size):
            end = min(start + batch_size, len(documents))
            self._client.add(
                collection_name=COLLECTION,
                documents=documents[start:end],
                metadata=metadata_list[start:end],
            )

        logger.info(
            "코드 함수 벡터 적재: project=%s, count=%d",
            project_id, len(documents),
        )
        return len(documents)

    def activate_staging(self, staging_project_id: str, project_id: str) -> None:
        """staging project_id로 적재된 포인트를 활성 project_id로 승격한다."""
        if not self._collection_exists():
            return

        self.delete_project(project_id)
        self._client.set_payload(
            collection_name=COLLECTION,
            payload={"project_id": project_id},
            points=FilterSelector(filter=self._project_filter(staging_project_id)),
            wait=True,
        )
        logger.info(
            "코드 함수 벡터 staging 승격: staging=%s -> project=%s",
            staging_project_id,
            project_id,
        )

    def search(
        self,
        query: str,
        project_id: str,
        top_k: int = 10,
        min_score: float = 0.3,
        build_snapshot_id: str | None = None,
    ) -> list[CodeFunctionHit]:
        """project_id 필터링 + 시맨틱 검색."""
        if not self._collection_exists():
            return []

        must = [FieldCondition(key="project_id", match=MatchValue(value=project_id))]
        if build_snapshot_id is not None:
            must.append(
                FieldCondition(
                    key="build_snapshot_id",
                    match=MatchValue(value=build_snapshot_id),
                )
            )
        query_filter = Filter(must=must)

        results = self._client.query(
            collection_name=COLLECTION,
            query_text=query,
            limit=top_k,
            query_filter=query_filter,
        )

        hits = []
        for r in results:
            if min_score > 0 and r.score < min_score:
                continue
            meta = r.metadata
            hits.append(CodeFunctionHit(
                name=meta.get("name", ""),
                file=meta.get("file"),
                line=meta.get("line"),
                calls=meta.get("calls", []),
                origin=meta.get("origin"),
                original_lib=meta.get("original_lib"),
                original_version=meta.get("original_version"),
                build_snapshot_id=meta.get("build_snapshot_id"),
                build_unit_id=meta.get("build_unit_id"),
                source_build_attempt_id=meta.get("source_build_attempt_id"),
                score=r.score,
            ))
        return hits

    def export_project(self, project_id: str) -> list[dict]:
        """현재 project_id 포인트를 ingest 가능한 함수 목록 형태로 직렬화한다."""
        if not self._collection_exists():
            return []

        records = []
        offset = None
        while True:
            batch, offset = self._client.scroll(
                collection_name=COLLECTION,
                scroll_filter=self._project_filter(project_id),
                limit=256,
                with_payload=True,
                with_vectors=False,
                offset=offset,
            )
            records.extend(batch)
            if offset is None:
                break

        exported = []
        for record in records:
            payload = record.payload or {}
            item = {
                "name": payload.get("name"),
                "file": payload.get("file"),
                "line": payload.get("line"),
                "calls": payload.get("calls", []),
                "origin": payload.get("origin"),
                "originalLib": payload.get("original_lib"),
                "originalVersion": payload.get("original_version"),
            }
            provenance = {
                "buildSnapshotId": payload.get("build_snapshot_id"),
                "buildUnitId": payload.get("build_unit_id"),
                "sourceBuildAttemptId": payload.get("source_build_attempt_id"),
            }
            if any(value is not None for value in provenance.values()):
                item["provenance"] = provenance
            exported.append(item)

        exported.sort(key=lambda item: item["name"] or "")
        return exported

    def delete_project(self, project_id: str) -> None:
        """프로젝트 벡터 데이터 삭제."""
        if not self._collection_exists():
            return

        self._client.delete(
            collection_name=COLLECTION,
            points_selector=FilterSelector(filter=self._project_filter(project_id)),
        )
        logger.info("코드 함수 벡터 삭제: project=%s", project_id)

    def _collection_exists(self) -> bool:
        """code_functions 컬렉션 존재 여부."""
        collections = [c.name for c in self._client.get_collections().collections]
        return COLLECTION in collections

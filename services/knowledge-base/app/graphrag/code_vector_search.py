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
    score: float = 0.0


class CodeVectorSearch:
    """코드 함수 Qdrant 벡터 검색 + 적재."""

    def __init__(self, client: QdrantClient) -> None:
        self._client = client

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

    def ingest(self, project_id: str, functions: list[dict]) -> int:
        """함수 목록을 Qdrant에 벡터로 적재한다. 기존 project_id 데이터는 먼저 삭제."""
        self.delete_project(project_id)

        if not functions:
            return 0

        documents = []
        metadata_list = []

        for func in functions:
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

    def search(
        self,
        query: str,
        project_id: str,
        top_k: int = 10,
        min_score: float = 0.3,
    ) -> list[CodeFunctionHit]:
        """project_id 필터링 + 시맨틱 검색."""
        if not self._collection_exists():
            return []

        query_filter = Filter(
            must=[FieldCondition(key="project_id", match=MatchValue(value=project_id))]
        )

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
                score=r.score,
            ))
        return hits

    def delete_project(self, project_id: str) -> None:
        """프로젝트 벡터 데이터 삭제."""
        if not self._collection_exists():
            return

        self._client.delete(
            collection_name=COLLECTION,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="project_id", match=MatchValue(value=project_id))]
                )
            ),
        )
        logger.info("코드 함수 벡터 삭제: project=%s", project_id)

    def _collection_exists(self) -> bool:
        """code_functions 컬렉션 존재 여부."""
        collections = [c.name for c in self._client.get_collections().collections]
        return COLLECTION in collections

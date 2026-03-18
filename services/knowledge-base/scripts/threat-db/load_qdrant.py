"""
Qdrant 벡터 DB 적재 -- UnifiedThreatRecord -> 임베딩 + 메타데이터
파일 기반 영속 스토리지 사용 (S4 원본: in-memory -> 파일 기반으로 변경)
"""
import time
from qdrant_client import QdrantClient
from schema import UnifiedThreatRecord

EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
COLLECTION = "threat_knowledge"


def load_qdrant(records: list[UnifiedThreatRecord], qdrant_path: str) -> QdrantClient:
    """레코드를 Qdrant 파일 기반 스토리지에 적재"""
    print(f"  모델: {EMBEDDING_MODEL}")
    print(f"  경로: {qdrant_path}")
    print(f"  레코드: {len(records)}건, 배치 크기: 100")

    t0 = time.time()

    client = QdrantClient(path=qdrant_path)
    client.set_model(EMBEDDING_MODEL)

    # 기존 컬렉션 삭제 (재빌드)
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION in existing:
        client.delete_collection(COLLECTION)
        print(f"  기존 컬렉션 삭제: {COLLECTION}")

    # 임베딩 대상 텍스트 + 메타데이터 구성
    documents = []
    metadata_list = []
    ids = []

    for i, rec in enumerate(records):
        mit_text = " | ".join(rec.mitigations[:3]) if rec.mitigations else ""
        doc_text = f"{rec.title}\n{rec.description}"
        if mit_text:
            doc_text += f"\nMitigation: {mit_text}"

        documents.append(doc_text)
        metadata_list.append({
            "id": rec.id,
            "source": rec.source,
            "title": rec.title,
            "attack_surfaces": rec.attack_surfaces,
            "threat_category": rec.threat_category,
            "severity": rec.severity,
            "attack_vector": rec.attack_vector,
            "kill_chain_phase": rec.kill_chain_phase,
            "related_cwe": rec.related_cwe[:5],
            "related_cve": rec.related_cve[:5],
            "related_attack": rec.related_attack[:5],
            "automotive_relevance": rec.automotive_relevance,
        })
        ids.append(i)

    # 배치 적재 (100개씩)
    batch_size = 100
    for start in range(0, len(documents), batch_size):
        end = min(start + batch_size, len(documents))
        client.add(
            collection_name=COLLECTION,
            documents=documents[start:end],
            metadata=metadata_list[start:end],
            ids=ids[start:end],
        )
        if end < len(documents) and end % 500 == 0:
            print(f"  적재 진행: {end}/{len(documents)}")

    t1 = time.time()
    print(f"  완료: {len(documents)}건 적재 ({t1-t0:.1f}초)")

    client.close()
    return None

#!/usr/bin/env python3
"""Qdrant → Neo4j 마이그레이션 스크립트.

Qdrant에 적재된 위협 지식 레코드를 Neo4j 관계 그래프로 이전한다.

Usage:
    cd services/knowledge-base
    source .venv/bin/activate
    python scripts/neo4j-seed.py [--qdrant-path data/qdrant] [--neo4j-uri bolt://localhost:7687]
"""

import argparse
import os
import sys
import time

# 프로젝트 루트를 sys.path에 추가
_script_dir = os.path.dirname(os.path.abspath(__file__))
_service_root = os.path.dirname(_script_dir)
if _service_root not in sys.path:
    sys.path.insert(0, _service_root)


def main():
    parser = argparse.ArgumentParser(description="Qdrant → Neo4j 마이그레이션")
    parser.add_argument("--qdrant-path", default="data/qdrant", help="Qdrant 파일 스토리지 경로")
    parser.add_argument("--neo4j-uri", default="bolt://localhost:7687", help="Neo4j URI")
    parser.add_argument("--neo4j-user", default="neo4j")
    parser.add_argument("--neo4j-password", default="aegis-kb")
    parser.add_argument("--clear", action="store_true", help="기존 Neo4j 데이터 삭제 후 재적재")
    args = parser.parse_args()

    # Qdrant 경로 절대화
    qdrant_path = args.qdrant_path
    if not os.path.isabs(qdrant_path):
        qdrant_path = os.path.join(_service_root, qdrant_path)

    print(f"[1/4] Qdrant 연결: {qdrant_path}")
    from app.rag.threat_search import ThreatSearch
    threat_search = ThreatSearch(qdrant_path)

    print("[2/4] 전체 레코드 스크롤...")
    t0 = time.time()
    records = threat_search.scroll_all_metadata()
    t1 = time.time()
    print(f"  → {len(records)}건 로드 ({t1 - t0:.1f}초)")
    threat_search.close()

    print(f"[3/4] Neo4j 연결: {args.neo4j_uri}")
    import neo4j
    driver = neo4j.GraphDatabase.driver(
        args.neo4j_uri,
        auth=(args.neo4j_user, args.neo4j_password),
    )
    driver.verify_connectivity()

    if args.clear:
        print("  → 기존 위협 노드 삭제...")
        with driver.session() as session:
            for label in ["CWE", "CVE", "Attack", "CAPEC"]:
                session.run(f"MATCH (n:{label}) DETACH DELETE n")
        print("  → 삭제 완료")

    print("[4/4] Neo4j 그래프 구축...")
    from app.graphrag.neo4j_graph import Neo4jGraph
    graph = Neo4jGraph(driver)
    t2 = time.time()
    graph.load_from_records(records)
    t3 = time.time()

    stats = graph.get_stats()
    print(f"\n  완료! ({t3 - t2:.1f}초)")
    print(f"  노드: {stats['nodeCount']}")
    print(f"  관계: {stats['edgeCount']}")
    print(f"  소스 분포: {stats['sources']}")
    print(f"  상위 연결:")
    for node in stats["topConnected"][:5]:
        title = (node.get("title") or "")[:40]
        print(f"    {node['id']}: {title} (degree={node['degree']})")

    driver.close()
    print("\n  Neo4j 시드 완료.")


if __name__ == "__main__":
    main()

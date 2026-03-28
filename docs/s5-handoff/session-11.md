# S5 Session 11 — 2026-03-27

## CVE 고도화 + ATT&CK 브릿지 수정 + 버그 수정

| 변경 | 상세 |
|------|------|
| CVE KB 지식 보강 | CVE 결과에 `kb_context` 추가 — CWE→KB의 threat_category, attack_surfaces, automotive_relevance 자동 매핑 |
| 복합 위험 점수 | `risk_score` 필드 추가 — CVSS 40% + EPSS 30% + KEV 20% + 도메인 관련성 10% 가중 합산 (0.0~1.0) |
| CVE 캐시 영속화 | 인메모리 → `data/cve-cache.json` 파일 영속화. 서비스 재시작 시 NVD 재조회 방지 |
| vendor 추론 확장 | codeberg.org, gitea.com, sr.ht, savannah.gnu.org + git@ SSH + .git suffix 범용 패턴 |
| ATT&CK→CWE 브릿지 수정 | `parse_capec.py`에서 ATT&CK ID T-prefix 정규화. 교차 참조 0%→23%(118/509) 복구 |
| `/v1/ready` seed_timestamp 직렬화 | Neo4j DateTime → ISO 문자열 변환 (`neo4j_graph.py` `get_kb_meta`) |
| stats CVE 잔재 제거 | `stats.py`에서 CVE 행/심각도 분포 섹션 제거 (ETL 범위 외) |
| ETL 스크립트 개선 | `etl-build.sh` — `--fresh` 캐시 초기화, `--include-nvd` 제거, 인자 분리, 소요 시간 표시 |
| `get_stats()` edgeTypes 추가 | `neo4j_graph.py` — 관계 타입별 카운트(`edgeTypes`) 반환. API 계약서에 반영 |
| `timeout.py` 모듈 | X-Timeout-Ms 헤더 파싱 + 데드라인 체크 유틸리티. 모든 POST 라우터에서 사용 |
| 테스트 102→115 | NVD client +11, Neo4jGraph +1 (edgeTypes), CodeVectorSearch +1, API errors +1 |

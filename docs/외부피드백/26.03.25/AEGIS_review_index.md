# AEGIS 공개 저장소 상세 리뷰 패키지

작성 기준: 공개 GitHub 저장소에서 확인 가능한 코드와 문서를 기준으로 작성했다.  
비공개 운영 문서, 팀 내부 의사결정, 로컬 실험 환경은 포함하지 않았다.

## 포함 파일

1. `AEGIS_00_project_direction.md`  
   프로젝트 전체 방향성과 30/60/90일 우선순위, 유지해야 할 원칙, 일부러 늦춰도 되는 것들을 정리한 문서

2. `AEGIS_S1_frontend_QA_review.md`  
   S1 프론트엔드 및 QA 관점 리뷰

3. `AEGIS_S2_backend_orchestrator_review.md`  
   S2 백엔드/오케스트레이터 리뷰

4. `AEGIS_S3_agents_review.md`  
   S3 분석 에이전트 및 빌드 에이전트 리뷰

5. `AEGIS_S4_sast_runner_review.md`  
   S4 SAST-runner 리뷰

6. `AEGIS_S5_knowledge_base_review.md`  
   S5 Knowledge Base / GraphRAG 리뷰

7. `AEGIS_S6_dynamic_analysis_review.md`  
   S6 Adapter / ECU Simulator 리뷰

8. `AEGIS_S7_llm_gateway_review.md`  
   S7 LLM Gateway / LLM Engine 리뷰

## 권장 읽기 순서

1. `AEGIS_00_project_direction.md`
2. S2 → S4 → S5 → S7
3. S1 → S3
4. S6

이 순서가 좋은 이유는, 현재 AEGIS의 본질이 **S2가 흐름을 조율하고, S4/S5가 결정론적 증거를 만들고, S7이 제한된 보조 판단을 제공하며, S1이 이를 분석가 경험으로 수렴시키는 구조**이기 때문이다.

## 한 줄 요약

이 프로젝트의 핵심 과제는 “더 많은 기능 추가”가 아니라, 이미 매우 강한 설계와 구현을 **안정적인 연구 플랫폼/제품 후보 수준으로 마감하는 것**이다.

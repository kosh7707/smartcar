# AEGIS local docs migration notice

이 디렉터리의 문서는 **더 이상 canonical agent-facing 문서 표면이 아니다**.

## 지금부터 어디를 봐야 하나
- Canonical charter: `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
- Canonical index: `/home/kosh/aegis-static-wiki/wiki/system/index.md`
- Handoff: `/home/kosh/aegis-static-wiki/wiki/canon/handoff/**`
- Roadmap: `/home/kosh/aegis-static-wiki/wiki/canon/roadmap/**`
- Work requests: `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/**`
- API / specs: `/home/kosh/aegis-static-wiki/wiki/canon/api/**`, `/home/kosh/aegis-static-wiki/wiki/canon/specs/**`

## 이 폴더의 현재 의미
- `docs/**`는 migration/compatibility copy다.
- wiki canon과 충돌하면 **wiki canon이 우선**한다.
- 신규 durable 문서 변경은 wiki canon에 먼저 반영해야 한다.

## session start rule
모든 세션은 이제 `docs/AEGIS.md` 대신 아래 순서로 시작한다.

1. `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
2. `/home/kosh/aegis-static-wiki/wiki/canon/handoff/{lane}/readme.md`
3. `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/`

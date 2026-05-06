import React, { useState, useMemo } from "react";
import type { NonAcceptedClaim } from "@aegis/shared";
import { OutcomeChip, SeverityBadge } from "@/common/ui/primitives";
import type { OutcomeTone } from "@/common/ui/primitives";

interface Props {
  claims: NonAcceptedClaim[];
}

const STATUS_LABELS: Record<string, string> = {
  candidate: "후보",
  under_evidenced: "증거 부족",
  needs_human_review: "사람 검토 필요",
  rejected: "거부됨",
  retried: "재시도",
  inconclusive: "결론 불가",
  repair_exhausted: "복구 한도 초과",
  withdrawn: "철회됨",
};

const STATUS_PRIORITY: Record<string, number> = {
  rejected: 0,
  repair_exhausted: 1,
  needs_human_review: 2,
  under_evidenced: 3,
  retried: 4,
  inconclusive: 5,
  candidate: 6,
  withdrawn: 7,
};

export function statusToReviewTone(status: string): OutcomeTone {
  switch (status) {
    case "rejected":
    case "repair_exhausted":
      return "critical-review";
    case "needs_human_review":
    case "under_evidenced":
    case "retried":
    case "inconclusive":
    case "candidate":
      return "caution-review";
    case "withdrawn":
      return "neutral-review";
    default:
      return "fallback-review";
  }
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 8;
}

export function sortClaims(claims: NonAcceptedClaim[]): NonAcceptedClaim[] {
  return [...claims].sort((a, b) => {
    const pa = statusPriority(a.status);
    const pb = statusPriority(b.status);
    if (pa !== pb) return pa - pb;
    return (b.retryCount ?? 0) - (a.retryCount ?? 0);
  });
}

export const NonAcceptedClaimsList: React.FC<Props> = ({ claims }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => sortClaims(claims), [claims]);

  const toggle = (key: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <ul className="finding-poc-claims-list">
      {sorted.map((claim, idx) => {
        const key = claim.claimId ?? `claim-${idx}`;
        const open = openIds.has(key);
        const tone = statusToReviewTone(claim.status);
        return (
          <li key={key} className="finding-poc-claim">
            <button
              type="button"
              className="finding-poc-claim__head"
              aria-expanded={open}
              onClick={() => toggle(key)}
            >
              <span className="finding-poc-claim__chip-row">
                <OutcomeChip
                  kind="cleanPass"
                  value={undefined}
                  tone={tone}
                  label={statusLabel(claim.status)}
                  size="sm"
                />
                {claim.severity ? <SeverityBadge severity={claim.severity} /> : null}
                {claim.family ? <span className="finding-poc-claim__family">{claim.family}</span> : null}
                {claim.rejectionCode ? <span className="finding-poc-claim__code">{claim.rejectionCode}</span> : null}
              </span>
              <span className="finding-poc-claim__primary">
                {claim.statement || claim.rejectionReason || "(설명 없음)"}
              </span>
              <span className="finding-poc-claim__meta">
                {claim.primaryLocation ? <span>{claim.primaryLocation}</span> : null}
                {typeof claim.retryCount === "number" ? <span>retry {claim.retryCount}</span> : null}
                <span aria-hidden="true">{open ? "−" : "+"}</span>
              </span>
            </button>
            {open ? (
              <div className="finding-poc-claim__body">
                {claim.rejectionReason ? <p className="finding-poc-claim__field"><strong>사유:</strong> {claim.rejectionReason}</p> : null}
                {claim.detail ? <p className="finding-poc-claim__field"><strong>상세:</strong> {claim.detail}</p> : null}
                {claim.outcomeContribution ? <p className="finding-poc-claim__field"><strong>결과 기여:</strong> <code>{claim.outcomeContribution}</code></p> : null}
                {claim.requiredEvidence?.length ? (
                  <div className="finding-poc-claim__field">
                    <strong>필요 증거:</strong>
                    <ul className="finding-poc-claim__evidence">
                      {claim.requiredEvidence.map((e) => (
                        <li key={e} className={claim.missingEvidence?.includes(e) ? "is-missing" : claim.presentEvidence?.includes(e) ? "is-present" : ""}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {claim.evidenceTrail?.length ? (
                  <div className="finding-poc-claim__field">
                    <strong>증거 trail:</strong>
                    <ul className="finding-poc-claim__trail">
                      {claim.evidenceTrail.map((entry, i) => {
                        // Ref id resolution priority: evidenceRef > evidenceRefId > refId.
                        // S3 contract may use any of the three; if S2 ever drops a field
                        // the fallback chain still surfaces the next available id.
                        const refId = entry.evidenceRef ?? entry.evidenceRefId ?? entry.refId ?? "—";
                        return (
                          <li key={i}>
                            <code>{refId}</code>
                            {entry.role ? <span> · {entry.role}</span> : null}
                            {entry.status ? <span> · {entry.status}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {claim.revisionHistory?.length ? (
                  <div className="finding-poc-claim__field">
                    <strong>수정 이력:</strong>
                    <ul className="finding-poc-claim__history">
                      {claim.revisionHistory.map((entry, i) => (
                        <li key={i}>
                          <span>{entry.fromStatus ?? "—"} → {entry.toStatus ?? "—"}</span>
                          {entry.reason ? <span> · {entry.reason}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {claim.invalidRefs?.length ? <p className="finding-poc-claim__field"><strong>무효 참조:</strong> {claim.invalidRefs.join(", ")}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

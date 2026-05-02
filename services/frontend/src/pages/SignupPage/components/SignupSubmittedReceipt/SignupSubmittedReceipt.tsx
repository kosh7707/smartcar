import "./SignupSubmittedReceipt.css";
import React from "react";
import type { RegistrationRequestStatus } from "@aegis/shared";

interface SubmittedReceipt {
  registrationId: string;
  lookupToken: string;
  lookupExpiresAt: string;
  status: RegistrationRequestStatus;
  createdAt: string;
}

interface SignupSubmittedReceiptProps {
  fullName: string;
  username: string;
  orgCode: string;
  receipt: SubmittedReceipt | null;
}

function formatLookupExpires(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const SignupSubmittedReceipt: React.FC<SignupSubmittedReceiptProps> = ({ fullName, username, orgCode, receipt }) => (
  <div className="org-verify" data-state="ok">
    <div className="status"><span className="dot"></span><span>request submitted · awaiting approval</span></div>
    <div className="row"><span className="k">이름</span><span className="v">{fullName || "—"}</span></div>
    <div className="row"><span className="k">이메일</span><span className="v mono">{username || "—"}</span></div>
    <div className="row"><span className="k">조직 코드</span><span className="v mono">{orgCode || "—"}</span></div>
    {receipt ? (
      <>
        <div className="row"><span className="k">요청 ID</span><span className="v mono">{receipt.registrationId}</span></div>
        <div className="row"><span className="k">조회 토큰</span><span className="v mono">{receipt.lookupToken}</span></div>
        <div className="row"><span className="k">토큰 만료</span><span className="v mono">{formatLookupExpires(receipt.lookupExpiresAt)}</span></div>
      </>
    ) : null}
  </div>
);

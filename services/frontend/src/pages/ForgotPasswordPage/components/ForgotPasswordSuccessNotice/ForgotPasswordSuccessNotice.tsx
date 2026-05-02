import "./ForgotPasswordSuccessNotice.css";
import React from "react";
import { Info } from "lucide-react";

interface ForgotPasswordSuccessNoticeProps {
  email: string;
}

export const ForgotPasswordSuccessNotice: React.FC<ForgotPasswordSuccessNoticeProps> = ({ email }) => (
  <div className="notice chore c-5">
    <Info aria-hidden="true" />
    <div>
      <strong>재설정 링크를 발송했습니다.</strong><br />
      {email || "입력하신 이메일"}로 받은 메일의 링크를 클릭해 새 비밀번호를 설정하세요. 메일이 도착하지 않으면 스팸함을 확인하거나 1시간 뒤 다시 시도해 주세요.
    </div>
  </div>
);

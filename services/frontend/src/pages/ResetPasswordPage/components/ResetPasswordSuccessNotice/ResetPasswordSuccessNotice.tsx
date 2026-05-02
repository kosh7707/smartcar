import "./ResetPasswordSuccessNotice.css";
import React from "react";
import { Info } from "lucide-react";

export const ResetPasswordSuccessNotice: React.FC = () => (
  <div className="notice chore c-5">
    <Info aria-hidden="true" />
    <div>
      <strong>새 비밀번호로 변경되었습니다.</strong><br />
      보안을 위해 기존 세션은 모두 무효화되었습니다. 새 비밀번호로 다시 로그인해 주세요.
    </div>
  </div>
);

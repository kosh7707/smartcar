import "./ResetPasswordInvalidTokenNotice.css";
import React from "react";
import { Info } from "lucide-react";

export const ResetPasswordInvalidTokenNotice: React.FC = () => (
  <div className="notice notice--danger chore c-5" role="alert">
    <Info aria-hidden="true" />
    <div>
      <strong>재설정 링크가 유효하지 않습니다.</strong><br />
      링크가 손상되었거나 이미 사용된 링크입니다. 비밀번호 재설정을 다시 요청해 주세요.
    </div>
  </div>
);

import "./SignupRequestNotice.css";
import React from "react";
import { Info } from "lucide-react";

export const SignupRequestNotice: React.FC = () => (
  <div className="notice chore c-5">
    <Info aria-hidden="true" />
    <div>
      <strong>가입은 승인제로 운영됩니다.</strong><br />
      조직 코드를 입력하고 검증한 뒤, 가입 요청을 제출하세요. 승인은 조직 관리자가 처리합니다.
    </div>
  </div>
);

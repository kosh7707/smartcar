import "./SignupSubmittedNotice.css";
import React from "react";
import { Info } from "lucide-react";

export const SignupSubmittedNotice: React.FC = () => (
  <div className="notice chore c-5">
    <Info aria-hidden="true" />
    <div>
      <strong>가입 요청이 제출되었습니다.</strong><br />
      조직 관리자의 승인을 기다리세요. 승인 후에는 이 페이지에서 입력한 이메일과 비밀번호로 바로 로그인하실 수 있습니다.
    </div>
  </div>
);

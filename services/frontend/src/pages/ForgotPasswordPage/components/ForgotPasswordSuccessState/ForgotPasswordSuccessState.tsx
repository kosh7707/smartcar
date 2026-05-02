import "./ForgotPasswordSuccessState.css";
import React from "react";
import { ForgotPasswordSuccessNotice } from "../ForgotPasswordSuccessNotice/ForgotPasswordSuccessNotice";
import { ForgotPasswordSuccessFooter } from "../ForgotPasswordSuccessFooter/ForgotPasswordSuccessFooter";
import { ForgotPasswordRetryButton } from "../ForgotPasswordRetryButton/ForgotPasswordRetryButton";

interface ForgotPasswordSuccessStateProps {
  email: string;
  onReset: () => void;
}

export const ForgotPasswordSuccessState: React.FC<ForgotPasswordSuccessStateProps> = ({ email, onReset }) => (
  <>
    <ForgotPasswordSuccessNotice email={email} />
    <ForgotPasswordSuccessFooter />
    <ForgotPasswordRetryButton onClick={onReset} />
  </>
);

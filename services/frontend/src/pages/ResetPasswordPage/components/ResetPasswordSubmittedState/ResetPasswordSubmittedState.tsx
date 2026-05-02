import "./ResetPasswordSubmittedState.css";
import React from "react";
import { ResetPasswordSuccessNotice } from "../ResetPasswordSuccessNotice/ResetPasswordSuccessNotice";
import { ResetPasswordSuccessFooter } from "../ResetPasswordSuccessFooter/ResetPasswordSuccessFooter";

export const ResetPasswordSubmittedState: React.FC = () => (
  <>
    <ResetPasswordSuccessNotice />
    <ResetPasswordSuccessFooter />
  </>
);

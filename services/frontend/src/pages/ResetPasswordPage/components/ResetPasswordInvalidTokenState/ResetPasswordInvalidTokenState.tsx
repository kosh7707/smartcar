import "./ResetPasswordInvalidTokenState.css";
import React from "react";
import { ResetPasswordInvalidTokenNotice } from "../ResetPasswordInvalidTokenNotice/ResetPasswordInvalidTokenNotice";
import { ResetPasswordInvalidTokenFooter } from "../ResetPasswordInvalidTokenFooter/ResetPasswordInvalidTokenFooter";

export const ResetPasswordInvalidTokenState: React.FC = () => (
  <>
    <ResetPasswordInvalidTokenNotice />
    <ResetPasswordInvalidTokenFooter />
  </>
);

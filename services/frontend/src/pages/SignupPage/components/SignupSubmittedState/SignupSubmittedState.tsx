import "./SignupSubmittedState.css";
import React from "react";
import type { RegistrationRequestStatus } from "@aegis/shared";
import { SignupSubmittedNotice } from "../SignupSubmittedNotice/SignupSubmittedNotice";
import { SignupSubmittedReceipt } from "../SignupSubmittedReceipt/SignupSubmittedReceipt";
import { SignupFormFooter } from "../SignupFormFooter/SignupFormFooter";
import { SignupResetButton } from "../SignupResetButton/SignupResetButton";

interface SubmittedReceipt {
  registrationId: string;
  lookupToken: string;
  lookupExpiresAt: string;
  status: RegistrationRequestStatus;
  createdAt: string;
}

interface SignupSubmittedStateProps {
  fullName: string;
  username: string;
  orgCode: string;
  receipt: SubmittedReceipt | null;
  onReset: () => void;
}

export const SignupSubmittedState: React.FC<SignupSubmittedStateProps> = ({ fullName, username, orgCode, receipt, onReset }) => (
  <>
    <SignupSubmittedNotice />
    <SignupSubmittedReceipt fullName={fullName} username={username} orgCode={orgCode} receipt={receipt} />
    <SignupFormFooter />
    <SignupResetButton onClick={onReset} />
  </>
);

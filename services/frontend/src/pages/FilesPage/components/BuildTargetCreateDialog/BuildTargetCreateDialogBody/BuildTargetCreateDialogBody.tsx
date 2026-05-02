import "./BuildTargetCreateDialogBody.css";
import React from "react";

interface BuildTargetCreateDialogBodyProps {
  children: React.ReactNode;
}

export const BuildTargetCreateDialogBody: React.FC<BuildTargetCreateDialogBodyProps> = ({ children }) => (
  <div className="build-target-create-dialog__body">{children}</div>
);

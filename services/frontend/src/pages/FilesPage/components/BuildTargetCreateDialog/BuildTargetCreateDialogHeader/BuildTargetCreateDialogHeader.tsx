import "./BuildTargetCreateDialogHeader.css";
import React from "react";

interface BuildTargetCreateDialogHeaderProps {
  title: string;
}

export const BuildTargetCreateDialogHeader: React.FC<BuildTargetCreateDialogHeaderProps> = ({ title }) => (
  <header className="build-target-create-dialog__header">
    <h2>{title}</h2>
  </header>
);

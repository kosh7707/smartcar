import React from "react";
import { FolderSearch } from "lucide-react";
import { DashboardEmptySurface } from "./DashboardEmptySurface";

interface ProjectExplorerEmptyProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const ProjectExplorerEmpty: React.FC<ProjectExplorerEmptyProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <li className="project-list__empty">
      <DashboardEmptySurface
        icon={<FolderSearch size={18} />}
        title={title}
        description={description}
        action={action}
        variant="inline"
      />
    </li>
  );
};

import React from "react";
import { FolderSearch } from "lucide-react";

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
      <div className="project-list__empty-surface">
        <div className="project-list__empty-icon">
          <FolderSearch size={18} />
        </div>
        <div className="project-list__empty-copy">
          <strong className="project-list__empty-title">{title}</strong>
          <p className="project-list__empty-description">{description}</p>
          {action ? <div className="project-list__empty-actions">{action}</div> : null}
        </div>
      </div>
    </li>
  );
};

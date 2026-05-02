import "./FilesWorkspaceSplitter.css";
import React from "react";
import { cn } from "@/common/utils/cn";

interface FilesWorkspaceSplitterProps {
  isResizing: boolean;
  onStartResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNudgeResize: (direction: "left" | "right") => void;
}

export const FilesWorkspaceSplitter: React.FC<FilesWorkspaceSplitterProps> = ({
  isResizing,
  onStartResize,
  onNudgeResize,
}) => {
  return (
    <button
      type="button"
      className={cn("files-workspace-splitter", isResizing && "is-resizing")}
      data-testid="files-source-workspace-splitter"
      aria-label="패널 크기 조절"
      aria-orientation="vertical"
      title="패널 크기 조절"
      onMouseDown={onStartResize}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onNudgeResize("left");
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onNudgeResize("right");
        }
      }}
    />
  );
};

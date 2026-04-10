import React from "react";
import { ChevronRight } from "lucide-react";
import "./ListItem.css";

interface Props {
  onClick?: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  divider?: boolean;
}

export const ListItem: React.FC<Props> = ({ onClick, children, trailing, showChevron = true, divider = true }) => {
  return (
    <div
      className={`list-item${onClick ? " list-item--clickable" : ""}${divider ? " list-item--divider" : ""}`}
      onClick={onClick}
    >
      <div className="list-item__content">{children}</div>
      {(trailing || (showChevron && onClick)) && (
        <div className="list-item__trailing">
          {trailing}
          {showChevron && onClick && <ChevronRight size={14} className="list-item__chevron" />}
        </div>
      )}
    </div>
  );
};

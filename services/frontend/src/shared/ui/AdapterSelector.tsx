import React from "react";
import { Plug } from "lucide-react";
import type { Adapter } from "@aegis/shared";
import { cn } from "@/lib/utils";
import "./AdapterSelector.css";

interface Props {
  adapters: Adapter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const AdapterSelector: React.FC<Props> = ({ adapters, selectedId, onSelect, disabled }) => (
  <div className="adapter-selector">
    {adapters.map((adapter) => (
      <button
        key={adapter.id}
        type="button"
        className={cn(
          "adapter-selector__item",
          selectedId === adapter.id && "is-selected",
        )}
        aria-pressed={selectedId === adapter.id}
        onClick={() => onSelect(adapter.id)}
        disabled={disabled}
      >
        <Plug size={14} />
        <span className="adapter-selector__name">{adapter.name}</span>
        {adapter.ecuMeta && adapter.ecuMeta.length > 0 ? (
          <span className="adapter-selector__meta">
            {adapter.ecuMeta[0].name} · {adapter.ecuMeta[0].canIds.length} IDs
          </span>
        ) : null}
        <code className="adapter-selector__url">{adapter.url}</code>
      </button>
    ))}
  </div>
);

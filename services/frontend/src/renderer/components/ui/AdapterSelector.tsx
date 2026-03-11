import { Plug } from "lucide-react";
import type { Adapter } from "@smartcar/shared";
import "./AdapterSelector.css";

interface Props {
  adapters: Adapter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const AdapterSelector: React.FC<Props> = ({ adapters, selectedId, onSelect, disabled }) => (
  <div className="adapter-selector">
    {adapters.map((a) => (
      <button
        key={a.id}
        className={`adapter-selector__item${selectedId === a.id ? " adapter-selector__item--selected" : ""}`}
        onClick={() => onSelect(a.id)}
        disabled={disabled}
      >
        <Plug size={14} />
        <span className="adapter-selector__name">{a.name}</span>
        {a.ecuMeta && a.ecuMeta.length > 0 && (
          <span className="adapter-selector__ecu">
            {a.ecuMeta[0].name} · {a.ecuMeta[0].canIds.length} IDs
          </span>
        )}
        <code className="adapter-selector__url">{a.url}</code>
      </button>
    ))}
  </div>
);

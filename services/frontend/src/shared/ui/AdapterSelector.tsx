import { Plug } from "lucide-react";
import type { Adapter } from "@aegis/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  adapters: Adapter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const AdapterSelector: React.FC<Props> = ({ adapters, selectedId, onSelect, disabled }) => (
  <div className="flex flex-col gap-3">
    {adapters.map((a) => (
      <Button
        key={a.id}
        type="button"
        variant="outline"
        className={cn(
          "h-auto w-full justify-start gap-3 rounded-lg border-border bg-background px-3 py-3 text-left font-normal hover:border-primary hover:bg-primary/5 disabled:opacity-50",
          selectedId === a.id && "border-primary bg-primary/5 text-foreground",
        )}
        onClick={() => onSelect(a.id)}
        disabled={disabled}
      >
        <Plug size={14} />
        <span className="font-medium">{a.name}</span>
        {a.ecuMeta && a.ecuMeta.length > 0 && (
          <span className="text-sm font-medium text-emerald-700">
            {a.ecuMeta[0].name} · {a.ecuMeta[0].canIds.length} IDs
          </span>
        )}
        <code className="ml-auto max-w-[45%] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{a.url}</code>
      </Button>
    ))}
  </div>
);

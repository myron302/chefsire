import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { safeStringArray } from "@/lib/utils";

export function TagInput({
  label,
  value,
  onChange,
  placeholder = "Type and press Enter…",
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = React.useState("");

  const add = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText("");
  };

  return (
    <div className="w-full">
      <div className="mb-1 text-sm text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" onClick={() => add(text)}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {safeStringArray(value).map((t) => (
            <Badge key={t} variant="secondary" className="flex items-center gap-1">
              {t}
              <button
                className="ml-1"
                onClick={() => onChange(value.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                title={`Remove ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagInput;

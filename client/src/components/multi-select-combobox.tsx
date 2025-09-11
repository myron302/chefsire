import * as React from "react";
import { Check, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Option = { label: string; value: string };

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export function MultiSelectCombobox(props: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  buttonLabel?: string; // visible label, e.g. "Cuisine"
  className?: string;
  maxBadges?: number; // how many selected to show as badges in button
}) {
  const {
    options,
    value,
    onChange,
    placeholder = "Search…",
    emptyLabel = "No options found.",
    buttonLabel = "Select",
    className,
    maxBadges = 2,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [showUpButton, setShowUpButton] = React.useState(false);
  const [showDownButton, setShowDownButton] = React.useState(true);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value]
  );

  const filteredOptions = React.useMemo(
    () =>
      search
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase())
          )
        : options,
    [options, search]
  );

  const toggle = (val: string) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };

  const buttonText =
    selected.length === 0
      ? buttonLabel
      : selected.length <= maxBadges
      ? selected.map((s) => s.label).join(", ")
      : `${selected.length} selected`;

  // Keep scroll buttons in sync (desktop shows both; mobile: up shows only after you scroll)
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateButtons = () => {
      setShowUpButton(list.scrollTop > 0);
      setShowDownButton(
        list.scrollTop + list.clientHeight < list.scrollHeight - 1
      );
    };

    list.addEventListener("scroll", updateButtons);
    updateButtons(); // Initial check
    return () => list.removeEventListener("scroll", updateButtons);
  }, []);

  const scrollUp = () => listRef.current?.scrollBy({ top: -60, behavior: "smooth" });
  const scrollDown = () => listRef.current?.scrollBy({ top: 60, behavior: "smooth" });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between min-w-[12rem]", className)}
        >
          <span className="truncate flex items-center gap-2">
            {buttonText}
            {selected.length > 0 && selected.length <= maxBadges && (
              <span className="hidden md:flex gap-1">
                {selected.map((s) => (
                  <Badge key={s.value} variant="secondary" className="ml-1">
                    {s.label}
                  </Badge>
                ))}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/* NOTE: allow taller list on mobile and enable touch scroll */}
      <PopoverContent className="p-0 w-[320px] sm:w-[360px]" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />

          {/* Scroll controls (helpful on desktop; optional on mobile) */}
          <div className="flex justify-between p-2">
            {showUpButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={scrollUp}
                aria-label="Scroll up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            <div className={cn(showUpButton ? "" : "flex-1")} />
            {showDownButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={scrollDown}
                aria-label="Scroll down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* KEY: touch-friendly vertical scroll + prevent text selection highlight */}
          <CommandList
            ref={listRef}
            className="max-h-[320px] overflow-y-auto touch-pan-y select-none"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => toggle(opt.value)}
                    // Prevent text selection “orange highlight” from stealing the drag gesture
                    onMouseDown={(e) => e.preventDefault()}
                    className="cursor-pointer select-none"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        checked ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelectCombobox;

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
  const [canUp, setCanUp] = React.useState(false);
  const [canDown, setCanDown] = React.useState(true);
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

  // Keep Up/Down enabled states in sync with scroll
  const updateButtons = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const up = el.scrollTop > 0;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setCanUp(up);
    setCanDown(down);
  }, []);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateButtons, { passive: true });
    updateButtons();
    return () => el.removeEventListener("scroll", updateButtons);
  }, [updateButtons]);

  // Recompute when opening, searching, or the filtered list changes
  React.useEffect(() => {
    if (open) {
      // wait a tick for layout
      const id = setTimeout(updateButtons, 0);
      return () => clearTimeout(id);
    }
  }, [open, search, filteredOptions.length, updateButtons]);

  // Smooth scroll helpers for buttons & wheel
  const scrollByAmount = (amount: number) => {
    listRef.current?.scrollBy({ top: amount, behavior: "smooth" });
  };
  const scrollUp = () => scrollByAmount(-64);
  const scrollDown = () => scrollByAmount(64);

  // Desktop wheel (mobile uses native finger drag)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const el = listRef.current;
    if (!el) return;
    const canScroll =
      el.scrollHeight > el.clientHeight &&
      ((e.deltaY < 0 && el.scrollTop > 0) ||
        (e.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight));
    if (canScroll) {
      e.preventDefault();
      el.scrollBy({ top: e.deltaY, behavior: "smooth" });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTimeout(updateButtons, 0);
      }}
    >
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

      {/* Bigger popover on mobile so more options fit */}
      <PopoverContent className="p-0 w-[320px] max-h-[75vh]" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />

          {/* Scroll controls always visible; disabled when not applicable */}
          <div className="flex justify-between p-2">
            <Button variant="ghost" size="sm" onClick={scrollUp} disabled={!canUp} aria-label="Scroll up">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={scrollDown} disabled={!canDown} aria-label="Scroll down">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Native scrolling: touch drag on mobile, wheel on desktop */}
          <CommandList
            ref={listRef}
            onWheel={onWheel}
            className="max-h-[60vh] overflow-y-auto overscroll-contain"
            style={{
              // iOS momentum + allow vertical finger-drag
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
            aria-label="Options"
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
                    className="cursor-pointer"
                    aria-selected={checked}
                    role="option"
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

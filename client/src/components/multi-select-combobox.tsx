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
  buttonLabel?: string;  // visible label, e.g. "Cuisine"
  className?: string;
  maxBadges?: number;    // show up to this many badges inside the button
  maxPopupHeight?: number; // optional: override popup list max height (px)
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
    maxPopupHeight = 480, // ~60vh on most phones
  } = props;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = React.useState(false);
  const [canScrollDown, setCanScrollDown] = React.useState(true);

  // Selected options
  const selected = React.useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value]
  );

  // Filter by search
  const filteredOptions = React.useMemo(
    () =>
      search
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase())
          )
        : options,
    [options, search]
  );

  // Toggle a value
  const toggle = (val: string) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };

  // Button text
  const buttonText =
    selected.length === 0
      ? buttonLabel
      : selected.length <= maxBadges
      ? selected.map((s) => s.label).join(", ")
      : `${selected.length} selected`;

  // Keep the up/down button enablement accurate
  const updateScrollButtons = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const atTop = list.scrollTop <= 0;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    setCanScrollUp(!atTop);
    setCanScrollDown(!atBottom);
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => updateScrollButtons();
    list.addEventListener("scroll", onScroll, { passive: true });
    updateScrollButtons();
    return () => list.removeEventListener("scroll", onScroll);
  }, [updateScrollButtons, open, filteredOptions.length]);

  // When the popover opens or search changes, re-evaluate buttons
  React.useEffect(() => {
    const id = setTimeout(updateScrollButtons, 0);
    return () => clearTimeout(id);
  }, [open, search, filteredOptions.length, updateScrollButtons]);

  const scrollByDelta = (delta: number) => {
    if (listRef.current) {
      listRef.current.scrollBy({ top: delta, behavior: "smooth" });
    }
  };
  const scrollUp = () => scrollByDelta(-64);
  const scrollDown = () => scrollByDelta(+64);

  // Wheel support (desktop trackpads sometimes send horizontal deltas)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!listRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      listRef.current.scrollTop += e.deltaY;
      e.preventDefault();
    }
  };

  // Touch drag should just work with the CSS we add; no JS needed

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

      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          {/* Search */}
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />

          {/* Up/Down controls (always visible; disabled when not applicable) */}
          <div className="flex items-center justify-between px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollUp}
              aria-label="Scroll up"
              disabled={!canScrollUp}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollDown}
              aria-label="Scroll down"
              disabled={!canScrollDown}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Options */}
          <CommandList
            ref={listRef}
            onWheel={onWheel}
            className="cmd-scroll max-h-[60vh] overflow-y-auto overscroll-contain"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              maxHeight: maxPopupHeight,
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

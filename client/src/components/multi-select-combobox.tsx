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

  const listRef = React.useRef<HTMLDivElement>(null);
  const startYRef = React.useRef<number | null>(null);
  const draggingRef = React.useRef<boolean>(false);

  const [showUpButton, setShowUpButton] = React.useState(false);
  const [showDownButton, setShowDownButton] = React.useState(true);

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

  // keep buttons in sync with scroll position
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateButtons = () => {
      setShowUpButton(list.scrollTop > 0);
      setShowDownButton(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
    };

    // defer to ensure layout is measured after popover opens / options render
    const id = requestAnimationFrame(updateButtons);
    list.addEventListener("scroll", updateButtons);
    return () => {
      cancelAnimationFrame(id);
      list.removeEventListener("scroll", updateButtons);
    };
  }, [filteredOptions.length, open]);

  // touch drag logic: allow vertical pan without triggering selection
  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0]?.clientY ?? null;
    draggingRef.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const startY = startYRef.current;
    if (startY == null) return;
    const y = e.touches[0]?.clientY ?? startY;
    // once we move more than ~8px, consider it a scroll gesture
    if (Math.abs(y - startY) > 8) {
      draggingRef.current = true;
    }
  };

  const onItemSelect = (val: string) => {
    // if we were dragging, ignore the "select" that can fire at touchend
    if (draggingRef.current) return;
    toggle(val);
  };

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

      {/* Wider on sm+ screens; taller list so more visible items */}
      <PopoverContent className="p-0 w-[320px] sm:w-[360px]" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />

          {/* Desktop helper buttons; on mobile they’re there but you can also drag */}
          <div className="flex justify-between p-2">
            {showUpButton && (
              <Button variant="ghost" size="sm" onClick={scrollUp} aria-label="Scroll up">
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            <div className={cn(showUpButton ? "" : "flex-1")} />
            {showDownButton && (
              <Button variant="ghost" size="sm" onClick={scrollDown} aria-label="Scroll down">
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          <CommandList
            ref={listRef}
            // IMPORTANT: make this area truly touch-scrollable on iOS/Android
            className="max-h-[320px] overflow-y-auto select-none"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => onItemSelect(opt.value)}
                    // Prevent text selection stealing the gesture; allow taps
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

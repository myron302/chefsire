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

  // Keep the up/down buttons in sync with scroll position
  const updateButtons = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setShowUpButton(list.scrollTop > 0);
    setShowDownButton(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.addEventListener("scroll", updateButtons, { passive: true });
    updateButtons();
    return () => list.removeEventListener("scroll", updateButtons);
  }, [updateButtons]);

  // Smooth scrolling helpers (used by buttons & wheel)
  const scrollByAmount = (amount: number) => {
    listRef.current?.scrollBy({ top: amount, behavior: "smooth" });
  };
  const scrollUp = () => scrollByAmount(-64);
  const scrollDown = () => scrollByAmount(64);

  // Enable desktop mouse wheel scrolling + mobile touch drag.
  // - touch drag works by default via CSS (overflow + touch-action)
  // - wheel: ensure the list consumes the wheel and scrolls smoothly
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // If the list is scrollable, use the delta to scroll
    const list = listRef.current;
    if (!list) return;

    // Only prevent default if we can actually scroll; otherwise let the page scroll.
    const canScroll =
      list.scrollHeight > list.clientHeight &&
      ((e.deltaY < 0 && list.scrollTop > 0) ||
        (e.deltaY > 0 && list.scrollTop + list.clientHeight < list.scrollHeight));

    if (canScroll) {
      e.preventDefault();
      list.scrollBy({ top: e.deltaY, behavior: "smooth" });
    }
  };

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
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />

          {/* Quick scroll controls */}
          <div className="flex justify-between p-2">
            {showUpButton ? (
              <Button variant="ghost" size="sm" onClick={scrollUp} aria-label="Scroll up">
                <ChevronUp className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
            {showDownButton ? (
              <Button variant="ghost" size="sm" onClick={scrollDown} aria-label="Scroll down">
                <ChevronDown className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
          </div>

          {/* Scrollable list: mouse wheel + touch drag */}
          <CommandList
            ref={listRef}
            onWheel={onWheel}
            className="max-h-[260px] overflow-y-auto touch-action-pan-y overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
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

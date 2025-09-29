// client/src/lib/receiptParsing.ts
export type ParsedItem = {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
};

const UNIT_WORDS = [
  "lb","lbs","oz","kg","g","ml","l","liter","liters","dozen","pack","pkg","pc","pcs",
  "cup","cups","tsp","tbsp","can","cans","bottle","bottles","jar","jars"
];

// super light category hints – tune as you like
const CATEGORY_HINTS: Record<string, string> = {
  // produce
  banana: "produce", bananas: "produce", apple: "produce", apples: "produce",
  tomato: "produce", tomatoes: "produce", onion: "produce", onions: "produce",
  lettuce: "produce", spinach: "produce", kale: "produce", carrot: "produce",
  // dairy
  milk: "dairy", yogurt: "dairy", cheese: "dairy", butter: "dairy", eggs: "dairy",
  // meat/seafood
  chicken: "meat", beef: "meat", pork: "meat", salmon: "seafood", tuna: "seafood",
  // pantry
  rice: "grains", pasta: "grains", bread: "grains", flour: "pantry", sugar: "pantry",
  salt: "spices", pepper: "spices", oil: "pantry", cereal: "grains",
  // beverages
  juice: "beverages", soda: "beverages", coffee: "beverages", tea: "beverages",
  // frozen/canned
  frozen: "frozen", canned: "canned",
};

function guessCategory(name: string): string {
  const w = name.toLowerCase().split(/\s+/);
  for (const token of w) {
    if (CATEGORY_HINTS[token]) return CATEGORY_HINTS[token];
  }
  return "pantry";
}

function cleanLine(raw: string) {
  // remove prices, totals, tax, etc.
  let s = raw.replace(/\$?\s*\d+([.,]\d{2})?/g, ""); // remove $9.99 or 9.99
  s = s.replace(/\b(total|subtotal|tax|change|balance|visa|mastercard|debit|credit)\b/i, "");
  return s.trim();
}

/**
 * Tries to extract: quantity, unit, item name from a single receipt line.
 * Supports patterns like:
 *  - "2x milk 1L"
 *  - "milk 2"
 *  - "milk 2 l"
 *  - "bananas 3 lb"
 *  - "1 dozen eggs"
 */
export function parseLineToItem(line: string): ParsedItem | null {
  const s = cleanLine(line);
  if (!s || s.length < 2) return null;

  // remove "x" multipliers like "2x"
  let txt = s.replace(/\b(\d+)\s*x\b/gi, "$1 ").trim();

  // tokens to scan
  const parts = txt.split(/\s+/);

  // Try to find numbers + units anywhere in the line
  let qty: number | undefined;
  let unit: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    // number possibly with decimal
    if (!qty && /^(\d+(\.\d+)?)$/.test(p)) {
      qty = parseFloat(p);
      // look ahead for unit
      const next = (parts[i + 1] || "").toLowerCase();
      if (UNIT_WORDS.includes(next.replace(/[^\w]/g, ""))) {
        unit = next.toLowerCase();
        i++; // consume unit
      }
      continue;
    }

    // combined like "2lb" or "500g"
    if (!qty && /^(\d+(\.\d+)?)([a-zA-Z]+)$/.test(p)) {
      const m = p.match(/^(\d+(\.\d+)?)([a-zA-Z]+)$/);
      if (m) {
        qty = parseFloat(m[1]);
        unit = m[3].toLowerCase();
        continue;
      }
    }
  }

  // Build a "name" from non-qty/unit tokens
  const nameTokens = parts.filter((w) => {
    if (/^(\d+(\.\d+)?)$/.test(w)) return false; // a pure number
    const lower = w.toLowerCase();
    if (UNIT_WORDS.includes(lower.replace(/[^\w]/g, ""))) return false;
    if (/^(\d+(\.\d+)?)[a-zA-Z]+$/.test(w)) return false; // 500g etc
    return true;
  });

  const name = nameTokens.join(" ").replace(/[-–]{2,}/g, " ").trim();
  if (!name) return null;

  const item: ParsedItem = {
    name: name.replace(/\s{2,}/g, " ").trim(),
  };
  if (qty && isFinite(qty)) item.quantity = qty;
  if (unit) item.unit = unit;
  item.category = guessCategory(item.name);
  return item;
}

export function parseReceiptText(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  for (const line of lines) {
    const it = parseLineToItem(line);
    if (it) {
      // basic dedupe by name (case-insensitive)
      const idx = items.findIndex((x) => x.name.toLowerCase() === it.name.toLowerCase());
      if (idx >= 0) {
        // merge quantities if both present
        const curr = items[idx];
        items[idx] = {
          ...curr,
          quantity: (curr.quantity || 0) + (it.quantity || 1),
          unit: it.unit || curr.unit,
        };
      } else {
        items.push({ ...it, quantity: it.quantity ?? 1, unit: it.unit ?? "piece" });
      }
    }
  }

  return items;
}

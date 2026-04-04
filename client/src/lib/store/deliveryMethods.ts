const FORM_TO_MARKETPLACE_METHOD: Record<string, string> = {
  shipped: 'shipping',
  shipping: 'shipping',
  pickup: 'pickup',
  in_store: 'in_store',
  digital_download: 'digital',
  digital: 'digital',
};

const MARKETPLACE_TO_FORM_METHOD: Record<string, string> = {
  shipping: 'shipped',
  shipped: 'shipped',
  pickup: 'pickup',
  in_store: 'in_store',
  digital: 'digital_download',
  digital_download: 'digital_download',
};

export function normalizeDeliveryMethodsForMarketplace(methods: string[] = []): string[] {
  return Array.from(
    new Set(
      methods
        .map((method) => FORM_TO_MARKETPLACE_METHOD[method] || method)
        .filter(Boolean),
    ),
  );
}

export function normalizeDeliveryMethodsForForm(methods: string[] = []): string[] {
  const normalized = Array.from(
    new Set(
      methods
        .map((method) => MARKETPLACE_TO_FORM_METHOD[method] || method)
        .filter(Boolean),
    ),
  );

  return normalized.length > 0 ? normalized : ['shipped'];
}

export function matchesDeliveryFilter(methods: string[] = [], filter: string): boolean {
  if (filter === 'all') return true;
  return normalizeDeliveryMethodsForMarketplace(methods).includes(filter);
}

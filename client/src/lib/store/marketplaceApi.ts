import { MarketplaceProduct, MarketplaceProductPayload, MarketplaceProductsResponse } from './marketplaceTypes';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function getMarketplaceProducts(params: URLSearchParams): Promise<MarketplaceProductsResponse> {
  const data = await getJson<{ products?: MarketplaceProduct[]; total?: number }>(
    `/api/marketplace/products?${params.toString()}`,
  );

  return {
    products: data.products || [],
    total: data.total || 0,
  };
}

export async function getMarketplaceProduct(productId: string | number): Promise<MarketplaceProduct | null> {
  const response = await fetch(`/api/marketplace/products/${productId}`);
  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function getSellerMarketplaceProducts(
  sellerId: string | number,
  init?: RequestInit,
): Promise<MarketplaceProduct[]> {
  const data = await getJson<{ products?: MarketplaceProduct[] }>(
    `/api/marketplace/sellers/${sellerId}/products`,
    init,
  );

  return data.products || [];
}

export async function saveMarketplaceProduct(
  payload: MarketplaceProductPayload,
  productId?: string | number | null,
): Promise<{ ok: boolean; data: any }> {
  const url = productId ? `/api/marketplace/products/${productId}` : '/api/marketplace/products';
  const method = productId ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { ok: response.ok, data };
}

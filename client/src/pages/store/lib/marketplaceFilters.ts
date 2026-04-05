import { matchesDeliveryFilter } from "@/lib/store/deliveryMethods";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";

export interface MarketplaceFilters {
  search: string;
  category: string;
  location: string;
  sortBy: string;
  deliveryMethod: string;
  priceRange: string;
}

export const defaultMarketplaceFilters: MarketplaceFilters = {
  search: "",
  category: "all",
  location: "",
  sortBy: "relevance",
  deliveryMethod: "all",
  priceRange: "all"
};

export const marketplaceCategories = [
  { value: "all", label: "All Categories" },
  { value: "digital", label: "Digital Products" },
  { value: "physical", label: "Physical Items" },
  { value: "recipe", label: "Recipes & Meal Plans" },
  { value: "course", label: "Cooking Courses" },
  { value: "equipment", label: "Kitchen Equipment" },
  { value: "ingredient", label: "Ingredients" },
  { value: "service", label: "Services" }
];

export const marketplaceSortOptions = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest First" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "popular", label: "Most Popular" }
];

export const marketplaceDeliveryMethods = [
  { value: "all", label: "All Delivery" },
  { value: "shipping", label: "Shipping" },
  { value: "pickup", label: "Local Pickup" },
  { value: "digital", label: "Digital Download" },
  { value: "in_store", label: "In-Store Only" }
];

export const MARKETPLACE_PAGE_SIZE = 12;

export const buildMarketplaceQueryParams = (filters: MarketplaceFilters, currentPage: number) => {
  const params = new URLSearchParams();

  if (filters.search) params.append("query", filters.search);
  if (filters.category !== "all") params.append("category", filters.category);
  if (filters.location) params.append("location", filters.location);

  params.append("limit", MARKETPLACE_PAGE_SIZE.toString());
  params.append("offset", ((currentPage - 1) * MARKETPLACE_PAGE_SIZE).toString());

  return params;
};

export const applyMarketplaceFiltersAndSorting = (
  products: MarketplaceProduct[],
  filters: MarketplaceFilters
) => {
  let filteredProducts = [...products];

  if (filters.deliveryMethod !== "all") {
    filteredProducts = filteredProducts.filter((product) =>
      matchesDeliveryFilter(product.deliveryMethods, filters.deliveryMethod)
    );
  }

  switch (filters.sortBy) {
    case "newest":
      filteredProducts.sort((a, b) => b.id - a.id);
      break;
    case "price_low":
      filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      break;
    case "price_high":
      filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      break;
    case "rating":
      filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "popular":
      filteredProducts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      break;
    default:
      break;
  }

  return filteredProducts;
};

import { normalizeDeliveryMethodsForForm } from './deliveryMethods';
import { MarketplaceProduct, MarketplaceProductPayload } from './marketplaceTypes';

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  inventory: string;
  category: string;
  images: string[];
  productCategory: string;
  deliveryMethods: string[];
  digitalFileUrl: string;
  digitalFileName: string;
}

export function toProductFormData(product: Partial<MarketplaceProduct>): ProductFormData {
  return {
    name: product.name || '',
    description: product.description || '',
    price: product.price?.toString() || '',
    inventory: product.inventory?.toString() || '',
    category: product.category || '',
    images: product.images || [],
    productCategory: product.productCategory || 'physical',
    deliveryMethods: normalizeDeliveryMethodsForForm(product.deliveryMethods || ['shipped']),
    digitalFileUrl: product.digitalFileUrl || '',
    digitalFileName: product.digitalFileName || '',
  };
}

export function buildMarketplaceProductPayload(formData: ProductFormData): MarketplaceProductPayload {
  const inventory = parseInt(formData.inventory, 10);

  return {
    name: formData.name.trim(),
    description: formData.description.trim(),
    price: formData.price.trim(),
    inventory,
    category: formData.category.trim() || 'other',
    images: formData.images,
    productCategory: formData.productCategory,
    deliveryMethods: normalizeDeliveryMethodsForForm(formData.deliveryMethods),
    digitalFileUrl: formData.digitalFileUrl.trim() || null,
    digitalFileName: formData.digitalFileName.trim() || null,
    isDigital: formData.productCategory === 'digital' || formData.productCategory === 'cookbook',
    inStoreOnly:
      formData.deliveryMethods.length === 1 &&
      (formData.deliveryMethods[0] === 'pickup' || formData.deliveryMethods[0] === 'in_store'),
  };
}

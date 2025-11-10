-- Migration: Add delivery method and product category fields for commission calculation
-- Date: 2025-11-10

-- Add product category fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_category TEXT DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS in_store_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS digital_file_url TEXT;

-- Add index on product_category
CREATE INDEX IF NOT EXISTS products_product_category_idx ON products(product_category);

-- Add delivery method to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'shipped';

-- Comment on new columns
COMMENT ON COLUMN products.product_category IS 'Type of product: physical, digital, cookbook, course, ingredient, tool';
COMMENT ON COLUMN products.in_store_only IS 'Product can only be purchased in-store';
COMMENT ON COLUMN products.is_digital IS 'Product is delivered digitally';
COMMENT ON COLUMN products.digital_file_url IS 'URL for digital product download';
COMMENT ON COLUMN orders.delivery_method IS 'How the order will be fulfilled: shipped, pickup, in_store, digital';

-- Add subscription tier to stores table if not exists
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

COMMENT ON COLUMN stores.subscription_tier IS 'Store subscription tier: free, starter, pro, enterprise';

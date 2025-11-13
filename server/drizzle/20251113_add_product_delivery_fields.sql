-- Migration: Add delivery method fields to products table
-- Date: 2025-11-13

-- Add product category and delivery fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_category TEXT DEFAULT 'physical';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS in_store_only BOOLEAN DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_url TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add index on product_category for filtering
CREATE INDEX IF NOT EXISTS products_product_category_idx ON products(product_category);

-- Add index on pickup_location for local product discovery
CREATE INDEX IF NOT EXISTS products_pickup_location_idx ON products(pickup_location);

-- Comments for documentation
COMMENT ON COLUMN products.product_category IS 'Type of product: physical, digital, cookbook, course, ingredient, tool';
COMMENT ON COLUMN products.in_store_only IS 'Product can only be purchased in-store (not shipped or pickup)';
COMMENT ON COLUMN products.is_digital IS 'Product is delivered digitally (download)';
COMMENT ON COLUMN products.digital_file_url IS 'URL for digital product download';
COMMENT ON COLUMN products.digital_file_name IS 'Original filename of digital product';

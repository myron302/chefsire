-- Migration: Add missing product columns
-- Date: 2025-11-13
-- Description: Adds product_category and digital_file_name columns to products table

-- Add product_category column (physical, digital, cookbook, course, ingredient, tool)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_category TEXT DEFAULT 'physical';

-- Add digital_file_name column for storing original filename
ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add comments
COMMENT ON COLUMN products.product_category IS 'Type of product: physical, digital, cookbook, course, ingredient, tool';
COMMENT ON COLUMN products.digital_file_name IS 'Original filename of the uploaded digital product file';

-- Create index on product_category for faster queries
CREATE INDEX IF NOT EXISTS products_product_category_idx ON products(product_category);

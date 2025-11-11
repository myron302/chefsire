-- Migration: Add digital_file_name column to products table
-- Adds support for storing original filename for digital products

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN products.digital_file_name IS 'Original filename for digital products (cookbooks, courses, etc.)';

-- Migration: Add digital_file_name column to products table
-- Date: 2025-11-13
-- Description: Adds column to store the original filename of digital products

-- Add digital_file_name column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN products.digital_file_name IS 'Original filename of the uploaded digital product file';

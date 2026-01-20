-- Migration: Add nif column to datos_facturacion table
-- Date: 2026-01-14
-- Description: Allow billing configurations to have their own NIF/CIF

-- Add nif column to datos_facturacion
ALTER TABLE datos_facturacion ADD COLUMN IF NOT EXISTS nif VARCHAR(15);

-- Comment
COMMENT ON COLUMN datos_facturacion.nif IS 'NIF/CIF for this billing configuration (falls back to user NIF if null)';

-- Migration: Add datos_facturacion_id to facturas_emitidas
-- Date: 2026-01-15
-- Description: Allow selecting which billing configuration to use for each invoice

-- Add datos_facturacion_id column to facturas_emitidas
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS datos_facturacion_id INTEGER REFERENCES datos_facturacion(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_facturas_datos_facturacion ON facturas_emitidas(datos_facturacion_id)
WHERE datos_facturacion_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN facturas_emitidas.datos_facturacion_id IS 'Reference to the billing configuration used for this invoice';

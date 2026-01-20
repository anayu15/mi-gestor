-- Migration: Add es_principal to datos_facturacion
-- Date: 2026-01-15
-- Description: Allow multiple active billing configs and add es_principal flag for default selection

-- Add es_principal column
ALTER TABLE datos_facturacion
ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT false;

-- Create partial unique index to ensure only one principal per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_facturacion_principal
ON datos_facturacion(user_id)
WHERE es_principal = true;

-- Set the first active config as principal for existing users (if any)
UPDATE datos_facturacion df
SET es_principal = true
WHERE df.activo = true
AND NOT EXISTS (
  SELECT 1 FROM datos_facturacion df2
  WHERE df2.user_id = df.user_id AND df2.es_principal = true
);

-- Comment
COMMENT ON COLUMN datos_facturacion.es_principal IS 'Only one config can be principal per user - used as default selection';

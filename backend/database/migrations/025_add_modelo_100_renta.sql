-- Migration: Add Modelo 100 (RENTA) visibility preference
-- Date: 2026-01-15
-- Description: Adds support for Modelo 100 - Declaracion de la Renta (annual IRPF declaration)

-- IRPF Section - Modelo 100 (Renta)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_100 BOOLEAN DEFAULT false;

-- Comments for documentation
COMMENT ON COLUMN users.mostrar_modelo_100 IS 'Modelo 100 - Declaracion de la Renta (IRPF anual)';

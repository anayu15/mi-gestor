-- Migration: Add modelo 180 and 390 visibility preferences
-- Date: 2026-01-12
-- Description: Add columns to control visibility of annual tax models (180 and 390)

-- Add model visibility columns to users table
ALTER TABLE users
ADD COLUMN mostrar_modelo_180 BOOLEAN DEFAULT false,
ADD COLUMN mostrar_modelo_390 BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN users.mostrar_modelo_180 IS 'Controls visibility of Modelo 180 (Annual rental withholdings report) in navigation and direct access';
COMMENT ON COLUMN users.mostrar_modelo_390 IS 'Controls visibility of Modelo 390 (Annual VAT summary) in navigation and direct access';

-- Update index for model visibility to include new columns
DROP INDEX IF EXISTS idx_users_model_visibility;
CREATE INDEX idx_users_model_visibility ON users(mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115, mostrar_modelo_180, mostrar_modelo_390);

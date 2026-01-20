-- Migration: Add model visibility preferences
-- Date: 2026-01-11
-- Description: Add columns to control which tax models users want to see in navigation

-- Add model visibility columns to users table
ALTER TABLE users
ADD COLUMN mostrar_modelo_303 BOOLEAN DEFAULT true,
ADD COLUMN mostrar_modelo_130 BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN users.mostrar_modelo_303 IS 'Controls visibility of Modelo 303 (VAT) in navigation and direct access';
COMMENT ON COLUMN users.mostrar_modelo_130 IS 'Controls visibility of Modelo 130 (IRPF) in navigation and direct access';

-- Create index for potential future queries filtering by these preferences
CREATE INDEX idx_users_model_visibility ON users(mostrar_modelo_303, mostrar_modelo_130);

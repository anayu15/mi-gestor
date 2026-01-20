-- Migration: Add company invoice fields to users table
-- Date: 2026-01-11
-- Description: Add fields needed for invoice PDF generation

-- Add company information fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS razon_social VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_facturacion VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notas_factura TEXT;

-- Create index for faster IBAN queries (optional, for future features)
CREATE INDEX IF NOT EXISTS idx_users_iban ON users(iban);

-- Add comments for documentation
COMMENT ON COLUMN users.razon_social IS 'Business name or legal name for invoices';
COMMENT ON COLUMN users.direccion IS 'Complete business address';
COMMENT ON COLUMN users.codigo_postal IS 'Postal code';
COMMENT ON COLUMN users.ciudad IS 'City';
COMMENT ON COLUMN users.provincia IS 'Province/State';
COMMENT ON COLUMN users.telefono IS 'Contact phone number';
COMMENT ON COLUMN users.email_facturacion IS 'Email for invoice communications';
COMMENT ON COLUMN users.iban IS 'Bank account IBAN for payment instructions';
COMMENT ON COLUMN users.logo_url IS 'Path to company logo file';
COMMENT ON COLUMN users.notas_factura IS 'Legal footer notes for invoices';

-- Migration: Fix datos_facturacion foreign key to reference users table
-- Date: 2026-01-16
-- Description: The datos_facturacion table was incorrectly created referencing usuarios(id),
--              but the application uses the users table. This migration fixes the FK constraint.

-- Step 1: Drop the incorrect foreign key constraint (if it exists)
ALTER TABLE datos_facturacion DROP CONSTRAINT IF EXISTS datos_facturacion_user_id_fkey;

-- Step 2: Drop existing indexes that reference user_id
DROP INDEX IF EXISTS idx_datos_facturacion_user;
DROP INDEX IF EXISTS idx_datos_facturacion_activo;
DROP INDEX IF EXISTS idx_datos_facturacion_principal;

-- Step 3: Clear any existing data (can't migrate user_ids between tables)
DELETE FROM datos_facturacion;

-- Step 4: Drop and recreate user_id column with correct type (INTEGER to match users.id)
ALTER TABLE datos_facturacion DROP COLUMN IF EXISTS user_id;
ALTER TABLE datos_facturacion ADD COLUMN user_id INTEGER NOT NULL;

-- Step 5: Add the correct foreign key constraint referencing users(id)
ALTER TABLE datos_facturacion ADD CONSTRAINT datos_facturacion_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_datos_facturacion_user ON datos_facturacion(user_id);
CREATE INDEX IF NOT EXISTS idx_datos_facturacion_activo ON datos_facturacion(user_id, activo) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_datos_facturacion_principal ON datos_facturacion(user_id) WHERE es_principal = true;

-- Verification comment
COMMENT ON TABLE datos_facturacion IS 'Multiple billing configurations per user for invoice generation - FK fixed to users(id)';

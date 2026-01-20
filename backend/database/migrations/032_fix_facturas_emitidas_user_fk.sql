-- Migration: Fix facturas_emitidas foreign key to reference users table
-- Date: 2026-01-16
-- Description: The facturas_emitidas table was created referencing usuarios(id),
--              but the application uses the users table. This migration fixes the FK constraint.

-- Step 1: Drop the incorrect foreign key constraint (if it exists)
ALTER TABLE facturas_emitidas DROP CONSTRAINT IF EXISTS facturas_emitidas_user_id_fkey;

-- Step 2: Drop existing indexes that reference user_id
DROP INDEX IF EXISTS idx_facturas_user;
DROP INDEX IF EXISTS idx_facturas_user_serie_numero;

-- Step 3: Clear any existing data that might have invalid user references
-- (can't migrate user_ids between tables if IDs don't match)
DELETE FROM facturas_emitidas WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

-- Step 4: Add the correct foreign key constraint referencing users(id)
ALTER TABLE facturas_emitidas ADD CONSTRAINT facturas_emitidas_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas_emitidas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_user_serie_numero ON facturas_emitidas(user_id, serie, numero_factura);

-- Verification comment
COMMENT ON CONSTRAINT facturas_emitidas_user_id_fkey ON facturas_emitidas IS 'Foreign key to users(id) - Fixed to reference correct users table';

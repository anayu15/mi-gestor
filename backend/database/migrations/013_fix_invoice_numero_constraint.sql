-- Migration 013: Fix numero_factura UNIQUE constraint to be scoped per user
-- Problem: Global UNIQUE constraint causes "duplicate key" errors when different users
-- try to create invoices with the same number (e.g., 2024-001)
-- Solution: Change to composite UNIQUE constraint (user_id, numero_factura)

-- Step 1: Drop global UNIQUE constraint
-- Try both possible constraint names (depending on how it was created)
ALTER TABLE facturas_emitidas
DROP CONSTRAINT IF EXISTS invoices_numero_factura_key;

ALTER TABLE facturas_emitidas
DROP CONSTRAINT IF EXISTS facturas_emitidas_numero_factura_key;

-- Step 2: Check for existing duplicates within same user
-- This will fail the migration if duplicates exist, requiring manual resolution
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, numero_factura, COUNT(*) as count
    FROM facturas_emitidas
    GROUP BY user_id, numero_factura
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate invoice numbers found for same user. Manual resolution required. Run: SELECT user_id, numero_factura, COUNT(*) FROM facturas_emitidas GROUP BY user_id, numero_factura HAVING COUNT(*) > 1';
  END IF;
END $$;

-- Step 3: Add composite UNIQUE constraint scoped to user_id + numero_factura
-- This allows different users to have invoice 2024-001, but prevents duplicates within same user
ALTER TABLE facturas_emitidas
ADD CONSTRAINT facturas_emitidas_user_numero_unique
UNIQUE (user_id, numero_factura);

-- Step 4: Add performance index for common query pattern (user + serie + year lookups)
CREATE INDEX IF NOT EXISTS idx_facturas_user_serie_numero
ON facturas_emitidas(user_id, serie, numero_factura);

-- Step 5: Add helpful comment for future developers
COMMENT ON CONSTRAINT facturas_emitidas_user_numero_unique
ON facturas_emitidas
IS 'Each user can have unique invoice numbers scoped to their account. Different users can have the same invoice number.';

-- Verification query (optional - for manual checking)
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'facturas_emitidas'::regclass AND conname LIKE '%numero%';

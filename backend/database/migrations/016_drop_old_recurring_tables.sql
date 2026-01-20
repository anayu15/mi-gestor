-- Migration: 016_drop_old_recurring_tables.sql
-- Description: Drop old recurring invoice tables and columns after migrating to programaciones
-- This removes the old template-based recurring system

-- Drop recurring invoice history table
DROP TABLE IF EXISTS recurring_invoice_history CASCADE;

-- Drop recurring invoice templates table
DROP TABLE IF EXISTS recurring_invoice_templates CASCADE;

-- Remove old columns from facturas_emitidas
ALTER TABLE facturas_emitidas DROP COLUMN IF EXISTS template_id;
ALTER TABLE facturas_emitidas DROP COLUMN IF EXISTS es_recurrente;

-- Note: The new programaciones system uses:
-- - programaciones table (created in migration 015)
-- - programacion_id column on facturas_emitidas and expenses (created in migration 015)

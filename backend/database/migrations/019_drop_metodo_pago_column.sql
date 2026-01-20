-- Migration 019: Drop metodo_pago column from facturas_emitidas table
-- Date: 2026-01-14
-- Description: Remove the metodo_pago (payment method) field as it's no longer needed

-- Drop the metodo_pago column from facturas_emitidas
ALTER TABLE facturas_emitidas DROP COLUMN IF EXISTS metodo_pago;

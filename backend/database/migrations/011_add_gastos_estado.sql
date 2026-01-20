-- Migration 011: Add estado functionality to expenses and sync fields
-- Adds pagado, fecha_pago, metodo_pago to expenses and creates trigger to sync estado/pagada in facturas_emitidas

-- Add pagado column to expenses (boolean to track payment status)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT false;

-- Add fecha_pago column to expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- Add metodo_pago column to expenses for consistency with invoices
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Add index on pagado field for performance
CREATE INDEX IF NOT EXISTS idx_expenses_pagado ON expenses(pagado);

-- Update existing records: set fecha_pago to fecha_emision for paid expenses if not set
UPDATE expenses
SET fecha_pago = fecha_emision
WHERE pagado = true AND fecha_pago IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN expenses.pagado IS 'Indicates whether the expense has been paid (Pendiente=false, Pagado=true)';
COMMENT ON COLUMN expenses.fecha_pago IS 'Date when the expense was actually paid';
COMMENT ON COLUMN expenses.metodo_pago IS 'Payment method used (Transferencia, Efectivo, Tarjeta, etc.)';

-- Create trigger function to keep estado and pagada in sync for invoices
CREATE OR REPLACE FUNCTION sync_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If estado is PAGADA but pagada is false, sync pagada to true
  IF NEW.estado = 'PAGADA' AND NEW.pagada = false THEN
    NEW.pagada = true;
  -- If estado is PENDIENTE but pagada is true, sync pagada to false
  ELSIF NEW.estado = 'PENDIENTE' AND NEW.pagada = true THEN
    NEW.pagada = false;
  -- If pagada is true but estado is PENDIENTE, sync estado to PAGADA
  ELSIF NEW.pagada = true AND NEW.estado = 'PENDIENTE' THEN
    NEW.estado = 'PAGADA';
  -- If pagada is false but estado is PAGADA, sync estado to PENDIENTE
  ELSIF NEW.pagada = false AND NEW.estado = 'PAGADA' THEN
    NEW.estado = 'PENDIENTE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to facturas_emitidas to auto-sync on INSERT and UPDATE
CREATE TRIGGER trg_sync_invoice_status
  BEFORE INSERT OR UPDATE ON facturas_emitidas
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_status();

-- Sync existing invoices: estado PAGADA should have pagada = true
UPDATE facturas_emitidas
SET pagada = true
WHERE estado = 'PAGADA' AND pagada = false;

-- Sync existing invoices: estado PENDIENTE should have pagada = false
UPDATE facturas_emitidas
SET pagada = false
WHERE estado = 'PENDIENTE' AND pagada = true;

-- Sync existing invoices: pagada true should have estado PAGADA
UPDATE facturas_emitidas
SET estado = 'PAGADA'
WHERE pagada = true AND estado = 'PENDIENTE';

-- Sync existing invoices: pagada false should have estado PENDIENTE
UPDATE facturas_emitidas
SET estado = 'PENDIENTE'
WHERE pagada = false AND estado = 'PAGADA';

-- Add comments for the trigger
COMMENT ON FUNCTION sync_invoice_status() IS 'Automatically synchronizes estado and pagada fields in facturas_emitidas to prevent inconsistencies';
COMMENT ON TRIGGER trg_sync_invoice_status ON facturas_emitidas IS 'Ensures estado and pagada fields remain synchronized on every insert or update';

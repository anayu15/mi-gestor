-- Migration 011b: Apply same changes to invoices table
-- Fixes the issue where invoices table was missing pagada, fecha_pago, metodo_pago columns

-- Add pagada column to invoices (boolean to track payment status)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS pagada BOOLEAN DEFAULT false;

-- Add fecha_pago column to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- Add metodo_pago column to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Add index on pagada field for performance
CREATE INDEX IF NOT EXISTS idx_invoices_pagado ON invoices(pagada);

-- Update existing records: sync estado with pagada
UPDATE invoices
SET pagada = true
WHERE estado = 'PAGADA' AND pagada = false;

UPDATE invoices
SET pagada = false
WHERE estado = 'PENDIENTE' AND pagada = true;

-- Add comments for documentation
COMMENT ON COLUMN invoices.pagada IS 'Indicates whether the invoice has been paid (synchronized with estado field)';
COMMENT ON COLUMN invoices.fecha_pago IS 'Date when the invoice was actually paid';
COMMENT ON COLUMN invoices.metodo_pago IS 'Payment method used (Transferencia, Efectivo, Tarjeta, etc.)';

-- Note: The trigger sync_invoice_status already exists on facturas_emitidas
-- If invoices and facturas_emitidas are the same logical table, consider consolidating them

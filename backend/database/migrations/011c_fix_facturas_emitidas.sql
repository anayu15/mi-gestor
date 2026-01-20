-- Migration 011c: Add fecha_pago and metodo_pago to facturas_emitidas

-- Add fecha_pago column to facturas_emitidas (it has fecha_cobro but not fecha_pago)
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- Add metodo_pago column to facturas_emitidas
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Sync existing data: copy fecha_cobro to fecha_pago where applicable
UPDATE facturas_emitidas
SET fecha_pago = fecha_cobro
WHERE fecha_cobro IS NOT NULL AND fecha_pago IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN facturas_emitidas.fecha_pago IS 'Date when the invoice was actually paid (preferred over fecha_cobro)';
COMMENT ON COLUMN facturas_emitidas.metodo_pago IS 'Payment method used (Transferencia, Efectivo, Tarjeta, etc.)';

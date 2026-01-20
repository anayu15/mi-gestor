-- Migration 011d: Add pagado, fecha_pago, metodo_pago to expenses table

-- Add pagado column to expenses (boolean to track payment status)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT false;

-- Add fecha_pago column to expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- Add metodo_pago column to expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Add index on pagado field for performance
CREATE INDEX IF NOT EXISTS idx_expenses_pagado ON expenses(pagado);

-- Add comments for documentation
COMMENT ON COLUMN expenses.pagado IS 'Indicates whether the expense has been paid (Pendiente=false, Pagado=true)';
COMMENT ON COLUMN expenses.fecha_pago IS 'Date when the expense was actually paid';
COMMENT ON COLUMN expenses.metodo_pago IS 'Payment method used (Transferencia, Efectivo, Tarjeta, etc.)';

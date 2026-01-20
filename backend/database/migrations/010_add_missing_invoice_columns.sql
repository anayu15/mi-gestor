-- Migration 010: Add missing columns to facturas_emitidas
-- Adds columns needed for recurring invoices functionality

-- Add fecha_vencimiento column
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- Add descripcion_detallada column
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS descripcion_detallada TEXT;

-- Add pagada column (boolean to track payment status)
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS pagada BOOLEAN DEFAULT false;

-- Add pdf_generado column (boolean to track PDF generation status)
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS pdf_generado BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN facturas_emitidas.fecha_vencimiento IS 'Due date for the invoice payment';
COMMENT ON COLUMN facturas_emitidas.descripcion_detallada IS 'Detailed description or additional notes for the invoice';
COMMENT ON COLUMN facturas_emitidas.pagada IS 'Indicates whether the invoice has been paid';
COMMENT ON COLUMN facturas_emitidas.pdf_generado IS 'Indicates whether a PDF has been generated for this invoice';

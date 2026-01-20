-- Migration 009: Add missing columns to recurring_invoice_templates
-- Adds columns that were missing from the initial migration

-- Add missing invoice data columns
ALTER TABLE recurring_invoice_templates
ADD COLUMN IF NOT EXISTS descripcion_detallada TEXT;

-- Add missing control columns
ALTER TABLE recurring_invoice_templates
ADD COLUMN IF NOT EXISTS enviar_email_automatico BOOLEAN DEFAULT false;

ALTER TABLE recurring_invoice_templates
ADD COLUMN IF NOT EXISTS motivo_pausa TEXT;

-- Add missing statistics column
ALTER TABLE recurring_invoice_templates
ADD COLUMN IF NOT EXISTS ultima_factura_generada_id INTEGER REFERENCES facturas_emitidas(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN recurring_invoice_templates.descripcion_detallada IS 'Detailed description that will appear on the generated invoice';
COMMENT ON COLUMN recurring_invoice_templates.enviar_email_automatico IS 'Whether to automatically send email when invoice is generated';
COMMENT ON COLUMN recurring_invoice_templates.motivo_pausa IS 'Reason why template was paused (if pausado = true)';
COMMENT ON COLUMN recurring_invoice_templates.ultima_factura_generada_id IS 'ID of the most recently generated invoice from this template';

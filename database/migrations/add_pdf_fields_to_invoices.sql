-- Migration: Add PDF fields to invoices table
-- Date: 2026-01-11
-- Description: Add pdf_url and pdf_generado fields for PDF generation tracking

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_generado BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN invoices.pdf_url IS 'Relative path to generated PDF file';
COMMENT ON COLUMN invoices.pdf_generado IS 'Whether PDF has been generated for this invoice';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_pdf_generado ON invoices(pdf_generado) WHERE pdf_generado = true;

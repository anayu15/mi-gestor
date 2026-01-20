-- Migration 008: Add generation day type options for recurring invoices
-- Adds support for first/last natural/business days of the month

-- Add new column for day type
ALTER TABLE recurring_invoice_templates
ADD COLUMN IF NOT EXISTS tipo_dia_generacion VARCHAR(30) DEFAULT 'DIA_ESPECIFICO' CHECK (
  tipo_dia_generacion IN (
    'DIA_ESPECIFICO',           -- Specific day (1-31)
    'PRIMER_DIA_NATURAL',       -- First day of month (1st)
    'PRIMER_DIA_LECTIVO',       -- First business day of month (Mon-Fri)
    'ULTIMO_DIA_NATURAL',       -- Last day of month (28-31)
    'ULTIMO_DIA_LECTIVO'        -- Last business day of month (Mon-Fri)
  )
);

-- Update existing templates to use DIA_ESPECIFICO
UPDATE recurring_invoice_templates
SET tipo_dia_generacion = 'DIA_ESPECIFICO'
WHERE tipo_dia_generacion IS NULL;

-- Add comment
COMMENT ON COLUMN recurring_invoice_templates.tipo_dia_generacion IS 'Type of generation day: DIA_ESPECIFICO (specific day 1-31), PRIMER_DIA_NATURAL (1st of month), PRIMER_DIA_LECTIVO (first Mon-Fri), ULTIMO_DIA_NATURAL (last day of month), ULTIMO_DIA_LECTIVO (last Mon-Fri)';

-- Note: dia_generacion is still used when tipo_dia_generacion = 'DIA_ESPECIFICO'
COMMENT ON COLUMN recurring_invoice_templates.dia_generacion IS 'Day of month (1-31) when tipo_dia_generacion = DIA_ESPECIFICO. Ignored for other types.';

-- Migration 012: Add OCR and invoice processing fields to expenses table
-- Adds fields for invoice OCR processing, file attachments, and additional expense metadata

-- Add descripcion column (additional details beyond concepto)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Add numero_factura column (invoice number)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100);

-- Add deductibility fields
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS porcentaje_deducible DECIMAL(5,2) DEFAULT 100.00;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS es_deducible BOOLEAN DEFAULT true;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS motivo_no_deducible TEXT;

-- Add additional risk notes
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS notas_riesgo TEXT;

-- Add estado column (PENDIENTE, VALIDADO, RECHAZADO)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'PENDIENTE';

-- Add OCR processing fields
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_procesado BOOLEAN DEFAULT false;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_confianza DECIMAL(5,2);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_texto_completo TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_datos_extraidos JSONB;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_requiere_revision BOOLEAN DEFAULT false;

-- Add file attachment fields
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(500);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_nombre VARCHAR(255);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_tipo VARCHAR(50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_ocr_procesado ON expenses(ocr_procesado);
CREATE INDEX IF NOT EXISTS idx_expenses_estado ON expenses(estado);
CREATE INDEX IF NOT EXISTS idx_expenses_user_ocr ON expenses(user_id, ocr_procesado);
CREATE INDEX IF NOT EXISTS idx_expenses_numero_factura ON expenses(numero_factura);

-- Create GIN index for JSONB queries on ocr_datos_extraidos
CREATE INDEX IF NOT EXISTS idx_expenses_ocr_datos ON expenses USING GIN (ocr_datos_extraidos);

-- Add comments for documentation
COMMENT ON COLUMN expenses.descripcion IS 'Additional description or notes for the expense';
COMMENT ON COLUMN expenses.numero_factura IS 'Invoice number from the supplier';
COMMENT ON COLUMN expenses.porcentaje_deducible IS 'Percentage of the expense that is tax deductible (0-100)';
COMMENT ON COLUMN expenses.es_deducible IS 'Indicates if the expense is tax deductible';
COMMENT ON COLUMN expenses.motivo_no_deducible IS 'Reason why the expense is not deductible if es_deducible is false';
COMMENT ON COLUMN expenses.notas_riesgo IS 'Additional notes about TRADE compliance risks';
COMMENT ON COLUMN expenses.estado IS 'Status of the expense: PENDIENTE, VALIDADO, RECHAZADO';
COMMENT ON COLUMN expenses.ocr_procesado IS 'Indicates if invoice was processed with OCR';
COMMENT ON COLUMN expenses.ocr_confianza IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN expenses.ocr_texto_completo IS 'Full OCR text extracted from invoice (for debugging)';
COMMENT ON COLUMN expenses.ocr_datos_extraidos IS 'Structured JSON data extracted from invoice via OCR';
COMMENT ON COLUMN expenses.ocr_requiere_revision IS 'Indicates if OCR extraction requires manual review';
COMMENT ON COLUMN expenses.archivo_url IS 'Relative path to uploaded invoice file';
COMMENT ON COLUMN expenses.archivo_nombre IS 'Original filename of uploaded invoice';
COMMENT ON COLUMN expenses.archivo_tipo IS 'MIME type of uploaded file (image/jpeg, image/png, etc.)';

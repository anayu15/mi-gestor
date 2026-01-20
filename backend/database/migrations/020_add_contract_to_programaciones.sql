-- Migration: Add contract support to programaciones
-- This allows attaching a contract document to recurring invoice/expense templates

-- Add contract reference columns to programaciones table
-- Note: documents.id is INTEGER, not UUID
ALTER TABLE programaciones
ADD COLUMN IF NOT EXISTS contrato_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contrato_datos_extraidos JSONB,
ADD COLUMN IF NOT EXISTS contrato_confianza DECIMAL(5,2);

-- Create index for efficient contract lookups
CREATE INDEX IF NOT EXISTS idx_programaciones_contrato ON programaciones(contrato_document_id);

-- Add comment explaining the columns
COMMENT ON COLUMN programaciones.contrato_document_id IS 'Reference to the contract document in documents table';
COMMENT ON COLUMN programaciones.contrato_datos_extraidos IS 'JSON with OCR-extracted contract data: parties, dates, amounts, terms';
COMMENT ON COLUMN programaciones.contrato_confianza IS 'OCR confidence score (0-100) for the contract extraction';

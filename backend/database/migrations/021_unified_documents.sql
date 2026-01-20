-- ============================================================================
-- Migration 021: Unified Document Management System
-- ============================================================================
-- Date: 2026-01-15
-- Description: Simplifies the documents system to be a unified view of all
--   documents in the application:
--   - FACTURA_GASTO: Bills/invoices attached to expenses
--   - FACTURA_INGRESO: Auto-generated invoice PDFs
--   - CONTRATO: Contracts (for recurring invoices/expenses)
--   - OTRO: Standalone documents
--
-- Adds source linking to aggregate documents from expenses and invoices.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP PROVISIONAL TABLES (from migration 018)
-- ============================================================================
-- These tables were experimental and are no longer needed

DROP TABLE IF EXISTS ai_document_suggestions CASCADE;
DROP TABLE IF EXISTS alta_autonomo_progress CASCADE;
DROP TABLE IF EXISTS document_types CASCADE;

-- ============================================================================
-- 2. MODIFY documents TABLE
-- ============================================================================

-- Drop old category constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS valid_categoria;

-- Add new simplified categories
ALTER TABLE documents ADD CONSTRAINT valid_categoria CHECK (categoria IN (
  'FACTURA_GASTO',
  'FACTURA_INGRESO',
  'CONTRATO',
  'OTRO'
));

-- Add source linking columns
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_id INTEGER,
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;

-- Add constraint for source_type values
ALTER TABLE documents DROP CONSTRAINT IF EXISTS valid_source_type;
ALTER TABLE documents ADD CONSTRAINT valid_source_type CHECK (
  source_type IS NULL OR source_type IN ('expense', 'invoice', 'programacion', 'standalone')
);

-- Add comments
COMMENT ON COLUMN documents.source_type IS 'Type of source: expense, invoice, programacion, or standalone';
COMMENT ON COLUMN documents.source_id IS 'ID of the source record in the corresponding table';
COMMENT ON COLUMN documents.is_auto_generated IS 'True if document was auto-generated (e.g., invoice PDFs)';

-- ============================================================================
-- 3. CREATE INDEXES for efficient queries
-- ============================================================================

-- Index for source lookups
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_type, source_id);

-- Index for date ordering (unified list)
CREATE INDEX IF NOT EXISTS idx_documents_fecha_documento ON documents(user_id, fecha_documento DESC);

-- Index for category filtering
DROP INDEX IF EXISTS idx_documents_categoria;
CREATE INDEX IF NOT EXISTS idx_documents_categoria ON documents(user_id, categoria);

-- ============================================================================
-- 4. UPDATE existing documents to new categories
-- ============================================================================

-- Migrate old categories to new ones
UPDATE documents SET categoria = 'CONTRATO'
WHERE categoria IN ('CONTRATO_TRADE', 'CONTRATO_VIVIENDA', 'CONTRATO_ALQUILER',
                    'CONTRATO_SUMINISTROS', 'CONTRATO_CLIENTE');

UPDATE documents SET categoria = 'OTRO'
WHERE categoria IN ('DOCUMENTO_BANCARIO', 'ALTA_HACIENDA', 'ALTA_SEGURIDAD_SOCIAL',
                    'APROBACION_SEPE', 'DOCUMENTO_IDENTIDAD', 'CERTIFICADO_DIGITAL');

-- Set source_type for existing standalone documents
UPDATE documents SET source_type = 'standalone' WHERE source_type IS NULL;

COMMIT;

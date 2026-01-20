-- ============================================================================
-- Migration 034: Modelo 036 Document Types (ALTA vs MODIFICACION)
-- ============================================================================
-- Date: 2026-01-19
-- Description: Adds support for distinguishing between complete new Modelo 036
--   documents (ALTA) and modifications that only change specific values.
--   Modifications reference their parent document and both remain in vigor.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD tipo_documento_036 COLUMN
-- ============================================================================
-- ALTA: A complete new Modelo 036 that invalidates the previous one
-- MODIFICACION: A modification that only changes specific values, both remain valid

ALTER TABLE modelo_036_analysis 
ADD COLUMN IF NOT EXISTS tipo_documento_036 VARCHAR(20) DEFAULT 'ALTA' CHECK (tipo_documento_036 IN ('ALTA', 'MODIFICACION'));

COMMENT ON COLUMN modelo_036_analysis.tipo_documento_036 IS 'Document type: ALTA (complete new document, invalidates previous) or MODIFICACION (partial modification, both remain valid)';

-- ============================================================================
-- 2. ADD parent_analysis_id COLUMN
-- ============================================================================
-- For modifications, this references the original ALTA document being modified

ALTER TABLE modelo_036_analysis 
ADD COLUMN IF NOT EXISTS parent_analysis_id INTEGER REFERENCES modelo_036_analysis(id) ON DELETE SET NULL;

COMMENT ON COLUMN modelo_036_analysis.parent_analysis_id IS 'For MODIFICACION documents, references the parent ALTA document being modified';

-- ============================================================================
-- 3. ADD is_active COLUMN
-- ============================================================================
-- Indicates if this document is currently in vigor (active)
-- For ALTA: becomes inactive when a new ALTA is uploaded
-- For MODIFICACION: always remains active unless explicitly deactivated

ALTER TABLE modelo_036_analysis 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN modelo_036_analysis.is_active IS 'Whether this document is currently in vigor (active)';

-- ============================================================================
-- 4. ADD campos_modificados COLUMN
-- ============================================================================
-- For modifications, stores which fields were changed

ALTER TABLE modelo_036_analysis 
ADD COLUMN IF NOT EXISTS campos_modificados TEXT[];

COMMENT ON COLUMN modelo_036_analysis.campos_modificados IS 'For MODIFICACION documents, list of fields that were modified';

-- ============================================================================
-- 5. ADD fecha_efectos COLUMN
-- ============================================================================
-- The effective date of the modification (when changes take effect)

ALTER TABLE modelo_036_analysis 
ADD COLUMN IF NOT EXISTS fecha_efectos DATE;

COMMENT ON COLUMN modelo_036_analysis.fecha_efectos IS 'Effective date when the modification takes effect';

-- ============================================================================
-- 6. CREATE INDEX for parent lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_modelo_036_analysis_parent ON modelo_036_analysis(parent_analysis_id);
CREATE INDEX IF NOT EXISTS idx_modelo_036_analysis_active ON modelo_036_analysis(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_modelo_036_analysis_tipo ON modelo_036_analysis(user_id, tipo_documento_036);

-- ============================================================================
-- 7. SET existing records as ALTA type and active
-- ============================================================================

UPDATE modelo_036_analysis 
SET tipo_documento_036 = 'ALTA', is_active = true 
WHERE tipo_documento_036 IS NULL;

COMMIT;

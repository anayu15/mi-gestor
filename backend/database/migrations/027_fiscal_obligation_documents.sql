-- Migration 027: Fiscal Obligation Documents
-- Documents attached to fiscal obligations (modelos AEAT)

-- ============================================================================
-- 1. CREATE fiscal_obligation_documents TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiscal_obligation_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Fiscal obligation identification
  modelo VARCHAR(20) NOT NULL,  -- '303', '130', '115', '180', '390', 'RENTA', etc.
  trimestre INTEGER CHECK (trimestre BETWEEN 1 AND 4),  -- NULL for annual models
  ano INTEGER NOT NULL,
  
  -- Status
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one document per obligation per user
  CONSTRAINT unique_fiscal_obligation UNIQUE (user_id, modelo, trimestre, ano)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fiscal_obligation_docs_user ON fiscal_obligation_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_obligation_docs_modelo ON fiscal_obligation_documents(modelo, ano, trimestre);
CREATE INDEX IF NOT EXISTS idx_fiscal_obligation_docs_document ON fiscal_obligation_documents(document_id);

-- Comments
COMMENT ON TABLE fiscal_obligation_documents IS 'Documents attached to fiscal obligations (AEAT modelos). All documents are of tipo_documento AEAT.';
COMMENT ON COLUMN fiscal_obligation_documents.modelo IS 'Tax model number (303, 130, 115, etc.) or special codes (RENTA, SEG-SOCIAL)';
COMMENT ON COLUMN fiscal_obligation_documents.trimestre IS 'Quarter (1-4) for quarterly models, NULL for annual models';
COMMENT ON COLUMN fiscal_obligation_documents.ano IS 'Tax year for the obligation';

-- ============================================================================
-- 2. UPDATE TRIGGER FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_fiscal_obligation_docs_updated_at ON fiscal_obligation_documents;
CREATE TRIGGER update_fiscal_obligation_docs_updated_at 
  BEFORE UPDATE ON fiscal_obligation_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

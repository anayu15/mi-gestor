-- ============================================================================
-- Migration 026: Modelo 036 Analysis and AI Recommendations
-- ============================================================================
-- Date: 2026-01-15
-- Description: Stores uploaded Modelo 036 documents analysis and AI-generated
--   recommendations for which tax models the user should enable.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE modelo_036_analysis TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS modelo_036_analysis (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,

  -- Extracted data from 036
  nif VARCHAR(20),
  nombre_razon_social VARCHAR(255),
  domicilio_fiscal TEXT,
  fecha_presentacion DATE,
  fecha_alta_actividad DATE,
  epigrafe_iae VARCHAR(100),
  epigrafe_iae_descripcion TEXT,
  regimen_iva VARCHAR(50),           -- GENERAL, SIMPLIFICADO, EXENTO, RECARGO_EQUIVALENCIA, etc.
  regimen_irpf VARCHAR(50),          -- DIRECTA_SIMPLIFICADA, DIRECTA_NORMAL, OBJETIVA
  tiene_empleados BOOLEAN DEFAULT false,
  operaciones_intracomunitarias BOOLEAN DEFAULT false,
  local_alquilado BOOLEAN DEFAULT false,
  facturacion_estimada_anual DECIMAL(12,2),
  sii_obligatorio BOOLEAN DEFAULT false,

  -- AI recommendations for each model (with explanations in Spanish)
  recomienda_modelo_303 BOOLEAN,
  explicacion_modelo_303 TEXT,
  recomienda_modelo_130 BOOLEAN,
  explicacion_modelo_130 TEXT,
  recomienda_modelo_131 BOOLEAN,
  explicacion_modelo_131 TEXT,
  recomienda_modelo_115 BOOLEAN,
  explicacion_modelo_115 TEXT,
  recomienda_modelo_180 BOOLEAN,
  explicacion_modelo_180 TEXT,
  recomienda_modelo_390 BOOLEAN,
  explicacion_modelo_390 TEXT,
  recomienda_modelo_349 BOOLEAN,
  explicacion_modelo_349 TEXT,
  recomienda_modelo_111 BOOLEAN,
  explicacion_modelo_111 TEXT,
  recomienda_modelo_190 BOOLEAN,
  explicacion_modelo_190 TEXT,
  recomienda_sii BOOLEAN,
  explicacion_sii TEXT,
  recomienda_vies_roi BOOLEAN,
  explicacion_vies_roi TEXT,

  -- Analysis metadata
  ai_confianza DECIMAL(5,2),
  ai_raw_response TEXT,
  notas_extraccion TEXT[],

  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE modelo_036_analysis IS 'Stores AI analysis of uploaded Modelo 036 documents and tax model recommendations';
COMMENT ON COLUMN modelo_036_analysis.regimen_iva IS 'IVA regime: GENERAL, SIMPLIFICADO, EXENTO, RECARGO_EQUIVALENCIA, AGRICULTURA, NO_SUJETO';
COMMENT ON COLUMN modelo_036_analysis.regimen_irpf IS 'IRPF regime: DIRECTA_SIMPLIFICADA, DIRECTA_NORMAL, OBJETIVA';
COMMENT ON COLUMN modelo_036_analysis.ai_confianza IS 'AI confidence score 0-100';
COMMENT ON COLUMN modelo_036_analysis.notas_extraccion IS 'AI-generated notes about extraction and recommendations';

-- Indexes for efficient queries
CREATE INDEX idx_modelo_036_analysis_user ON modelo_036_analysis(user_id);
CREATE INDEX idx_modelo_036_analysis_document ON modelo_036_analysis(document_id);
CREATE INDEX idx_modelo_036_analysis_created ON modelo_036_analysis(created_at DESC);

-- ============================================================================
-- 2. ADD last_modelo_036_analysis_id TO usuarios TABLE
-- ============================================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_modelo_036_analysis_id INTEGER REFERENCES modelo_036_analysis(id) ON DELETE SET NULL;

COMMENT ON COLUMN usuarios.last_modelo_036_analysis_id IS 'Reference to the most recent Modelo 036 analysis for quick access';

-- ============================================================================
-- 3. CREATE TRIGGER to update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_modelo_036_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_modelo_036_analysis_updated_at ON modelo_036_analysis;
CREATE TRIGGER trigger_modelo_036_analysis_updated_at
  BEFORE UPDATE ON modelo_036_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_modelo_036_analysis_updated_at();

COMMIT;

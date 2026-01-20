-- ============================================================================
-- Migration 028: Alta Seguridad Social Analysis and AI Recommendations
-- ============================================================================
-- Date: 2026-01-16
-- Description: Stores uploaded Alta en RETA documents analysis and AI-generated
--   recommendations for Social Security settings (tarifa plana, base cotización).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE alta_ss_analysis TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alta_ss_analysis (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,

  -- Extracted data from Alta RETA document
  nif VARCHAR(20),
  nombre_completo VARCHAR(255),
  numero_afiliacion VARCHAR(50),           -- Número de afiliación a la SS
  fecha_alta_reta DATE,                     -- Fecha de alta en el RETA
  fecha_efectos DATE,                       -- Fecha de efectos del alta
  actividad_economica TEXT,                 -- Descripción de la actividad
  cnae_codigo VARCHAR(20),                  -- Código CNAE si disponible
  
  -- Base de cotización data
  base_cotizacion_elegida DECIMAL(10,2),   -- Base elegida por el trabajador
  base_minima_tramo DECIMAL(10,2),         -- Base mínima según tramo
  base_maxima_tramo DECIMAL(10,2),         -- Base máxima según tramo
  tramo_rendimientos VARCHAR(50),          -- Tramo de rendimientos (T1, T2, etc.)
  
  -- Bonificaciones/Reducciones
  tiene_tarifa_plana BOOLEAN DEFAULT false,
  tipo_bonificacion VARCHAR(100),          -- TARIFA_PLANA, PLURIACTIVIDAD, DISCAPACIDAD, etc.
  fecha_inicio_bonificacion DATE,
  fecha_fin_bonificacion DATE,
  cuota_bonificada DECIMAL(10,2),          -- Cuota mensual con bonificación
  
  -- Régimen de cotización
  regimen VARCHAR(50),                      -- RETA, AGRARIO, MAR, etc.
  grupo_cotizacion VARCHAR(10),
  
  -- Situación laboral
  es_autonomo_societario BOOLEAN DEFAULT false,
  es_pluriactividad BOOLEAN DEFAULT false,
  
  -- AI recommendations
  recomienda_tarifa_plana BOOLEAN,
  explicacion_tarifa_plana TEXT,
  base_cotizacion_recomendada DECIMAL(10,2),
  explicacion_base_cotizacion TEXT,
  
  -- Analysis metadata
  ai_confianza DECIMAL(5,2),
  ai_raw_response TEXT,
  notas_extraccion TEXT[],

  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alta_ss_analysis IS 'Stores AI analysis of uploaded Alta RETA/SS documents and Social Security settings recommendations';
COMMENT ON COLUMN alta_ss_analysis.tiene_tarifa_plana IS 'Whether the document shows tarifa plana bonification';
COMMENT ON COLUMN alta_ss_analysis.base_cotizacion_elegida IS 'The contribution base selected in the document';
COMMENT ON COLUMN alta_ss_analysis.ai_confianza IS 'AI confidence score 0-100';

-- Indexes for efficient queries
CREATE INDEX idx_alta_ss_analysis_user ON alta_ss_analysis(user_id);
CREATE INDEX idx_alta_ss_analysis_document ON alta_ss_analysis(document_id);
CREATE INDEX idx_alta_ss_analysis_created ON alta_ss_analysis(created_at DESC);

-- ============================================================================
-- 2. ADD last_alta_ss_analysis_id TO users TABLE
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_alta_ss_analysis_id INTEGER REFERENCES alta_ss_analysis(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.last_alta_ss_analysis_id IS 'Reference to the most recent Alta SS analysis for quick access';

-- ============================================================================
-- 3. CREATE TRIGGER to update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_alta_ss_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_alta_ss_analysis_updated_at ON alta_ss_analysis;
CREATE TRIGGER trigger_alta_ss_analysis_updated_at
  BEFORE UPDATE ON alta_ss_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_alta_ss_analysis_updated_at();

COMMIT;

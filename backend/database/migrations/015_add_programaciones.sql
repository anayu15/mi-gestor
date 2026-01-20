-- Migration: 015_add_programaciones.sql
-- Description: Add programaciones table for scheduled/recurring expenses and invoices
-- Date: 2026-01-13

-- ============================================
-- 1. Create programaciones table
-- ============================================

CREATE TABLE IF NOT EXISTS programaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Type: INGRESO (invoice) or GASTO (expense)
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),

  -- Optional name for the schedule
  nombre VARCHAR(255),

  -- Schedule configuration
  periodicidad VARCHAR(20) NOT NULL CHECK (periodicidad IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
  tipo_dia VARCHAR(30) NOT NULL CHECK (tipo_dia IN ('ULTIMO_DIA_LABORAL', 'PRIMER_DIA_LABORAL', 'ULTIMO_DIA', 'PRIMER_DIA', 'DIA_ESPECIFICO')),
  dia_especifico INTEGER CHECK (dia_especifico IS NULL OR (dia_especifico >= 1 AND dia_especifico <= 31)), -- Only used when tipo_dia = 'DIA_ESPECIFICO'

  -- Date range
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL means "current year only, extend manually"

  -- Template data stored as JSON for flexibility
  -- For INGRESO: { cliente_id, concepto, base_imponible, tipo_iva, tipo_irpf, estado }
  -- For GASTO: { concepto, proveedor_nombre, proveedor_cif, base_imponible, tipo_iva, tipo_irpf, categoria }
  datos_base JSONB NOT NULL,

  -- Statistics
  total_generados INTEGER DEFAULT 0,
  ultimo_ano_generado INTEGER, -- Track the last year for which records were generated

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for programaciones
CREATE INDEX idx_programaciones_user ON programaciones(user_id);
CREATE INDEX idx_programaciones_tipo ON programaciones(tipo);
CREATE INDEX idx_programaciones_user_tipo ON programaciones(user_id, tipo);

-- ============================================
-- 2. Add programacion_id to facturas_emitidas
-- ============================================

ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS programacion_id UUID REFERENCES programaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_programacion ON facturas_emitidas(programacion_id)
WHERE programacion_id IS NOT NULL;

-- ============================================
-- 3. Add programacion_id to expenses
-- ============================================

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS programacion_id UUID REFERENCES programaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_programacion ON expenses(programacion_id)
WHERE programacion_id IS NOT NULL;

-- ============================================
-- 4. Function to update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_programaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_programaciones_updated_at
  BEFORE UPDATE ON programaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_programaciones_updated_at();

-- ============================================
-- Success message
-- ============================================
-- Migration 015 completed: programaciones table created

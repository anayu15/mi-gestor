-- Migration: 017_update_programaciones_columns.sql
-- Description: Update programaciones table from frecuencia/intervalo_dias to periodicidad/tipo_dia/dia_especifico
-- Date: 2026-01-13

-- ============================================
-- 1. Add new columns
-- ============================================

ALTER TABLE programaciones
ADD COLUMN IF NOT EXISTS periodicidad VARCHAR(20),
ADD COLUMN IF NOT EXISTS tipo_dia VARCHAR(30),
ADD COLUMN IF NOT EXISTS dia_especifico INTEGER;

-- ============================================
-- 2. Migrate data from old columns to new columns
-- ============================================

-- Convert frecuencia to periodicidad (PERSONALIZADO is not supported, default to MENSUAL)
UPDATE programaciones
SET periodicidad = CASE
    WHEN frecuencia = 'PERSONALIZADO' THEN 'MENSUAL'
    ELSE frecuencia
END
WHERE periodicidad IS NULL;

-- Set default tipo_dia (use DIA_ESPECIFICO with day 1 for existing records)
UPDATE programaciones
SET tipo_dia = 'PRIMER_DIA'
WHERE tipo_dia IS NULL;

-- ============================================
-- 3. Add constraints to new columns
-- ============================================

ALTER TABLE programaciones
ALTER COLUMN periodicidad SET NOT NULL;

ALTER TABLE programaciones
ALTER COLUMN tipo_dia SET NOT NULL;

-- Add check constraints
ALTER TABLE programaciones
DROP CONSTRAINT IF EXISTS programaciones_periodicidad_check;

ALTER TABLE programaciones
ADD CONSTRAINT programaciones_periodicidad_check
CHECK (periodicidad IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'));

ALTER TABLE programaciones
DROP CONSTRAINT IF EXISTS programaciones_tipo_dia_check;

ALTER TABLE programaciones
ADD CONSTRAINT programaciones_tipo_dia_check
CHECK (tipo_dia IN ('ULTIMO_DIA_LABORAL', 'PRIMER_DIA_LABORAL', 'ULTIMO_DIA', 'PRIMER_DIA', 'DIA_ESPECIFICO'));

ALTER TABLE programaciones
DROP CONSTRAINT IF EXISTS programaciones_dia_especifico_check;

ALTER TABLE programaciones
ADD CONSTRAINT programaciones_dia_especifico_check
CHECK (dia_especifico IS NULL OR (dia_especifico >= 1 AND dia_especifico <= 31));

-- ============================================
-- 4. Make old columns nullable (for backward compatibility)
-- ============================================

-- Drop the NOT NULL constraint from old columns
ALTER TABLE programaciones ALTER COLUMN frecuencia DROP NOT NULL;

-- Drop the old check constraint on frecuencia
ALTER TABLE programaciones DROP CONSTRAINT IF EXISTS programaciones_frecuencia_check;

-- ============================================
-- 5. Drop old columns (optional - uncomment after confirming migration works)
-- ============================================

-- Uncomment these lines to remove old columns after confirming migration works:
-- ALTER TABLE programaciones DROP COLUMN IF EXISTS frecuencia;
-- ALTER TABLE programaciones DROP COLUMN IF EXISTS intervalo_dias;

-- ============================================
-- Success message
-- ============================================
-- Migration 017 completed: programaciones table updated with new schedule columns

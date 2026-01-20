-- Migration: Add extended fiscal model visibility preferences
-- Date: 2026-01-15
-- Description: Adds support for additional Spanish tax models (111, 131, 190, 347, 349, 123, SII, VIES/ROI, REDEME)

-- IVA Section Extensions
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_349 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mostrar_sii BOOLEAN DEFAULT false;

-- IRPF Section Extensions
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_131 BOOLEAN DEFAULT false;

-- Retenciones Section Extensions
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_111 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mostrar_modelo_190 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mostrar_modelo_123 BOOLEAN DEFAULT false;

-- Declaraciones Informativas Section
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_347 BOOLEAN DEFAULT false;

-- Registros Censales Section
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_vies_roi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mostrar_redeme BOOLEAN DEFAULT false;

-- User situation flags (helps determine which models are relevant)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tiene_empleados BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tiene_operaciones_ue BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS usa_modulos BOOLEAN DEFAULT false;

-- Update index for efficient querying
DROP INDEX IF EXISTS idx_users_model_visibility;
CREATE INDEX idx_users_model_visibility ON users(
  mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115,
  mostrar_modelo_180, mostrar_modelo_390, mostrar_modelo_349,
  mostrar_modelo_131, mostrar_modelo_111, mostrar_modelo_190,
  mostrar_modelo_123, mostrar_modelo_347
);

-- Comments for documentation
COMMENT ON COLUMN users.mostrar_modelo_349 IS 'Modelo 349 - Operaciones Intracomunitarias (compras/ventas UE)';
COMMENT ON COLUMN users.mostrar_sii IS 'SII - Suministro Inmediato de Informacion (facturacion electronica AEAT)';
COMMENT ON COLUMN users.mostrar_modelo_131 IS 'Modelo 131 - IRPF Estimacion Objetiva (modulos)';
COMMENT ON COLUMN users.mostrar_modelo_111 IS 'Modelo 111 - Retenciones a trabajadores y profesionales';
COMMENT ON COLUMN users.mostrar_modelo_190 IS 'Modelo 190 - Resumen anual de retenciones (111)';
COMMENT ON COLUMN users.mostrar_modelo_123 IS 'Modelo 123 - Retenciones sobre rendimientos de capital mobiliario';
COMMENT ON COLUMN users.mostrar_modelo_347 IS 'Modelo 347 - Operaciones con terceros superiores a 3.005,06 EUR';
COMMENT ON COLUMN users.mostrar_vies_roi IS 'VIES/ROI - Registro de Operadores Intracomunitarios';
COMMENT ON COLUMN users.mostrar_redeme IS 'REDEME - Registro de Devolucion Mensual de IVA';
COMMENT ON COLUMN users.tiene_empleados IS 'Indica si el autonomo tiene empleados o contrata profesionales';
COMMENT ON COLUMN users.tiene_operaciones_ue IS 'Indica si realiza operaciones intracomunitarias';
COMMENT ON COLUMN users.usa_modulos IS 'Indica si tributa por estimacion objetiva (modulos) en lugar de directa';

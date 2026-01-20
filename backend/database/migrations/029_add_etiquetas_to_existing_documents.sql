-- ============================================================================
-- Migration 029: Add etiquetas to existing documents
-- ============================================================================
-- Date: 2026-01-20
-- Description: Updates existing documents with appropriate etiquetas (tags)
--   based on their tipo_documento and categoria fields.
--
-- Tag logic:
--   - Fiscal documents (tipo_documento = 'AEAT'): ['Fiscal', 'Hacienda']
--   - Social Security documents (tipo_documento = 'SS'): ['Fiscal', 'SS']
--   - Expense invoices (categoria = 'FACTURA_GASTO'): ['Facturas', 'Gasto']
--   - Income invoices (categoria = 'FACTURA_INGRESO'): ['Facturas', 'Ingreso']
--   - Contracts (categoria = 'CONTRATO'): ['Contrato']
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UPDATE FISCAL DOCUMENTS FROM HACIENDA (AEAT)
-- ============================================================================
-- Documents with tipo_documento = 'AEAT' get ['Fiscal', 'Hacienda']
UPDATE documents
SET etiquetas = ARRAY['Fiscal', 'Hacienda']::text[]
WHERE tipo_documento = 'AEAT'
  AND (etiquetas IS NULL OR etiquetas = '{}');

-- ============================================================================
-- 2. UPDATE FISCAL DOCUMENTS FROM SEGURIDAD SOCIAL
-- ============================================================================
-- Documents with tipo_documento = 'SS' get ['Fiscal', 'SS']
UPDATE documents
SET etiquetas = ARRAY['Fiscal', 'SS']::text[]
WHERE tipo_documento = 'SS'
  AND (etiquetas IS NULL OR etiquetas = '{}');

-- ============================================================================
-- 3. UPDATE EXPENSE INVOICES
-- ============================================================================
-- Documents with categoria = 'FACTURA_GASTO' get ['Facturas', 'Gasto']
UPDATE documents
SET etiquetas = ARRAY['Facturas', 'Gasto']::text[]
WHERE categoria = 'FACTURA_GASTO'
  AND (etiquetas IS NULL OR etiquetas = '{}');

-- ============================================================================
-- 4. UPDATE INCOME INVOICES
-- ============================================================================
-- Documents with categoria = 'FACTURA_INGRESO' get ['Facturas', 'Ingreso']
UPDATE documents
SET etiquetas = ARRAY['Facturas', 'Ingreso']::text[]
WHERE categoria = 'FACTURA_INGRESO'
  AND (etiquetas IS NULL OR etiquetas = '{}');

-- ============================================================================
-- 5. UPDATE CONTRACTS
-- ============================================================================
-- Documents with categoria = 'CONTRATO' get ['Contrato']
UPDATE documents
SET etiquetas = ARRAY['Contrato']::text[]
WHERE categoria = 'CONTRATO'
  AND (etiquetas IS NULL OR etiquetas = '{}');

-- ============================================================================
-- 6. REPORT CHANGES
-- ============================================================================
DO $$
DECLARE
  fiscal_hacienda_count INTEGER;
  fiscal_ss_count INTEGER;
  gastos_count INTEGER;
  ingresos_count INTEGER;
  contratos_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fiscal_hacienda_count FROM documents WHERE 'Hacienda' = ANY(etiquetas);
  SELECT COUNT(*) INTO fiscal_ss_count FROM documents WHERE 'SS' = ANY(etiquetas);
  SELECT COUNT(*) INTO gastos_count FROM documents WHERE 'Gasto' = ANY(etiquetas);
  SELECT COUNT(*) INTO ingresos_count FROM documents WHERE 'Ingreso' = ANY(etiquetas);
  SELECT COUNT(*) INTO contratos_count FROM documents WHERE 'Contrato' = ANY(etiquetas);
  
  RAISE NOTICE 'Migration 029 completed:';
  RAISE NOTICE '  - Fiscal (Hacienda): % documents', fiscal_hacienda_count;
  RAISE NOTICE '  - Fiscal (SS): % documents', fiscal_ss_count;
  RAISE NOTICE '  - Gastos: % documents', gastos_count;
  RAISE NOTICE '  - Ingresos: % documents', ingresos_count;
  RAISE NOTICE '  - Contratos: % documents', contratos_count;
END $$;

COMMIT;

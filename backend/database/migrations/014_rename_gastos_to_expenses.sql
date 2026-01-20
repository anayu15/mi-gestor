-- Migration 014: Rename gastos table to expenses
-- This fixes the table naming mismatch between the database schema and backend code
-- The backend code uses 'expenses' but the schema created 'gastos'

-- Step 1: Rename the table (if it exists as gastos)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gastos') THEN
        ALTER TABLE gastos RENAME TO expenses;
        RAISE NOTICE 'Table gastos renamed to expenses';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        RAISE NOTICE 'Table expenses already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither gastos nor expenses table found!';
    END IF;
END $$;

-- Step 2: Rename indexes to match new table name
-- Using DO blocks to handle cases where indexes might not exist
DO $$
BEGIN
    -- Base indexes from schema.sql
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_user') THEN
        ALTER INDEX idx_gastos_user RENAME TO idx_expenses_user;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_fecha') THEN
        ALTER INDEX idx_gastos_fecha RENAME TO idx_expenses_fecha;
    END IF;

    -- Indexes from migration 011 (add_gastos_estado)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_pagado') THEN
        ALTER INDEX idx_gastos_pagado RENAME TO idx_expenses_pagado;
    END IF;

    -- Indexes from migration 012 (add_ocr_fields)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_ocr_procesado') THEN
        ALTER INDEX idx_gastos_ocr_procesado RENAME TO idx_expenses_ocr_procesado;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_estado') THEN
        ALTER INDEX idx_gastos_estado RENAME TO idx_expenses_estado;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_user_ocr') THEN
        ALTER INDEX idx_gastos_user_ocr RENAME TO idx_expenses_user_ocr;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_numero_factura') THEN
        ALTER INDEX idx_gastos_numero_factura RENAME TO idx_expenses_numero_factura;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gastos_ocr_datos') THEN
        ALTER INDEX idx_gastos_ocr_datos RENAME TO idx_expenses_ocr_datos;
    END IF;

    RAISE NOTICE 'Index rename operations completed';
END $$;

-- Step 3: Ensure all required columns exist on expenses table
-- This handles cases where some migrations may have run on gastos before rename
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS porcentaje_deducible DECIMAL(5,2) DEFAULT 100.00;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS es_deducible BOOLEAN DEFAULT true;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS motivo_no_deducible TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS notas_riesgo TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'PENDIENTE';

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_procesado BOOLEAN DEFAULT false;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_confianza DECIMAL(5,2);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_texto_completo TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_datos_extraidos JSONB;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS ocr_requiere_revision BOOLEAN DEFAULT false;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(500);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_nombre VARCHAR(255);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS archivo_tipo VARCHAR(50);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT false;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Step 4: Create indexes if they don't exist (for renamed table)
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_fecha ON expenses(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_expenses_pagado ON expenses(pagado);
CREATE INDEX IF NOT EXISTS idx_expenses_ocr_procesado ON expenses(ocr_procesado);
CREATE INDEX IF NOT EXISTS idx_expenses_estado ON expenses(estado);
CREATE INDEX IF NOT EXISTS idx_expenses_user_ocr ON expenses(user_id, ocr_procesado);
CREATE INDEX IF NOT EXISTS idx_expenses_numero_factura ON expenses(numero_factura);
CREATE INDEX IF NOT EXISTS idx_expenses_ocr_datos ON expenses USING GIN (ocr_datos_extraidos);

-- Step 5: Add comments for documentation
COMMENT ON TABLE expenses IS 'Expense records for tax-deductible purchases and business costs';
COMMENT ON COLUMN expenses.ocr_procesado IS 'Indicates if invoice was processed with OCR';
COMMENT ON COLUMN expenses.ocr_confianza IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN expenses.estado IS 'Status of the expense: PENDIENTE, VALIDADO, RECHAZADO';

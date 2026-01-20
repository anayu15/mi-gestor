-- Migration 007: Add Recurring Invoices System
-- Creates tables for recurring invoice templates and generation history

-- ============================================================
-- 1. Create recurring_invoice_templates table
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Template metadata
  nombre_plantilla VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Invoice data (copied to each generated invoice)
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  concepto TEXT NOT NULL,
  base_imponible DECIMAL(10, 2) NOT NULL,
  tipo_iva DECIMAL(5, 2) NOT NULL DEFAULT 21.00,
  cuota_iva DECIMAL(10, 2) NOT NULL,
  tipo_irpf DECIMAL(5, 2) DEFAULT 0.00,
  cuota_irpf DECIMAL(10, 2) DEFAULT 0.00,
  total_factura DECIMAL(10, 2) NOT NULL,
  serie VARCHAR(10) DEFAULT 'A',

  -- Invoice date configuration
  dias_vencimiento INTEGER DEFAULT 30,
  incluir_periodo_facturacion BOOLEAN DEFAULT false,
  duracion_periodo_dias INTEGER,

  -- Recurrence configuration
  frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('MENSUAL', 'TRIMESTRAL', 'ANUAL', 'PERSONALIZADO')),
  dia_generacion INTEGER DEFAULT 1 CHECK (dia_generacion BETWEEN 1 AND 31),
  intervalo_dias INTEGER,
  proxima_generacion DATE NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,

  -- Control flags
  activo BOOLEAN DEFAULT true,
  pausado BOOLEAN DEFAULT false,
  generar_pdf_automatico BOOLEAN DEFAULT true,

  -- Statistics
  total_facturas_generadas INTEGER DEFAULT 0,
  ultima_generacion TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. Create recurring_invoice_history table
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_invoice_history (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES facturas_emitidas(id) ON DELETE SET NULL,

  -- Generation details
  fecha_programada DATE NOT NULL,
  fecha_generacion TIMESTAMP DEFAULT NOW(),
  exitoso BOOLEAN NOT NULL,
  error_mensaje TEXT,

  -- Generated invoice info (for audit even if invoice deleted)
  numero_factura VARCHAR(50),
  total_factura DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. Modify facturas_emitidas table to link to templates
-- ============================================================
ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL;

ALTER TABLE facturas_emitidas
ADD COLUMN IF NOT EXISTS es_recurrente BOOLEAN DEFAULT false;

-- ============================================================
-- 4. Create indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_invoice_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_proxima_gen ON recurring_invoice_templates(proxima_generacion) WHERE activo = true AND pausado = false;
CREATE INDEX IF NOT EXISTS idx_recurring_templates_cliente ON recurring_invoice_templates(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recurring_history_template ON recurring_invoice_history(template_id);
CREATE INDEX IF NOT EXISTS idx_recurring_history_invoice ON recurring_invoice_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_template ON facturas_emitidas(template_id) WHERE es_recurrente = true;

-- ============================================================
-- 5. Add comments for documentation
-- ============================================================
COMMENT ON TABLE recurring_invoice_templates IS 'Templates for automatically generating recurring invoices on a scheduled basis';
COMMENT ON TABLE recurring_invoice_history IS 'Audit log of all recurring invoice generation attempts (successful and failed)';
COMMENT ON COLUMN recurring_invoice_templates.frecuencia IS 'Generation frequency: MENSUAL (monthly), TRIMESTRAL (quarterly), ANUAL (yearly), PERSONALIZADO (custom days)';
COMMENT ON COLUMN recurring_invoice_templates.dia_generacion IS 'Day of month to generate invoice (1-31). For days > 28, will use last day of month if needed';
COMMENT ON COLUMN recurring_invoice_templates.proxima_generacion IS 'Next scheduled generation date. Updated automatically after each generation';
COMMENT ON COLUMN recurring_invoice_templates.pausado IS 'Temporarily pause generation without deactivating the template';
COMMENT ON COLUMN facturas_emitidas.es_recurrente IS 'Indicates this invoice was automatically generated from a recurring template';
COMMENT ON COLUMN facturas_emitidas.template_id IS 'Links to the recurring template that generated this invoice (if applicable)';

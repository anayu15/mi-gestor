-- Migration: Add Recurring Invoices System
-- Date: 2026-01-12
-- Description: Add tables for recurring invoice templates and generation history

-- ======================
-- 1. RECURRING INVOICE TEMPLATES TABLE
-- ======================
CREATE TABLE recurring_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Template identification
  nombre_plantilla VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Invoice data (same fields as invoices table)
  cliente_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  serie VARCHAR(10) DEFAULT 'A',
  concepto TEXT NOT NULL,
  descripcion_detallada TEXT,
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  tipo_irpf DECIMAL(4,2) DEFAULT 7.00,

  -- Dates configuration (template values)
  dias_vencimiento INTEGER DEFAULT 30,
  incluir_periodo_facturacion BOOLEAN DEFAULT true,
  duracion_periodo_dias INTEGER DEFAULT 30,

  -- Recurrence settings
  frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('MENSUAL', 'TRIMESTRAL', 'ANUAL', 'PERSONALIZADO')),
  dia_generacion INTEGER DEFAULT 1 CHECK (dia_generacion BETWEEN 1 AND 31),
  intervalo_dias INTEGER,

  -- Scheduling
  proxima_generacion DATE NOT NULL,
  ultima_generacion DATE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,

  -- Status
  activo BOOLEAN DEFAULT true,
  pausado BOOLEAN DEFAULT false,
  motivo_pausa TEXT,

  -- Automatic actions
  generar_pdf_automatico BOOLEAN DEFAULT true,
  enviar_email_automatico BOOLEAN DEFAULT false,

  -- Audit & stats
  total_facturas_generadas INTEGER DEFAULT 0,
  ultima_factura_generada_id UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_duracion_periodo CHECK (duracion_periodo_dias > 0),
  CONSTRAINT chk_intervalo_personalizado CHECK (
    (frecuencia != 'PERSONALIZADO') OR (intervalo_dias IS NOT NULL AND intervalo_dias > 0)
  )
);

-- Indexes for performance
CREATE INDEX idx_recurring_templates_user ON recurring_invoice_templates(user_id);
CREATE INDEX idx_recurring_templates_cliente ON recurring_invoice_templates(cliente_id);
CREATE INDEX idx_recurring_templates_activo ON recurring_invoice_templates(user_id, activo) WHERE activo = true;
CREATE INDEX idx_recurring_templates_proxima ON recurring_invoice_templates(proxima_generacion, activo, pausado)
  WHERE activo = true AND pausado = false;

-- ======================
-- 2. RECURRING INVOICE HISTORY TABLE
-- ======================
CREATE TABLE recurring_invoice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  invoice_id UUID,

  -- Generation details
  fecha_generacion TIMESTAMP DEFAULT NOW(),
  fecha_programada DATE NOT NULL,
  exitoso BOOLEAN NOT NULL,

  -- Error tracking
  error_mensaje TEXT,
  error_stack TEXT,

  -- Generated invoice details (for audit trail even if invoice deleted)
  numero_factura VARCHAR(50),
  total_factura DECIMAL(10,2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_history_template ON recurring_invoice_history(template_id);
CREATE INDEX idx_recurring_history_fecha ON recurring_invoice_history(fecha_generacion);
CREATE INDEX idx_recurring_history_invoice ON recurring_invoice_history(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_recurring_history_exitoso ON recurring_invoice_history(template_id, exitoso);

-- ======================
-- 3. UPDATE INVOICES TABLE
-- ======================
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS es_recurrente BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_invoices_template ON invoices(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_recurrente ON invoices(user_id, es_recurrente) WHERE es_recurrente = true;

-- Add FK constraint for last generated invoice (after invoices table is updated)
ALTER TABLE recurring_invoice_templates
ADD CONSTRAINT fk_ultima_factura FOREIGN KEY (ultima_factura_generada_id)
REFERENCES invoices(id) ON DELETE SET NULL;

-- ======================
-- 4. TRIGGERS
-- ======================

-- Auto-update updated_at on templates
CREATE TRIGGER update_recurring_templates_updated_at
  BEFORE UPDATE ON recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validate client is active before creating/updating template
CREATE OR REPLACE FUNCTION validate_recurring_template_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if client exists, is active, and belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = NEW.cliente_id
    AND user_id = NEW.user_id
    AND activo = true
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado, inactivo, o no pertenece al usuario';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_recurring_template_before_insert
  BEFORE INSERT OR UPDATE OF cliente_id ON recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION validate_recurring_template_client();

-- Validate proxima_generacion is after fecha_inicio
CREATE OR REPLACE FUNCTION validate_proxima_generacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proxima_generacion < NEW.fecha_inicio THEN
    RAISE EXCEPTION 'La próxima generación debe ser igual o posterior a la fecha de inicio';
  END IF;

  IF NEW.fecha_fin IS NOT NULL AND NEW.proxima_generacion > NEW.fecha_fin THEN
    RAISE EXCEPTION 'La próxima generación no puede ser posterior a la fecha fin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_proxima_before_insert_update
  BEFORE INSERT OR UPDATE OF proxima_generacion, fecha_inicio, fecha_fin ON recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION validate_proxima_generacion();

-- ======================
-- 5. COMMENTS FOR DOCUMENTATION
-- ======================
COMMENT ON TABLE recurring_invoice_templates IS 'Plantillas de facturas recurrentes con configuración de frecuencia y generación automática';
COMMENT ON TABLE recurring_invoice_history IS 'Historial de todas las generaciones de facturas recurrentes (exitosas y fallidas)';
COMMENT ON COLUMN recurring_invoice_templates.frecuencia IS 'Frecuencia de generación: MENSUAL (cada mes), TRIMESTRAL (cada 3 meses), ANUAL (cada año), PERSONALIZADO (intervalo_dias)';
COMMENT ON COLUMN recurring_invoice_templates.dia_generacion IS 'Día del mes/periodo en que se genera la factura (1-31)';
COMMENT ON COLUMN recurring_invoice_templates.proxima_generacion IS 'Próxima fecha programada para generar factura automáticamente';
COMMENT ON COLUMN recurring_invoice_templates.incluir_periodo_facturacion IS 'Si true, las facturas generadas incluirán periodo_facturacion_inicio/fin automáticamente';
COMMENT ON COLUMN recurring_invoice_templates.duracion_periodo_dias IS 'Duración del periodo de facturación en días (default 30 para mensual, 90 para trimestral)';
COMMENT ON COLUMN invoices.template_id IS 'ID de la plantilla desde la que se generó esta factura (si es recurrente)';
COMMENT ON COLUMN invoices.es_recurrente IS 'Indica si esta factura fue generada automáticamente desde una plantilla recurrente';

-- ======================
-- MIGRATION COMPLETE
-- ======================

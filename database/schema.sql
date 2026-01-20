-- miGestor Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- 1. USERS TABLE
-- ======================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Datos personales
  nombre_completo VARCHAR(255) NOT NULL,
  nif VARCHAR(9) UNIQUE NOT NULL,

  -- Datos fiscales
  regimen_fiscal VARCHAR(50) DEFAULT 'TRADE',
  fecha_alta_autonomo DATE NOT NULL,
  epigrafe_iae VARCHAR(10),

  -- Configuración TRADE
  es_trade BOOLEAN DEFAULT true,
  porcentaje_dependencia DECIMAL(5,2) DEFAULT 75.00,
  tiene_local_alquilado BOOLEAN DEFAULT false,

  -- Configuración fiscal
  tipo_iva_predeterminado DECIMAL(4,2) DEFAULT 21.00,
  tipo_irpf_actual DECIMAL(4,2) DEFAULT 7.00,
  tipo_irpf_estimado DECIMAL(4,2) DEFAULT 21.00,

  -- Preferencias
  timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  idioma VARCHAR(5) DEFAULT 'es-ES',

  -- Visibilidad de modelos fiscales
  mostrar_modelo_303 BOOLEAN DEFAULT true,
  mostrar_modelo_130 BOOLEAN DEFAULT true,
  mostrar_modelo_115 BOOLEAN DEFAULT false,
  mostrar_modelo_180 BOOLEAN DEFAULT false,
  mostrar_modelo_390 BOOLEAN DEFAULT false,

  -- Seguridad Social
  tiene_tarifa_plana_ss BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_nif ON users(nif);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_model_visibility ON users(mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115, mostrar_modelo_180, mostrar_modelo_390);

-- ======================
-- 2. CLIENTS TABLE
-- ======================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos del cliente
  razon_social VARCHAR(255) NOT NULL,
  cif VARCHAR(9) NOT NULL,

  -- Dirección
  direccion TEXT,
  codigo_postal VARCHAR(10),
  ciudad VARCHAR(100),
  provincia VARCHAR(100),

  -- Contacto
  email VARCHAR(255),
  telefono VARCHAR(20),
  persona_contacto VARCHAR(255),

  -- Control TRADE
  es_cliente_principal BOOLEAN DEFAULT false,
  porcentaje_facturacion DECIMAL(5,2),

  -- Estado
  activo BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_clients_cif ON clients(cif);
CREATE INDEX idx_clients_principal ON clients(user_id, es_cliente_principal) WHERE es_cliente_principal = true;

-- ======================
-- 3. ASSETS TABLE
-- ======================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos del bien
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100),

  -- Datos fiscales
  fecha_adquisicion DATE NOT NULL,
  importe_adquisicion DECIMAL(10,2) NOT NULL,
  iva_soportado DECIMAL(10,2),

  -- Amortización
  vida_util_anos INTEGER DEFAULT 5,
  porcentaje_amortizacion_anual DECIMAL(5,2),
  amortizacion_acumulada DECIMAL(10,2) DEFAULT 0.00,

  -- Control
  numero_factura VARCHAR(100),
  proveedor VARCHAR(255),

  -- Estado
  activo BOOLEAN DEFAULT true,
  fecha_baja DATE,
  motivo_baja TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_fecha ON assets(fecha_adquisicion);
CREATE INDEX idx_assets_activo ON assets(user_id, activo);

-- ======================
-- 4. EXPENSES TABLE
-- ======================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos básicos
  concepto VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) NOT NULL,

  -- Datos fiscales
  fecha_emision DATE NOT NULL,
  numero_factura VARCHAR(100),
  proveedor_nombre VARCHAR(255) NOT NULL,
  proveedor_cif VARCHAR(9),

  -- Importes
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2),
  tipo_irpf DECIMAL(4,2) DEFAULT 0.00,
  cuota_irpf DECIMAL(10,2),
  total_factura DECIMAL(10,2) NOT NULL,

  -- Deducibilidad
  porcentaje_deducible DECIMAL(5,2) DEFAULT 100.00,
  es_deducible BOOLEAN DEFAULT true,
  motivo_no_deducible TEXT,

  -- Control TRADE
  es_gasto_independencia BOOLEAN DEFAULT false,
  nivel_riesgo VARCHAR(20) DEFAULT 'BAJO',
  notas_riesgo TEXT,

  -- OCR Data
  ocr_procesado BOOLEAN DEFAULT false,
  ocr_confianza DECIMAL(3,2),
  ocr_texto_completo TEXT,
  ocr_datos_extraidos JSONB,
  ocr_requiere_revision BOOLEAN DEFAULT false,

  -- Archivo
  archivo_url TEXT,
  archivo_nombre VARCHAR(255),
  archivo_tipo VARCHAR(50),

  -- Estado
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  pagado BOOLEAN DEFAULT false,
  fecha_pago DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_fecha ON expenses(user_id, fecha_emision);
CREATE INDEX idx_expenses_categoria ON expenses(categoria);
CREATE INDEX idx_expenses_deducible ON expenses(user_id, es_deducible);
CREATE INDEX idx_expenses_independencia ON expenses(user_id, es_gasto_independencia);
CREATE INDEX idx_expenses_ocr_data ON expenses USING GIN (ocr_datos_extraidos);

-- ======================
-- 5. INVOICES TABLE
-- ======================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,

  -- Numeración
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  serie VARCHAR(10) DEFAULT 'A',

  -- Fechas
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  periodo_facturacion_inicio DATE,
  periodo_facturacion_fin DATE,

  -- Concepto
  concepto TEXT NOT NULL,
  descripcion_detallada TEXT,

  -- Importes
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2) NOT NULL,
  tipo_irpf DECIMAL(4,2) DEFAULT 7.00,
  cuota_irpf DECIMAL(10,2) NOT NULL,
  total_factura DECIMAL(10,2) NOT NULL,

  -- Estado de pago
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  pagada BOOLEAN DEFAULT false,
  fecha_pago DATE,
  metodo_pago VARCHAR(50),

  -- Archivo generado
  pdf_url TEXT,
  pdf_generado BOOLEAN DEFAULT false,

  -- Envío
  enviada_cliente BOOLEAN DEFAULT false,
  fecha_envio DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_fecha ON invoices(user_id, fecha_emision);
CREATE INDEX idx_invoices_numero ON invoices(numero_factura);
CREATE INDEX idx_invoices_estado ON invoices(user_id, estado);

-- ======================
-- 6. TAX CALCULATIONS TABLE
-- ======================
CREATE TABLE tax_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Periodo
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  ano INTEGER NOT NULL,
  modelo VARCHAR(10) NOT NULL,

  -- IVA (Modelo 303)
  iva_repercutido DECIMAL(10,2) DEFAULT 0.00,
  iva_soportado DECIMAL(10,2) DEFAULT 0.00,
  iva_resultado DECIMAL(10,2),

  -- IRPF (Modelo 130)
  ingresos_totales DECIMAL(10,2) DEFAULT 0.00,
  gastos_deducibles DECIMAL(10,2) DEFAULT 0.00,
  rendimiento_neto DECIMAL(10,2),
  retencion_practicada DECIMAL(10,2) DEFAULT 0.00,
  pago_fraccionado DECIMAL(10,2),

  -- Retenciones (Modelo 115)
  retenciones_profesionales DECIMAL(10,2) DEFAULT 0.00,

  -- Estado
  calculado_automaticamente BOOLEAN DEFAULT true,
  presentado_aeat BOOLEAN DEFAULT false,
  fecha_presentacion DATE,
  justificante_url TEXT,

  -- Metadatos
  notas TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_tax_period UNIQUE (user_id, trimestre, ano, modelo)
);

CREATE INDEX idx_tax_calcs_user ON tax_calculations(user_id);
CREATE INDEX idx_tax_calcs_periodo ON tax_calculations(ano, trimestre);

-- ======================
-- 7. COMPLIANCE ALERTS TABLE
-- ======================
CREATE TABLE compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo de alerta
  tipo VARCHAR(100) NOT NULL,
  severidad VARCHAR(20) NOT NULL,

  -- Mensaje
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  recomendacion TEXT,

  -- Contexto
  periodo_mes INTEGER,
  periodo_ano INTEGER,

  -- Referencias
  related_expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  related_invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Estado
  leida BOOLEAN DEFAULT false,
  resuelta BOOLEAN DEFAULT false,
  fecha_resolucion TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON compliance_alerts(user_id);
CREATE INDEX idx_alerts_leida ON compliance_alerts(user_id, leida);
CREATE INDEX idx_alerts_severidad ON compliance_alerts(severidad);

-- ======================
-- 8. FISCAL EVENTS TABLE
-- ======================
CREATE TABLE fiscal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Evento
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Fechas
  fecha_limite DATE NOT NULL,
  fecha_recordatorio DATE,

  -- Periodo
  trimestre INTEGER CHECK (trimestre BETWEEN 1 AND 4),
  mes INTEGER CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,

  -- Estado
  completado BOOLEAN DEFAULT false,
  fecha_completado DATE,

  -- Notificaciones
  notificacion_enviada BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fiscal_events_user ON fiscal_events(user_id);
CREATE INDEX idx_fiscal_events_fecha ON fiscal_events(fecha_limite);
CREATE INDEX idx_fiscal_events_completado ON fiscal_events(user_id, completado);

-- ======================
-- 9. BANK ACCOUNTS TABLE
-- ======================
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos bancarios
  banco VARCHAR(255) NOT NULL,
  iban VARCHAR(34) UNIQUE NOT NULL,
  alias VARCHAR(100),

  -- Balance
  saldo_actual DECIMAL(10,2) DEFAULT 0.00,
  fecha_ultimo_balance DATE DEFAULT NOW(),

  -- Control
  cuenta_principal BOOLEAN DEFAULT false,
  activa BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_principal ON bank_accounts(user_id, cuenta_principal) WHERE cuenta_principal = true;

-- ======================
-- 10. CASH FLOW SNAPSHOTS TABLE
-- ======================
CREATE TABLE cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Fecha snapshot
  fecha_snapshot DATE NOT NULL DEFAULT NOW(),

  -- Balance bancario
  saldo_bancario_total DECIMAL(10,2) NOT NULL,

  -- Obligaciones pendientes
  iva_pendiente_pagar DECIMAL(10,2) DEFAULT 0.00,
  irpf_brecha DECIMAL(10,2) DEFAULT 0.00,
  seguridad_social_pendiente DECIMAL(10,2) DEFAULT 0.00,

  -- Balance real
  balance_real DECIMAL(10,2),

  -- Contexto
  ingresos_acumulados_ano DECIMAL(10,2) DEFAULT 0.00,
  gastos_acumulados_ano DECIMAL(10,2) DEFAULT 0.00,
  beneficio_neto_estimado DECIMAL(10,2),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cash_flow_user ON cash_flow_snapshots(user_id);
CREATE INDEX idx_cash_flow_fecha ON cash_flow_snapshots(fecha_snapshot);

-- ======================
-- 11. SCENARIO SIMULATIONS TABLE
-- ======================
CREATE TABLE scenario_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Escenario
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Parámetros simulados
  ingresos_cliente_principal DECIMAL(10,2),
  ingresos_cliente_secundario DECIMAL(10,2),
  gastos_mensuales_adicionales DECIMAL(10,2),

  -- Resultados
  nuevo_porcentaje_dependencia DECIMAL(5,2),
  cumple_trade BOOLEAN,
  riesgo_score INTEGER,

  -- Impacto fiscal
  iva_anual_estimado DECIMAL(10,2),
  irpf_anual_estimado DECIMAL(10,2),
  beneficio_neto_anual_estimado DECIMAL(10,2),

  -- Recomendaciones
  recomendaciones TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulations_user ON scenario_simulations(user_id);

-- ======================
-- TRIGGERS
-- ======================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_calculations_updated_at BEFORE UPDATE ON tax_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_alerts_updated_at BEFORE UPDATE ON compliance_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiscal_events_updated_at BEFORE UPDATE ON fiscal_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validate invoice calculations
CREATE OR REPLACE FUNCTION validate_invoice_calculations()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar cuota_iva
  IF ABS(NEW.cuota_iva - (NEW.base_imponible * NEW.tipo_iva / 100)) > 0.01 THEN
    RAISE EXCEPTION 'Error en cálculo de IVA: esperado %, recibido %',
      (NEW.base_imponible * NEW.tipo_iva / 100), NEW.cuota_iva;
  END IF;

  -- Validar cuota_irpf
  IF ABS(NEW.cuota_irpf - (NEW.base_imponible * NEW.tipo_irpf / 100)) > 0.01 THEN
    RAISE EXCEPTION 'Error en cálculo de IRPF: esperado %, recibido %',
      (NEW.base_imponible * NEW.tipo_irpf / 100), NEW.cuota_irpf;
  END IF;

  -- Validar total
  IF ABS(NEW.total_factura - (NEW.base_imponible + NEW.cuota_iva - NEW.cuota_irpf)) > 0.01 THEN
    RAISE EXCEPTION 'Error en cálculo de total';
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_invoice_before_insert
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION validate_invoice_calculations();

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Generate fiscal calendar for a year
CREATE OR REPLACE FUNCTION generate_fiscal_calendar(p_user_id UUID, p_year INTEGER)
RETURNS void AS $$
BEGIN
  -- Modelo 303 (IVA trimestral)
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, trimestre, ano)
  VALUES
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 1T', DATE(p_year || '-04-20'), 1, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 2T', DATE(p_year || '-07-20'), 2, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 3T', DATE(p_year || '-10-20'), 3, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 4T', DATE((p_year + 1) || '-01-20'), 4, p_year);

  -- Modelo 130 (IRPF trimestral)
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, trimestre, ano)
  VALUES
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 1T', DATE(p_year || '-04-20'), 1, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 2T', DATE(p_year || '-07-20'), 2, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 3T', DATE(p_year || '-10-20'), 3, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 4T', DATE((p_year + 1) || '-01-20'), 4, p_year);

  -- Modelo 390 (Resumen anual IVA)
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, ano)
  VALUES
    (p_user_id, 'MODELO_390', 'Modelo 390 - Resumen Anual IVA', DATE((p_year + 1) || '-01-30'), p_year);
END;
$$ language 'plpgsql';

-- miGestor Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre_comercial VARCHAR(255) NOT NULL,
  nif VARCHAR(9) UNIQUE NOT NULL,
  es_trade BOOLEAN DEFAULT false,
  actividad_economica VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  cif VARCHAR(9) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(20),
  direccion TEXT,
  ciudad VARCHAR(100),
  codigo_postal VARCHAR(10),
  provincia VARCHAR(100),
  persona_contacto VARCHAR(255),
  es_cliente_principal BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_principal ON clientes(user_id, es_cliente_principal) WHERE es_cliente_principal = true;

-- 3. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  concepto VARCHAR(500) NOT NULL,
  categoria VARCHAR(100),
  fecha_emision DATE NOT NULL,
  proveedor_nombre VARCHAR(255),
  proveedor_cif VARCHAR(9),
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2) NOT NULL,
  tipo_irpf DECIMAL(4,2) DEFAULT 0.00,
  cuota_irpf DECIMAL(10,2) DEFAULT 0.00,
  total_factura DECIMAL(10,2) NOT NULL,
  es_gasto_independencia BOOLEAN DEFAULT false,
  nivel_riesgo VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_fecha ON expenses(fecha_emision);

-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS facturas_emitidas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  serie VARCHAR(10) DEFAULT 'A',
  fecha_emision DATE NOT NULL,
  concepto TEXT NOT NULL,
  periodo_facturacion_inicio DATE,
  periodo_facturacion_fin DATE,
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2) NOT NULL,
  tipo_irpf DECIMAL(4,2) DEFAULT 7.00,
  cuota_irpf DECIMAL(10,2) NOT NULL,
  total_factura DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'PENDIENTE',
  fecha_cobro DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas_emitidas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas_emitidas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas_emitidas(fecha_emision);

-- 5. Bank Accounts Table
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  banco VARCHAR(255) NOT NULL,
  numero_cuenta VARCHAR(24) NOT NULL,
  saldo_actual DECIMAL(10,2) DEFAULT 0.00,
  es_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Compliance Alerts Table
CREATE TABLE IF NOT EXISTS alertas_compliance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  nivel VARCHAR(20) NOT NULL,
  mensaje TEXT NOT NULL,
  fecha_alerta TIMESTAMP DEFAULT NOW(),
  leida BOOLEAN DEFAULT false
);

-- 7. Fiscal Events Table
CREATE TABLE IF NOT EXISTS eventos_fiscales (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(50) NOT NULL,
  fecha_limite DATE NOT NULL,
  trimestre INTEGER,
  year INTEGER NOT NULL,
  descripcion TEXT,
  completado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_user ON eventos_fiscales(user_id);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos_fiscales(fecha_limite);

-- Insert default fiscal events for current year
CREATE OR REPLACE FUNCTION generate_fiscal_calendar(p_user_id INTEGER, p_year INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Modelo 303 (VAT) deadlines
  INSERT INTO eventos_fiscales (user_id, tipo_evento, fecha_limite, trimestre, year, descripcion)
  VALUES
    (p_user_id, 'MODELO_303', (p_year || '-04-20')::DATE, 1, p_year, 'Declaración IVA 1T'),
    (p_user_id, 'MODELO_303', (p_year || '-07-20')::DATE, 2, p_year, 'Declaración IVA 2T'),
    (p_user_id, 'MODELO_303', (p_year || '-10-20')::DATE, 3, p_year, 'Declaración IVA 3T'),
    (p_user_id, 'MODELO_303', ((p_year + 1) || '-01-30')::DATE, 4, p_year, 'Declaración IVA 4T');

  -- Modelo 130 (IRPF) deadlines
  INSERT INTO eventos_fiscales (user_id, tipo_evento, fecha_limite, trimestre, year, descripcion)
  VALUES
    (p_user_id, 'MODELO_130', (p_year || '-04-20')::DATE, 1, p_year, 'Pago fraccionado IRPF 1T'),
    (p_user_id, 'MODELO_130', (p_year || '-07-20')::DATE, 2, p_year, 'Pago fraccionado IRPF 2T'),
    (p_user_id, 'MODELO_130', (p_year || '-10-20')::DATE, 3, p_year, 'Pago fraccionado IRPF 3T'),
    (p_user_id, 'MODELO_130', ((p_year + 1) || '-01-30')::DATE, 4, p_year, 'Pago fraccionado IRPF 4T');
END;
$$ LANGUAGE plpgsql;

-- Validation function for calculations
CREATE OR REPLACE FUNCTION validate_invoice_calculations()
RETURNS TRIGGER AS $$
BEGIN
  IF ABS(NEW.cuota_iva - (NEW.base_imponible * NEW.tipo_iva / 100)) > 0.01 THEN
    RAISE EXCEPTION 'IVA calculation error: expected %, got %',
      (NEW.base_imponible * NEW.tipo_iva / 100), NEW.cuota_iva;
  END IF;

  IF ABS(NEW.cuota_irpf - (NEW.base_imponible * NEW.tipo_irpf / 100)) > 0.01 THEN
    RAISE EXCEPTION 'IRPF calculation error: expected %, got %',
      (NEW.base_imponible * NEW.tipo_irpf / 100), NEW.cuota_irpf;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to invoices
CREATE TRIGGER trg_validate_invoice_calculations
  BEFORE INSERT OR UPDATE ON facturas_emitidas
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_calculations();

-- Apply trigger to expenses
CREATE TRIGGER trg_validate_expense_calculations
  BEFORE INSERT OR UPDATE ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_calculations();

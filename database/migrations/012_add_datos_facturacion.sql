-- Migration: Add datos_facturacion table for multiple billing configurations
-- Date: 2026-01-14
-- Description: Allow multiple billing configurations per user with one active at a time

-- Create datos_facturacion table
CREATE TABLE IF NOT EXISTS datos_facturacion (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identificador (nombre o razón social)
  razon_social VARCHAR(255) NOT NULL,

  -- Dirección
  direccion TEXT,
  codigo_postal VARCHAR(10),
  ciudad VARCHAR(100),
  provincia VARCHAR(100),

  -- Contacto
  telefono VARCHAR(20),
  email_facturacion VARCHAR(255),

  -- Datos bancarios
  iban VARCHAR(34),

  -- Branding
  logo_url TEXT,

  -- Notas para facturas
  notas_factura TEXT,

  -- Estado (solo uno activo por usuario)
  activo BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_datos_facturacion_user ON datos_facturacion(user_id);
CREATE INDEX IF NOT EXISTS idx_datos_facturacion_activo ON datos_facturacion(user_id, activo) WHERE activo = true;

-- Comments
COMMENT ON TABLE datos_facturacion IS 'Multiple billing configurations per user for invoice generation';
COMMENT ON COLUMN datos_facturacion.razon_social IS 'Business name or personal name for this billing config';
COMMENT ON COLUMN datos_facturacion.activo IS 'Only one config can be active per user at a time';

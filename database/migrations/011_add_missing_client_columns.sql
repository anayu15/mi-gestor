-- Migración para agregar columnas faltantes en tabla clientes
-- Fecha: 2026-01-12

-- Agregar columna provincia
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);

-- Agregar columna persona_contacto
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS persona_contacto VARCHAR(255);

-- Comentarios
COMMENT ON COLUMN clientes.provincia IS 'Provincia del cliente';
COMMENT ON COLUMN clientes.persona_contacto IS 'Nombre de la persona de contacto en el cliente';

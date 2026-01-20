-- Migración para renombrar columna es_principal a es_cliente_principal
-- Fecha: 2026-01-12

-- Renombrar la columna en la tabla clientes
ALTER TABLE clientes
RENAME COLUMN es_principal TO es_cliente_principal;

-- Actualizar el índice si existe
DROP INDEX IF EXISTS idx_clientes_principal;

CREATE INDEX IF NOT EXISTS idx_clientes_principal
ON clientes(user_id, es_cliente_principal)
WHERE es_cliente_principal = true;

-- Comentario
COMMENT ON COLUMN clientes.es_cliente_principal IS 'Indica si este cliente es el principal para cálculos TRADE';

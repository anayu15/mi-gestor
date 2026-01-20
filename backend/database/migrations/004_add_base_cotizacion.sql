-- Migración 004: Agregar base de cotización seleccionada por el usuario
-- Fecha: 2026-01-12
-- Descripción: Permite al autónomo elegir su base de cotización dentro de su tramo

-- Agregar columna para la base de cotización elegida (en euros)
-- NULL = usa la base mínima del tramo automáticamente
-- Si tiene tarifa plana, este valor no se usa
ALTER TABLE users
ADD COLUMN base_cotizacion DECIMAL(10,2) DEFAULT NULL;

-- Comentario de la columna
COMMENT ON COLUMN users.base_cotizacion IS 'Base de cotización elegida por el autónomo (en euros). NULL = usa base mínima del tramo. No aplica si tiene_tarifa_plana_ss = true';

-- Crear índice para consultas
CREATE INDEX idx_users_base_cotizacion ON users(base_cotizacion) WHERE base_cotizacion IS NOT NULL;

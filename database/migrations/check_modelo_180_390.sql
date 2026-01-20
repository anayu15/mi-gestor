-- Script de verificación para Modelos 180 y 390
-- Ejecuta este script para verificar si las columnas existen

-- Verificar si las columnas existen
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM
    information_schema.columns
WHERE
    table_name = 'users'
    AND column_name IN ('mostrar_modelo_180', 'mostrar_modelo_390')
ORDER BY
    column_name;

-- Si el resultado está vacío, las columnas NO existen y necesitas ejecutar la migración
-- Si ves 2 filas, las columnas YA existen y todo está correcto

-- Para aplicar la migración si no existe, descomenta y ejecuta:
/*
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mostrar_modelo_180 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mostrar_modelo_390 BOOLEAN DEFAULT false;

COMMENT ON COLUMN users.mostrar_modelo_180 IS 'Controls visibility of Modelo 180 (Annual rental withholdings report)';
COMMENT ON COLUMN users.mostrar_modelo_390 IS 'Controls visibility of Modelo 390 (Annual VAT summary)';

DROP INDEX IF EXISTS idx_users_model_visibility;
CREATE INDEX idx_users_model_visibility ON users(
    mostrar_modelo_303,
    mostrar_modelo_130,
    mostrar_modelo_115,
    mostrar_modelo_180,
    mostrar_modelo_390
);

-- Verificar que se aplicó correctamente
SELECT
    mostrar_modelo_303,
    mostrar_modelo_130,
    mostrar_modelo_115,
    mostrar_modelo_180,
    mostrar_modelo_390
FROM users
LIMIT 1;
*/

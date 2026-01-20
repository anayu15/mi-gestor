#!/bin/bash

# Script para aplicar la migración de Modelos 180 y 390
# Uso: ./apply_modelo_180_390.sh

echo "=========================================="
echo "Aplicando migración Modelos 180 y 390"
echo "=========================================="
echo ""

# Variables de conexión (ajusta según tu configuración)
DB_NAME="${DB_NAME:-mi_gestor}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "Conectando a base de datos: $DB_NAME"
echo "Usuario: $DB_USER"
echo "Host: $DB_HOST:$DB_PORT"
echo ""

# Verificar si las columnas ya existen
echo "1. Verificando si las columnas ya existen..."
RESULT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('mostrar_modelo_180', 'mostrar_modelo_390');")

if [ "$RESULT" -eq 2 ]; then
    echo "✅ Las columnas ya existen. No es necesario aplicar la migración."
    echo ""
    echo "Valores actuales:"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT email, mostrar_modelo_180, mostrar_modelo_390 FROM users LIMIT 5;"
    exit 0
fi

echo "⚠️  Las columnas no existen. Aplicando migración..."
echo ""

# Aplicar la migración
echo "2. Ejecutando migración..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/003_add_modelo_180_390_preferences.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migración aplicada correctamente"
    echo ""
    echo "3. Verificando cambios..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT email, mostrar_modelo_180, mostrar_modelo_390 FROM users LIMIT 5;"
    echo ""
    echo "=========================================="
    echo "✅ TODO LISTO"
    echo "=========================================="
    echo "Ahora puedes:"
    echo "1. Reiniciar el backend: cd backend && npm run dev"
    echo "2. Ir a Configuración en la app"
    echo "3. Activar Modelos 180 y 390"
    echo "4. Guardar cambios"
else
    echo ""
    echo "❌ Error al aplicar la migración"
    echo "Por favor, verifica los logs arriba"
    exit 1
fi

# Configuración de Modelos 180 y 390

Este documento explica cómo activar los modelos fiscales 180 y 390 en miGestor.

## Paso 1: Aplicar Migración de Base de Datos

**IMPORTANTE:** Debes ejecutar la migración para agregar las nuevas columnas a la base de datos.

### Opción A: Usando psql (Recomendado)

```bash
# Conéctate a tu base de datos PostgreSQL
psql -U tu_usuario -d mi_gestor

# Ejecuta la migración
\i database/migrations/003_add_modelo_180_390_preferences.sql

# Verifica que las columnas se hayan agregado
\d users
```

### Opción B: Desde el código SQL directamente

Si prefieres copiar y pegar el SQL:

```sql
-- Migration: Add modelo 180 and 390 visibility preferences
-- Date: 2026-01-12

-- Add model visibility columns to users table
ALTER TABLE users
ADD COLUMN mostrar_modelo_180 BOOLEAN DEFAULT false,
ADD COLUMN mostrar_modelo_390 BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN users.mostrar_modelo_180 IS 'Controls visibility of Modelo 180 (Annual rental withholdings report) in navigation and direct access';
COMMENT ON COLUMN users.mostrar_modelo_390 IS 'Controls visibility of Modelo 390 (Annual VAT summary) in navigation and direct access';

-- Update index for model visibility to include new columns
DROP INDEX IF EXISTS idx_users_model_visibility;
CREATE INDEX idx_users_model_visibility ON users(mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115, mostrar_modelo_180, mostrar_modelo_390);
```

## Paso 2: Verificar la Migración

Verifica que las columnas se agregaron correctamente:

```sql
SELECT
  mostrar_modelo_303,
  mostrar_modelo_130,
  mostrar_modelo_115,
  mostrar_modelo_180,
  mostrar_modelo_390
FROM users
LIMIT 1;
```

Deberías ver todas las columnas con valores `true` o `false`.

## Paso 3: Reiniciar el Backend

Después de aplicar la migración, reinicia el servidor backend:

```bash
cd backend
npm run dev
```

## Paso 4: Activar los Modelos en Ajustes

1. Inicia sesión en miGestor
2. Ve a **Configuración** (icono de engranaje ⚙️)
3. En la sección **Modelos Fiscales**, activa:
   - **Modelo 180** - Resumen anual de retenciones sobre alquileres
   - **Modelo 390** - Resumen anual del IVA
4. Haz clic en **Guardar cambios**

## Paso 5: Verificar Funcionamiento

1. La página debería recargarse automáticamente después de guardar
2. Los nuevos modelos aparecerán en el **Calendario Fiscal**
3. Puedes acceder a ellos desde:
   - Calendario Fiscal → Botones de acceso rápido
   - Directamente en `/fiscal/modelo-180` y `/fiscal/modelo-390`

## Solución de Problemas

### Error: "column mostrar_modelo_180 does not exist"

**Causa:** La migración no se ha aplicado.

**Solución:** Ejecuta la migración siguiendo el Paso 1.

### Los cambios no se guardan

**Causa:** El backend no está corriendo o hay un error en la base de datos.

**Solución:**
1. Verifica que el backend esté corriendo: `cd backend && npm run dev`
2. Revisa los logs del backend para ver si hay errores
3. Verifica la conexión a la base de datos

### Los modelos no aparecen en el calendario

**Causa:** Los modelos no están activados en ajustes.

**Solución:** Ve a Configuración y activa los modelos que quieres ver.

## Características de los Modelos

### Modelo 180 - Resumen Anual de Retenciones sobre Alquileres

- **Frecuencia:** Anual (se presenta en enero)
- **Fecha límite:** 31 de enero del año siguiente
- **Qué incluye:** Resumen de todas las retenciones del 19% sobre alquileres de locales
- **Relación:** Es el resumen anual de los Modelo 115 trimestrales

### Modelo 390 - Resumen Anual del IVA

- **Frecuencia:** Anual (se presenta en enero)
- **Fecha límite:** 30 de enero del año siguiente
- **Qué incluye:** Consolidación de todas las operaciones de IVA del año
- **Relación:** Es el resumen anual de los Modelo 303 trimestrales
- **Verificación:** La suma de los 4 trimestres debe coincidir con el total anual

## Notas Importantes

- Ambos modelos son **declaraciones informativas**
- Los pagos ya se realizaron trimestralmente con los modelos 115 y 303
- Solo activa estos modelos si los necesitas para tu actividad
- Puedes activarlos o desactivarlos en cualquier momento sin perder datos

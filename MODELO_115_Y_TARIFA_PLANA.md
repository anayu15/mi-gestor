# Modelo 115 y Tarifa Plana de Seguridad Social

## ✅ Implementación Completada

Se han agregado dos nuevas opciones de configuración:
1. **Modelo 115** - Retenciones por alquiler de locales
2. **Tarifa Plana de Seguridad Social** - Bonificación para nuevos autónomos

---

## 📊 Modelo 115 - Retenciones de Alquileres

### ¿Qué es?

El Modelo 115 es un formulario trimestral mediante el cual autónomos y empresas declaran y liquidan las retenciones del IRPF practicadas en el pago de sus alquileres de locales para uso profesional.

### Características clave

- **Retención:** 19% del precio del alquiler pactado
- **Frecuencia:** Trimestral (igual que Modelo 303 y 130)
- **Plazos de presentación 2026:**
  - 1T: 1-20 de abril
  - 2T: 1-20 de julio
  - 3T: 1-20 de octubre
  - 4T: 1-20 de enero (año siguiente)

### ¿Quién debe presentarlo?

- Autónomos que alquilan inmuebles urbanos para desarrollar su actividad
- Siempre que en el contrato figure la obligación de practicar retención
- **Excepciones:** Cuando las rentas anuales no superan 900€ (IVA excluido)

### Modelo complementario

- **Modelo 180:** Resumen anual de todas las retenciones del 115

---

## 💰 Tarifa Plana de Seguridad Social

### ¿Qué es?

Bonificación en las cuotas de la Seguridad Social para nuevos autónomos durante sus primeros meses de actividad.

### Cuantía y duración (2026)

- **Cuota:** 80€/mes
- **Duración inicial:** 12 meses
- **Prórroga:** Otros 12 meses si rendimientos < SMI (Salario Mínimo Interprofesional)

### Colectivos especiales

Para personas con discapacidad, víctimas de violencia de género o víctimas de terrorismo:
- **Duración inicial:** 24 meses
- **Prórroga:** Hasta 36 meses adicionales con requisitos

### Requisitos

- Darse de alta por primera vez como autónomo, O
- No haber estado en el RETA en los últimos 2 años (3 años si ya disfrutaste de tarifa plana antes)

### Ahorro

- **Cuota regular 2026:** Entre 217€ y 796€/mes (según ingresos)
- **Con tarifa plana:** 80€/mes
- **Ahorro mensual:** ~137€ a 716€/mes
- **Ahorro primer año:** ~1.644€ a 8.592€

### Autónomos societarios

También tienen derecho a la tarifa plana cumpliendo los mismos requisitos.

---

## 🔧 Cambios Implementados

### Base de Datos

**Nuevas columnas en tabla `users`:**
```sql
mostrar_modelo_115 BOOLEAN DEFAULT false
tiene_tarifa_plana_ss BOOLEAN DEFAULT false
```

### Backend

1. **Tipos actualizados** (`types/index.ts`)
   - Agregados campos `mostrar_modelo_115` y `tiene_tarifa_plana_ss`

2. **Controller** (`auth.controller.ts`)
   - `getMe`: Retorna nuevos campos
   - `updatePreferences`: Permite actualizar nuevas preferencias

3. **Validación** (`auth.routes.ts`)
   - Schema de validación incluye nuevos campos opcionales

### Frontend

1. **Página de Configuración** (`/settings`)
   - Card para activar/desactivar Modelo 115
   - Sección de Seguridad Social con toggle para tarifa plana
   - Información detallada de cada opción
   - Badges con etiquetas (Trimestral, 12 meses, etc.)

2. **Navegación** (`Navigation.tsx`)
   - Modelo 115 aparece como "M-115" cuando está activado
   - Se muestra separado de los otros modelos fiscales

3. **Configuración por defecto:**
   - Modelo 115: **Desactivado** (no todos alquilan locales)
   - Tarifa plana SS: **Desactivada** (no todos son nuevos autónomos)

---

## 🎨 Interfaz de Usuario

### En la configuración verás:

**Modelos Fiscales:**
- ✅ Modelo 303 - IVA (badge azul "Trimestral")
- ✅ Modelo 130 - IRPF (badge verde "Trimestral")
- 🆕 Modelo 115 - Retenciones Alquileres (badge naranja "Trimestral")

**Seguridad Social:**
- 🆕 Tarifa Plana 80€/mes (badge morado "12 meses")

Cada opción incluye:
- Toggle switch para activar/desactivar
- Descripción detallada
- Información adicional relevante

---

## 📱 Cómo Usar

### Activar Modelo 115

1. Ve a **Configuración** (icono ⚙️)
2. En la sección "Modelos Fiscales", busca "Modelo 115 - Retenciones Alquileres"
3. Activa el toggle si alquilas un local para tu actividad
4. Haz clic en "Guardar cambios"
5. El modelo aparecerá en la navegación como "M-115"

### Activar Tarifa Plana SS

1. Ve a **Configuración** (icono ⚙️)
2. En la sección "Seguridad Social", busca "Tarifa Plana (80€/mes)"
3. Activa el toggle si eres nuevo autónomo con bonificación
4. Haz clic en "Guardar cambios"
5. El dashboard usará 80€/mes en los cálculos de SS (en lugar de 310€)

---

## 🚀 Próximos pasos

### Para usar estas funcionalidades:

1. **Reinicia el backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Reinicia el frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Accede a la configuración:**
   - Inicia sesión
   - Haz clic en el icono ⚙️
   - Configura tus preferencias

---

## 📚 Fuentes de Información

Esta implementación se basa en información actualizada de fuentes oficiales:

### Modelo 115
- [Infoautonomos - Modelo 115 IRPF Alquileres](https://www.infoautonomos.com/fiscalidad/modelo-115-irpf-alquileres/)
- [Agencia Tributaria - Modelo 115](https://sede.agenciatributaria.gob.es/Sede/procedimientos/GH02.shtml)
- [BBVA - ¿Qué es el modelo 115?](https://www.bbva.es/finanzas-vistazo/ae/cuentas/que-es-el-modelo-115.html)
- [Legálitas - Modelo 115](https://www.legalitas.com/actualidad/modelo-115)
- [Wolters Kluwer - Modelo 115](https://www.wolterskluwer.com/es-es/expert-insights/para-que-sirve-el-modelo-115-y-quien-esta-obligado-a-presentarlo)

### Tarifa Plana de Autónomos
- [Wolters Kluwer - Cuotas Autónomos 2026](https://www.wolterskluwer.com/es-es/expert-insights/cuotas-autonomos-2026)
- [Infoautonomos - Tarifa Plana 2026](https://www.infoautonomos.com/seguridad-social/tarifa-plana-autonomos/)
- [Seguridad Social - Herramientas Web](https://www.seg-social.es/wps/portal/wss/internet/HerramientasWeb/9d2fd4f1-ab0f-42a6-8d10-2e74b378ee24?changeLanguage=es)
- [Baron Seguros - Cuotas de Autónomos 2026](https://baronseguros.com/cotizacion-autonomos-2026/)
- [Taxfix - Tarifa Plana 2026](https://taxfix.com/es-es/autonomos/nuevos-autonomos/tarifa-plana-de-autonomos/)

---

## ⚠️ Notas Importantes

1. **Modelo 115:**
   - Solo actívalo si realmente alquilas un local
   - Debes practicar la retención del 19% al arrendador
   - Si no alcanzas los 900€ anuales, no aplica

2. **Tarifa Plana:**
   - Solo para nuevos autónomos o reingresos tras 2-3 años
   - La cuota es 80€/mes fija, independiente de ingresos
   - Tras 12 meses, pasa a cuotas regulares según ingresos (217€-796€)
   - El sistema usará 80€/mes en cálculos si está activa

3. **Cuotas 2026:**
   - Las cuotas regulares de 2026 son iguales a las de 2025
   - El SMI 2026 aún no está confirmado oficialmente
   - Los cálculos del dashboard se actualizarán según tu configuración

---

## ✅ Checklist de Verificación

- [x] Migración de base de datos ejecutada
- [x] Columnas agregadas correctamente
- [x] Backend actualizado (tipos, controller, routes)
- [x] Frontend actualizado (settings, navigation)
- [x] Información detallada en configuración
- [x] Defaults correctos (ambos false)
- [x] Documentación completa

¡Todo listo para usar! 🎉

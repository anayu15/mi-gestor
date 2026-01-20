# Configuración de Visibilidad de Modelos Fiscales

## ✅ Migración Completada

La migración de la base de datos se ha ejecutado exitosamente. Las siguientes columnas han sido agregadas a la tabla `users`:

- `mostrar_modelo_303` (BOOLEAN, default: true)
- `mostrar_modelo_130` (BOOLEAN, default: true)

## 🎯 Funcionalidad

Los usuarios ahora pueden controlar qué modelos fiscales aparecen en su navegación y a cuáles tienen acceso:

### Panel de Configuración
- Accesible desde el icono ⚙️ en la navegación o visitando `/settings`
- Permite activar/desactivar Modelo 303 (IVA) y Modelo 130 (IRPF)
- Muestra advertencia si ambos modelos están desactivados

### Navegación Dinámica
- **Ambos activos**: Muestra enlace "Fiscal"
- **Solo 303 activo**: Muestra enlace "Modelo 303"
- **Solo 130 activo**: Muestra enlace "Modelo 130"
- **Ambos inactivos**: No muestra enlaces fiscales

### Control de Acceso
- Si un usuario intenta acceder a un modelo desactivado, ve un mensaje amigable
- El mensaje ofrece opciones para:
  - Ir a configuración y habilitar el modelo
  - Volver al dashboard

## 🔄 Reiniciar Servicios

Para que los cambios surtan efecto, reinicia los servicios:

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

## 📝 Notas

- **Retrocompatibilidad**: Todos los usuarios existentes tienen ambos modelos habilitados por defecto
- **Nuevos usuarios**: También tendrán ambos modelos habilitados al registrarse
- **Datos persistentes**: Los cálculos y datos se mantienen incluso si desactivas un modelo
- **Cambios instantáneos**: Los cambios en configuración se aplican inmediatamente tras guardar

## 🧪 Pruebas

Para probar la funcionalidad:

1. Inicia sesión en la aplicación
2. Ve a Configuración (icono ⚙️)
3. Desactiva uno de los modelos
4. Guarda los cambios
5. Observa cómo la navegación se actualiza
6. Intenta acceder directamente al modelo desactivado (ej: `/fiscal/modelo-303`)
7. Verifica que aparece el mensaje de "no habilitado"
8. Reactiva el modelo desde configuración
9. Verifica que ahora puedes acceder

## 🐛 Solución de Problemas

### Error: "column mostrar_modelo_303 does not exist"
Solución: Ejecuta la migración nuevamente:
```bash
cd backend
npm run migrate:preferences
```

### La navegación no se actualiza
Solución: Recarga la página completamente (Cmd+Shift+R o Ctrl+Shift+R)

### Los cambios no se guardan
Verifica:
1. Que el backend esté corriendo
2. Que estés autenticado (token válido)
3. Revisa la consola del navegador para ver errores

## 🎨 Personalización

Si deseas cambiar el comportamiento por defecto, edita:

- **Backend**: `/backend/src/controllers/auth.controller.ts` - función `updatePreferences`
- **Frontend**:
  - Página de configuración: `/frontend/app/settings/page.tsx`
  - Lógica de navegación: `/frontend/components/Navigation.tsx`
  - Control de acceso: `/frontend/hooks/useModelAccess.ts`

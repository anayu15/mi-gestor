# 🚀 START HERE - miGestor Quick Start

**¡Bienvenido a miGestor!** Tu aplicación de gestión fiscal para autónomos TRADE está lista.

---

## ⚡ Quick Start (5 minutos)

### 1. Crear Base de Datos

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE migestor;
\q

# Aplicar schema
psql -U postgres -d migestor -f database/schema.sql
```

### 2. Configurar Variables

```bash
cd backend
# El archivo .env ya está creado
# Solo ajusta DB_PASSWORD si es necesario
nano .env
```

### 3. Iniciar Servidor

```bash
npm run dev
```

Deberías ver:
```
✅ Database connection successful
🚀 miGestor Backend Server
Server running at: http://localhost:3000
```

### 4. Probar API

```bash
curl http://localhost:3000/health
```

---

## 📖 ¿Qué Sigue?

### Para Probar el Backend:

👉 **TESTING_GUIDE.md** - Guía completa con ejemplos curl

Incluye:
- Registro de usuario
- Crear cliente
- Crear gastos
- Generar facturas
- Ver dashboard
- Calcular Modelo 303 y 130

### Para Entender el Proyecto:

👉 **COMPLETED_FEATURES.md** - Resumen de todo lo implementado

Incluye:
- 30+ endpoints funcionales
- Cálculos fiscales automáticos
- Validaciones TRADE
- Dashboard con balance real

### Para Desarrollar:

👉 **API_ROUTES.md** - Documentación completa de la API
👉 **DATABASE_SCHEMA.md** - Schema de base de datos

---

## 🎯 Funcionalidades Listas

✅ Autenticación JWT
✅ Gestión de clientes
✅ Gastos con validaciones TRADE
✅ Generación automática de facturas
✅ Dashboard con balance real
✅ Modelo 303 (IVA trimestral)
✅ Modelo 130 (IRPF trimestral)
✅ Validación de NIF, CIF, IBAN
✅ Cálculos con precisión de céntimos

---

## 📞 ¿Necesitas Ayuda?

1. Revisa **TESTING_GUIDE.md** para ejemplos prácticos
2. Consulta **API_ROUTES.md** para ver todos los endpoints
3. Mira **PROJECT_STATUS.md** para el estado completo

---

## 🔥 Ejemplo Rápido

```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "nombre_completo": "Juan García",
    "nif": "12345678Z",
    "fecha_alta_autonomo": "2024-01-01",
    "es_trade": true
  }'

# Guarda el token que te devuelve

# 2. Ver dashboard
curl -X GET "http://localhost:3000/api/dashboard/summary?year=2024" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

---

**¡Listo! El backend está funcionando.** 🎉

Siguiente paso: Construir el frontend con Next.js o continuar probando la API.

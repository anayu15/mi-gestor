# 🚀 miGestor - Guía de Instalación

Esta guía te ayudará a poner en marcha **miGestor** en tu máquina local.

---

## ✅ Requisitos Previos

Asegúrate de tener instalado:

- **Node.js** 18+ ([Descargar](https://nodejs.org/))
- **PostgreSQL** 15+ ([Descargar](https://www.postgresql.org/download/))
- **npm** o **yarn** (viene con Node.js)
- **Git** (opcional)

### Verificar instalación:

```bash
node --version  # Debe ser v18 o superior
npm --version
psql --version  # Debe ser 15 o superior
```

---

## 📦 Instalación

### Opción 1: Sin Docker (Recomendado para desarrollo)

#### 1. Instalar dependencias del backend

```bash
cd backend
npm install
```

Esto instalará todas las dependencias listadas en `package.json`.

#### 2. Configurar variables de entorno

Crea un archivo `.env` en la carpeta `backend/`:

```bash
cp .env.example .env
```

Edita el archivo `.env` y configura tus valores:

```env
# Server
NODE_ENV=development
PORT=3000

# Database - IMPORTANTE: Ajusta estos valores a tu configuración local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=migestor
DB_USER=postgres
DB_PASSWORD=tu_password_postgres

# JWT - IMPORTANTE: Cambia este secret en producción
JWT_SECRET=change-this-to-a-secure-random-string
JWT_EXPIRES_IN=7d

# OCR
TESSERACT_LANG=spa

# Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# CORS
CORS_ORIGIN=http://localhost:3001
```

#### 3. Crear base de datos PostgreSQL

Abre una terminal y ejecuta:

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE migestor;

# Salir de psql
\q
```

#### 4. Aplicar el schema de base de datos

```bash
# Desde la raíz del proyecto
psql -U postgres -d migestor -f database/schema.sql
```

Este comando creará todas las tablas, índices, triggers y funciones necesarias.

#### 5. Crear directorio de uploads

```bash
cd backend
mkdir -p uploads
```

#### 6. Iniciar el servidor backend

```bash
cd backend
npm run dev
```

Deberías ver:

```
🚀 miGestor Backend Server

Environment: development
Port: 3000
API Prefix: /api
Database: migestor

✅ Database connection successful

Server running at: http://localhost:3000
Health check: http://localhost:3000/health
API docs: http://localhost:3000/api
```

#### 7. Probar que funciona

Abre tu navegador o usa curl:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-10T...",
    "environment": "development"
  }
}
```

---

### Opción 2: Con Docker Compose (Más sencillo pero más pesado)

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Ver logs
docker-compose logs -f backend
```

Esto levantará:
- PostgreSQL en puerto 5432
- Backend API en puerto 3000

---

## 🧪 Probar la API

### 1. Registrar un usuario

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "nombre_completo": "Juan García López",
    "nif": "12345678Z",
    "fecha_alta_autonomo": "2024-01-01",
    "es_trade": true,
    "epigrafe_iae": "763"
  }'
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid...",
      "email": "test@example.com",
      "nombre_completo": "Juan García López",
      "nif": "12345678Z",
      "es_trade": true
    },
    "token": "eyJhbGci..."
  },
  "info": [
    "Usuario registrado correctamente",
    "Calendario fiscal generado automáticamente"
  ]
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

### 3. Obtener perfil (requiere token)

```bash
TOKEN="tu_token_jwt_aqui"

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Crear un gasto

```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "concepto": "Alquiler oficina - Enero 2024",
    "categoria": "Alquiler",
    "fecha_emision": "2024-01-05",
    "proveedor_nombre": "Inmobiliaria XYZ SL",
    "proveedor_cif": "B87654321",
    "base_imponible": 785.12,
    "tipo_iva": 21.0,
    "tipo_irpf": 19.0
  }'
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "concepto": "Alquiler oficina - Enero 2024",
    "base_imponible": 785.12,
    "cuota_iva": 164.88,
    "cuota_irpf": 149.17,
    "total_factura": 800.83,
    "es_gasto_independencia": true,
    "nivel_riesgo": "BAJO"
  },
  "alerts": [
    {
      "tipo": "success",
      "mensaje": "Gasto de independencia registrado (importante para TRADE)"
    }
  ],
  "info": [
    "IVA deducible: 164.88€",
    "IRPF recuperable: 149.17€"
  ]
}
```

---

## 📁 Estructura del Proyecto (Estado Actual)

```
mi-gestor/
├── backend/
│   ├── src/
│   │   ├── config/           ✅ Database & app config
│   │   ├── controllers/      ✅ Auth & Expense controllers
│   │   ├── middleware/       ✅ Auth, validation, error handling
│   │   ├── routes/           ✅ All API routes (placeholders for some)
│   │   ├── types/            ✅ TypeScript interfaces
│   │   ├── utils/            ✅ Tax calculations & helpers
│   │   ├── app.ts            ✅ Express app configuration
│   │   └── server.ts         ✅ Server entry point
│   ├── package.json          ✅
│   ├── tsconfig.json         ✅
│   └── .env.example          ✅
├── database/
│   └── schema.sql            ✅ Complete PostgreSQL schema
├── docker-compose.yml        ✅
├── README.md                 ✅ Project documentation
├── DATABASE_SCHEMA.md        ✅ Database design docs
├── API_ROUTES.md             ✅ API documentation
└── SETUP.md                  ✅ This file
```

---

## ✅ Funcionalidades Implementadas

### Backend Completo

✅ **Autenticación:**
- Registro de usuarios con validación de NIF
- Login con JWT
- Middleware de autenticación
- Generación automática de calendario fiscal

✅ **Gestión de Gastos:**
- Crear, listar, actualizar, eliminar gastos
- Cálculo automático de IVA y IRPF
- Detección automática de categorías
- Sistema de alertas de riesgo TRADE
- Detección de gastos de independencia
- Validación de compliance TRADE

✅ **Cálculos Fiscales:**
- Funciones para Modelo 303 (IVA)
- Funciones para Modelo 130 (IRPF)
- Cálculo de brecha IRPF
- Cálculo de balance real
- Validación de NIF, CIF, IBAN españoles
- Score de riesgo TRADE

✅ **Base de Datos:**
- Schema completo con 11 tablas
- Triggers para auto-actualización
- Validaciones de precisión céntimos
- Índices optimizados
- Función para generar calendario fiscal

---

## 🔜 Próximos Pasos

### Pendientes de Implementación

🔄 **Facturas:**
- Generación automática
- Numeración secuencial
- Generación de PDF
- Envío por email

🔄 **OCR:**
- Integración de Tesseract.js
- Extracción automática de datos de facturas
- Procesamiento asíncrono

🔄 **Dashboard:**
- Resumen financiero
- Balance real
- Gráficos de ingresos/gastos

🔄 **Frontend:**
- Aplicación Next.js 14
- Dashboard interactivo
- Formularios de gastos/facturas
- Subida de archivos con OCR

🔄 **Modelos AEAT:**
- Generación de Modelo 303
- Generación de Modelo 130
- Libros oficiales (Ingresos, Gastos, Bienes)

---

## 🐛 Troubleshooting

### Error: "Database connection failed"

**Solución:**
1. Verifica que PostgreSQL esté corriendo:
   ```bash
   # En Mac
   brew services list | grep postgresql

   # En Linux
   sudo systemctl status postgresql
   ```

2. Verifica las credenciales en `.env`

3. Verifica que la base de datos existe:
   ```bash
   psql -U postgres -l | grep migestor
   ```

### Error: "Port 3000 is already in use"

**Solución:**
```bash
# Encuentra el proceso usando el puerto
lsof -i :3000

# Mata el proceso
kill -9 <PID>

# O cambia el puerto en .env
PORT=3001
```

### Error: "Module not found"

**Solución:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Error de TypeScript

**Solución:**
```bash
cd backend
npm run build  # Compila y muestra errores específicos
```

---

## 📚 Recursos Adicionales

- **Documentación API:** Ver `API_ROUTES.md`
- **Esquema BD:** Ver `DATABASE_SCHEMA.md`
- **Readme:** Ver `README.md`

---

## 💡 Consejos

1. **Usa variables de entorno:** Nunca commites el archivo `.env` a Git

2. **Prueba con Postman/Insomnia:** Importa las rutas desde `API_ROUTES.md`

3. **Revisa los logs:** El backend muestra todas las queries SQL en modo development

4. **Backup de DB:** Haz backups regulares:
   ```bash
   pg_dump -U postgres migestor > backup_$(date +%Y%m%d).sql
   ```

---

¡Todo listo! Si tienes problemas, revisa los logs del backend con `npm run dev` y verifica que PostgreSQL esté corriendo correctamente.

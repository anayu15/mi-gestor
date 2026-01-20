# 🧾 miGestor

**Gestor fiscal inteligente para autónomos TRADE en España**

Sistema completo de gestión fiscal diseñado específicamente para freelancers bajo el régimen TRADE (Trabajador Autónomo Económicamente Dependiente) que alquilan local y facturan a un cliente principal.

---

## 🎯 Características Principales

### 1. **Gestor de Activos Independientes**
- Inventario de equipamiento (ordenadores, mobiliario, etc.)
- Cálculo automático de amortizaciones
- **Alertas de Cumplimiento TRADE:** Verifica que gastos mensuales obligatorios (alquiler, electricidad, internet) estén a tu nombre

### 2. **Tracker de Gastos con OCR Inteligente**
- **OCR Especializado:** Extrae automáticamente datos de facturas de alquiler
  - Base Imponible, IVA 21%, IRPF 19%
  - Ejemplo: `785.12€ base + 164.88€ IVA - 149.17€ IRPF = 800.83€ total`
- **Sistema de Alertas de Riesgo:** Marca gastos sospechosos (ej: comidas en fin de semana)
- Categorización inteligente según normativa AEAT

### 3. **Generador de Facturas TRADE**
- Creación automática de facturas mensuales
- Campos obligatorios: IVA 21% + IRPF 7% (tarifa nuevos autónomos)
- **Precisión céntimos:** Validaciones en base de datos para evitar discrepancias con AEAT
- Generación de PDF profesional
- Envío por email a clientes

### 4. **Dashboard "Balance Real"**
```
Balance Bancario:        15.000€
- IVA pendiente pagar:    2.500€
- Brecha IRPF (14%):      1.680€
- Seg. Social pendiente:    310€
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BALANCE REAL:           10.510€
```

**Cálculo Brecha IRPF:**
- Actualmente te retienen **7%** (nuevos autónomos)
- Tu tipo impositivo real será **~21%** (con 32k€ beneficio)
- Diferencia: **14%** que deberás pagar en la Renta anual

### 5. **Libros Contables Oficiales AEAT**
Generación automática y en tiempo real de:
- **Libro de Ingresos**
- **Libro de Gastos**
- **Libro de Bienes de Inversión**

Formatos: PDF, Excel, CSV

### 6. **Calendario Fiscal + Guías de Casillas**
- Notificaciones push para Modelos 115, 303, 390, 180
- **"Fill-in Guide":** Te dice exactamente qué valor va en qué casilla de la web de AEAT

Ejemplo Modelo 303 (IVA):
```
Casilla 01: Base imponible 21% → 9.000,00€
Casilla 03: Cuota IVA repercutido → 1.890,00€
Casilla 28: Base IVA soportado → 3.000,00€
Casilla 29: Cuota IVA deducible → 630,00€
Casilla 46: RESULTADO → 1.260,00€ (A INGRESAR)
```

### 7. **Simulador de Escenarios**
Calcula reducción de riesgo TRADE al agregar un segundo cliente:

```
Situación Actual:
  - Cliente A: 36.000€/año (100% dependencia)
  - Riesgo TRADE: 85/100 ⚠️ ALTO

Escenario Simulado:
  - Cliente A: 30.000€/año
  - Cliente B: 6.000€/año (nuevo)
  - Dependencia: 83.33% ⚠️ (aún sobre 75%)
  - Riesgo TRADE: 70/100 (mejora -15 puntos)

Recomendación:
  Necesitas facturar 9.000€/año a Cliente B
  para bajar del 75% → Cumplimiento TRADE ✅
```

---

## 🏗️ Stack Tecnológico

### Backend
- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** (base de datos relacional con ACID compliance)
- **Prisma** o **TypeORM** (ORM para migraciones y queries)
- **JWT** para autenticación
- **Tesseract.js** para OCR de facturas

### Frontend
- **Next.js 14+** (App Router)
- **React** + **TypeScript**
- **Tailwind CSS** para estilos
- **Shadcn/ui** para componentes
- **Recharts** para gráficos financieros
- **React Query** para gestión de estado servidor

### DevOps
- **Docker** + **Docker Compose**
- **PostgreSQL** en contenedor
- **Nginx** como reverse proxy

---

## 📁 Estructura del Proyecto

```
mi-gestor/
├── backend/                 # API Express + TypeScript
│   ├── src/
│   │   ├── controllers/     # Lógica de negocio
│   │   ├── routes/          # Definición de endpoints
│   │   ├── models/          # Modelos de base de datos
│   │   ├── services/        # Servicios (OCR, PDF, email)
│   │   ├── middleware/      # Auth, validación, errores
│   │   ├── utils/           # Helpers (cálculos fiscales)
│   │   └── config/          # Configuración (DB, JWT)
│   ├── migrations/          # Migraciones de DB
│   ├── tests/               # Tests unitarios y de integración
│   └── package.json
│
├── frontend/                # Next.js 14+ App Router
│   ├── app/                 # App Router
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── gastos/          # Gestión de gastos
│   │   ├── facturas/        # Generación de facturas
│   │   ├── activos/         # Bienes de inversión
│   │   ├── calendario/      # Calendario fiscal
│   │   └── simulador/       # Simulador de escenarios
│   ├── components/          # Componentes reutilizables
│   ├── lib/                 # Utilidades frontend
│   ├── public/              # Assets estáticos
│   └── package.json
│
├── database/
│   ├── schema.sql           # Schema PostgreSQL
│   └── seeds/               # Datos de prueba
│
├── docker-compose.yml       # Orquestación de servicios
├── DATABASE_SCHEMA.md       # Documentación esquema DB
├── API_ROUTES.md            # Documentación API
└── README.md                # Este archivo
```

---

## 🚀 Instalación y Configuración

### Requisitos Previos
- **Node.js** 18+ y **npm**
- **PostgreSQL** 15+
- **Docker** y **Docker Compose** (recomendado)

### 1. Clonar y configurar

```bash
# Clonar repositorio
git clone https://github.com/tuusuario/mi-gestor.git
cd mi-gestor

# Instalar dependencias backend
cd backend
npm install

# Instalar dependencias frontend
cd ../frontend
npm install
```

### 2. Configurar variables de entorno

**Backend (`backend/.env`):**
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/migestor

# JWT
JWT_SECRET=tu-secret-key-super-segura-cambiala
JWT_EXPIRES_IN=7d

# OCR
TESSERACT_LANG=spa

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-password-app

# Uploads
UPLOAD_DIR=/tmp/uploads
MAX_FILE_SIZE=10485760  # 10MB
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. Iniciar con Docker Compose (Recomendado)

```bash
# Levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Acceder:
# - Frontend: http://localhost:3001
# - Backend API: http://localhost:3000/api
# - PostgreSQL: localhost:5432
```

### 4. Iniciar servidores (Desarrollo)

**Opción 1: Inicio automático (Recomendado)**
```bash
# Desde el directorio raíz - inicia backend y frontend simultáneamente
npm run dev

# Servicios disponibles:
# - Backend:  http://localhost:3000
# - Frontend: http://localhost:3001
# - API Docs: http://localhost:3000/api
# - Health:   http://localhost:3000/health
```

**Opción 2: Inicio manual (terminales separadas)**
```bash
# Terminal 1: PostgreSQL
# (Asegúrate de tener PostgreSQL corriendo)

# Terminal 2: Backend
cd backend
npm run dev  # Puerto 3000

# Terminal 3: Frontend
cd frontend
npm run dev  # Puerto 3001
```

### 5. Configurar base de datos

```bash
cd backend

# Ejecutar migraciones
npm run migrate

# Seed con datos de ejemplo (opcional)
npm run seed
```

---

## 📊 Cálculos Fiscales Clave

### IVA (Modelo 303 Trimestral)

```typescript
// IVA Repercutido (facturas emitidas)
const ivaRepercutido = facturasEmitidas.reduce((sum, f) =>
  sum + (f.base_imponible * f.tipo_iva / 100), 0
);

// IVA Soportado (gastos deducibles)
const ivaSoportado = gastos.reduce((sum, g) =>
  sum + (g.base_imponible * g.tipo_iva / 100), 0
);

// Resultado
const resultadoIVA = ivaRepercutido - ivaSoportado;
// > 0: A PAGAR | < 0: A COMPENSAR
```

### IRPF (Modelo 130 Trimestral)

```typescript
// Rendimiento neto
const rendimientoNeto = ingresosTotales - gastosDeducibles;

// Pago fraccionado (20% del rendimiento)
const pagoFraccionado = rendimientoNeto * 0.20;

// Menos retenciones ya practicadas
const retencionesCliente = facturasEmitidas.reduce((sum, f) =>
  sum + f.cuota_irpf, 0
);

// Resultado
const aIngresar = pagoFraccionado - retencionesCliente;
```

### Brecha IRPF

```typescript
// Tipo retenido actualmente (7% nuevos autónomos)
const irpfRetenido = beneficioNeto * 0.07;

// Tipo estimado final (tramos de Renta)
const tipoEstimado = calcularTramoIRPF(beneficioNeto); // ~21% para 32k€

// Brecha = Diferencia que pagarás en Renta anual
const brechaIRPF = (beneficioNeto * tipoEstimado / 100) - irpfRetenido;
```

### Balance Real

```typescript
const balanceReal = saldoBancario
  - ivaRepercutidoPendienteIngresar
  - brechaIRPF
  - seguridadSocialPendiente;
```

---

## 🔐 Seguridad

- **Autenticación:** JWT con expiración 7 días
- **Passwords:** Hashing con bcrypt (salt rounds: 12)
- **Validación:** Zod para validación de schemas
- **Rate Limiting:** 100 req/min general, 10 req/min OCR
- **CORS:** Configurado para dominio específico en producción
- **SQL Injection:** Protección vía ORM (Prisma/TypeORM)
- **XSS:** Sanitización de inputs con validator.js

---

## 📖 Documentación Adicional

- **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Esquema completo de PostgreSQL con triggers y funciones
- **[API_ROUTES.md](./API_ROUTES.md)** - Documentación completa de endpoints REST

---

## 🧪 Testing

```bash
# Backend
cd backend
npm test                    # Tests unitarios
npm run test:integration    # Tests de integración
npm run test:coverage       # Coverage report

# Frontend
cd frontend
npm test                    # Tests con Jest
npm run test:e2e            # Tests E2E con Playwright
```

---

## 📝 Roadmap

### Fase 1: Core Features ✅
- [x] Database schema
- [x] API routes design
- [ ] Authentication system
- [ ] Expense tracking + OCR
- [ ] Invoice generation
- [ ] Dashboard básico

### Fase 2: Tax Compliance 🚧
- [ ] Modelo 303 (IVA)
- [ ] Modelo 130 (IRPF)
- [ ] Generación de libros oficiales
- [ ] Alertas de cumplimiento TRADE
- [ ] Calendario fiscal

### Fase 3: Advanced Features 📅
- [ ] Simulador de escenarios
- [ ] Notificaciones push
- [ ] Integración bancaria (Open Banking)
- [ ] Exportación contabilidad para gestoría
- [ ] Mobile app (React Native)

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🙋‍♂️ Soporte

Para dudas o problemas:
- **Issues:** [GitHub Issues](https://github.com/tuusuario/mi-gestor/issues)
- **Email:** soporte@migestor.es
- **Documentación:** [docs.migestor.es](https://docs.migestor.es)

---

## ⚠️ Disclaimer Legal

**miGestor** es una herramienta de gestión fiscal para autónomos. La información fiscal aquí presentada es orientativa y no constituye asesoramiento fiscal profesional. Consulta siempre con un gestor o asesor fiscal certificado para tu situación específica.

---

**Hecho con ❤️ para la comunidad de autónomos españoles**

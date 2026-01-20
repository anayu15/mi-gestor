# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**miGestor** is a complete tax management system for Spanish self-employed workers (autónomos) under the TRADE regime. It handles invoice generation, expense tracking with OCR, tax calculations (IVA, IRPF), official AEAT book generation, and TRADE compliance monitoring.

**Stack:**
- Backend: Node.js + Express + TypeScript + PostgreSQL
- Frontend: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- Database: PostgreSQL 15+ with direct SQL queries (no ORM)
- Authentication: JWT tokens

## Development Commands

### Running the Application

**RECOMMENDED: Start both servers simultaneously (from project root)**
```bash
npm run dev              # Start both backend + frontend with colored output
                         # Backend (cyan):  http://localhost:3000
                         # Frontend (magenta): http://localhost:3001
                         # Press Ctrl+C to stop both servers

./start-dev.sh           # Alternative: startup script with dependency checks
```

**Individual server commands:**
```bash
npm run dev:backend      # Start only backend (from root)
npm run dev:frontend     # Start only frontend (from root)
```

### Backend (from `/backend` directory)
```bash
npm run dev              # Start dev server with hot reload (port 3000)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled production server
npm test                 # Run Jest tests
npm run lint             # ESLint
npm run lint:fix         # Auto-fix ESLint issues
```

### Frontend (from `/frontend` directory)
```bash
npm run dev              # Start Next.js dev server (port 3001)
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Next.js linting
```

### Database Migrations
```bash
# From /backend directory
npm run migrate:preferences   # User preferences table
npm run migrate:modelo115     # Modelo 115 & tarifa plana
npm run migrate:recurring     # Recurring invoices
npm run migrate:ocr           # OCR fields
```

### End-to-End Testing
```bash
# From root directory (has Playwright installed)
npx playwright test test-app-full.spec.ts        # Full flow test
npx playwright test test-fiscal.spec.ts          # Fiscal calculations
npx playwright test company-settings-and-pdf.spec.ts  # Company setup & PDFs
```

## Architecture

### Backend Structure

```
backend/src/
├── app.ts                 # Express app setup, middleware registration
├── server.ts              # Entry point, starts HTTP server & cron jobs
├── config/
│   ├── index.ts          # Central config from environment variables
│   └── database.ts       # PostgreSQL pool, query() helper
├── middleware/
│   ├── auth.ts           # authenticate() & optionalAuth() JWT middleware
│   ├── errorHandler.ts   # Global error handler, custom AppError classes
│   ├── upload.ts         # Multer file upload (10MB limit, organized by user/year)
│   └── validate.ts       # Zod schema validation middleware
├── controllers/          # HTTP request handlers (call DB directly, no service layer)
├── routes/               # Express route definitions with validation schemas
├── services/             # Complex business logic only:
│   ├── pdf.service.ts              # PDFKit invoice generation
│   ├── visionOCR.service.ts        # Multi-provider OCR (Claude/OpenAI/OpenRouter)
│   └── recurring-generation.service.ts  # Recurring invoice automation
├── jobs/
│   └── recurring-invoices.job.ts   # Cron job (daily 2am) for auto-invoicing
├── utils/
│   ├── taxCalculations.ts    # Spanish tax math (IVA, IRPF, Modelo 303/130/115)
│   ├── date-calculator.ts    # Fiscal quarters, periods
│   └── validators.ts         # NIF/CIF validation
└── types/                # TypeScript interfaces
```

**Key Pattern:** Controllers query database directly using `query()` from `config/database.ts`. No ORM—raw SQL with parameterized queries (`$1, $2, ...`).

### Frontend Structure

```
frontend/
├── app/                  # Next.js App Router
│   ├── dashboard/        # Main dashboard with Balance Real
│   ├── gastos/           # Expense management with OCR upload
│   ├── facturas/         # Invoice generation & listing
│   ├── clientes/         # Client management
│   ├── fiscal/           # Tax models (303, 130, 115, 180, 390)
│   ├── documentos/       # Document viewer/manager
│   ├── settings/         # Company settings & logo upload
│   └── tesoreria/        # Treasury/cash flow
├── components/           # Reusable UI components
├── lib/
│   └── api.ts           # **Central API client** - import all API functions from here
└── hooks/               # Custom React hooks
```

**API Client Pattern:** All backend calls go through `lib/api.ts`. Example:
```typescript
import { expenses, invoices, auth } from '@/lib/api';

// Usage
const expenseList = await expenses.list({ year: 2024 });
const invoice = await invoices.generate({ client_id, base_imponible: 3000, ... });
```

### Database

**Connection:** PostgreSQL pool in `backend/src/config/database.ts`
- Max 20 connections
- Query helper: `query(sql, params)` with logging

**Schema:** See `DATABASE_SCHEMA.md` for full details. Key tables:
- `users` - Autónomo profiles with TRADE configuration
- `clients` - Customers (one marked as `es_cliente_principal`)
- `facturas_emitidas` - Generated invoices
- `gastos` - Expenses with risk assessment
- `documentos` - File attachments
- `recurring_invoice_templates` - Auto-invoice rules
- `fiscal_calendar` - Tax deadline tracking
- `company_settings` - Company branding/details
- `modelo_115_*` / `tarifa_plana_*` - TRADE-specific tax tables

**Migrations:** SQL files in `database/migrations/` run via npm scripts.

## Authentication Flow

1. **Register/Login:** Returns JWT token (7-day expiration by default)
2. **Token Storage:** Frontend stores in `localStorage.getItem('token')`
3. **API Calls:** Token sent as `Authorization: Bearer <token>` header
4. **Middleware:** `authenticate()` in `backend/src/middleware/auth.ts` verifies token
5. **Optional Auth:** Some routes use `optionalAuth()` for public/semi-public access (e.g., shared documents)

**Special Case:** Iframe/image embedding supports `?token=<token>` query parameter for auth.

## File Uploads & OCR

### Upload Configuration
- **Location:** `uploads/documents/{userId}/{year}/`
- **Naming:** `{randomHash}_{timestamp}.{ext}`
- **Max Size:** 10MB (configurable in `config/index.ts`)
- **Allowed Types:** JPEG, PNG, PDF
- **Validation:** MIME type + magic bytes verification

### OCR Process
**Service:** `backend/src/services/visionOCR.service.ts`

**Providers (configurable):**
- Primary: Claude Vision API (Anthropic)
- Fallback: OpenAI GPT-4 Vision
- Alternative: OpenRouter

**Extraction Flow:**
1. File uploaded via `/api/expenses/extract-from-invoice` (multipart/form-data)
2. Image converted to base64
3. Sent to Vision API with Spanish invoice extraction prompt
4. Response parsed for: `proveedor_nombre`, `proveedor_cif`, `fecha_emision`, `base_imponible`, `tipo_iva`, `tipo_irpf`, `concepto`, `categoria`
5. Confidence score calculated (< 80% flags `requiresReview: true`)
6. Frontend pre-fills expense form with extracted data

**Categories Auto-Detected:**
Alquiler, Suministros, Telecomunicaciones, Material de oficina, Software y licencias, Formación, Transporte, Comidas, Publicidad, Servicios profesionales, Seguros, Otros gastos

## PDF Generation

**Library:** PDFKit
**Service:** `backend/src/services/pdf.service.ts`

**Process:**
1. Fetch complete invoice data + company settings from DB
2. Create `PDFDocument` instance
3. Layout header with company logo (if exists)
4. Add invoice metadata (number, dates, client info)
5. Draw line items table
6. Calculate totals: `Base + IVA - IRPF = Total`
7. Add payment terms, bank details
8. Stream to file: `uploads/invoices/{userId}/{year}/{invoiceId}.pdf`
9. Store relative path in `facturas_emitidas.pdf_ruta`

**Regeneration:** `POST /api/invoices/:id/regenerate-pdf` if data changes.

## Spanish Tax Calculations

**Utility:** `backend/src/utils/taxCalculations.ts`

### Key Functions

**Invoice Totals:**
```typescript
calcularCuotaIVA(base, tipoIva) // Base * IVA% (rounded to cents)
calcularCuotaIRPF(base, tipoIrpf) // Base * IRPF%
calcularTotalFactura(base, iva, irpf) // Base + IVA - IRPF
```

**Tax Models:**
```typescript
calcularModelo303(trimestre, año) // IVA quarterly: Repercutido - Soportado
calcularModelo130(trimestre, año) // IRPF estimated: 20% of net income - retentions
calcularModelo115(mes, año)       // TRADE rent withholding
calcularModelo390(año)            // Annual VAT summary
```

**TRADE Compliance:**
```typescript
esGastoIndependencia(categoria) // Check if expense counts toward TRADE 75% rule
calcularNivelRiesgoGasto(gasto) // Risk score: BAJO/MEDIO/ALTO
```

**Validation:**
```typescript
validarNIF(nif)  // Spanish personal tax ID (8 digits + letter)
validarCIF(cif)  // Spanish company tax ID (letter + 7 digits + letter/digit)
```

**Date Helpers:** `backend/src/utils/date-calculator.ts`
- `getPeriodoTrimestral(trimestre, año)` - Returns `{ inicio, fin }`
- `calcularProximoVencimiento(mes, año)` - Next invoice due date

## Recurring Invoices

**Cron Job:** `backend/src/jobs/recurring-invoices.job.ts`
- **Schedule:** Daily at 2:00 AM (Europe/Madrid)
- **Cron Expression:** `'0 2 * * *'`

**Process:**
1. Find active templates due for generation (`recurring_invoice_templates`)
2. Generate invoice from template (clone structure)
3. Auto-increment invoice number
4. Calculate billing period if configured
5. Generate PDF
6. Update template's `ultima_generacion` date
7. Log success/failure

**Service:** `backend/src/services/recurring-generation.service.ts`

**Frequencies:** Monthly, Quarterly, Annual, Custom

**Manual Trigger:** `RecurringInvoicesJob.runNow()` for testing.

## Error Handling

**Pattern:** Centralized error handling via `middleware/errorHandler.ts`

**Custom Error Classes:**
```typescript
BadRequestError(message, details?)   // 400
UnauthorizedError(message?)           // 401
NotFoundError(resource)               // 404
ConflictError(message, details?)      // 409
ValidationError(message, details?)    // 400
InternalError(message?)               // 500
```

**Usage in Controllers:**
```typescript
if (!invoice) {
  throw new NotFoundError('Factura no encontrada');
}
```

**Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Factura no encontrada",
    "details": {}
  }
}
```

## Input Validation

**Library:** Zod (v3.22.4)

**Pattern:**
```typescript
// In route file
const createExpenseSchema = z.object({
  body: z.object({
    concepto: z.string().min(1, 'Concepto requerido'),
    base_imponible: z.number().positive(),
    tipo_iva: z.number().min(0).max(100),
  }),
});

router.post('/expenses', validate(createExpenseSchema), createExpense);
```

**Validation Errors:** Return 400 with field-level error details.

## Testing

### Backend Tests
```bash
cd backend
npm test                 # Unit tests
npm run test:coverage    # Coverage report
```

### E2E Tests (Playwright)
**Location:** Root directory test files (`test-*.spec.ts`)

**Key Test Files:**
- `test-app-full.spec.ts` - Complete user flow (register → create client → expense → invoice → dashboard)
- `test-fiscal.spec.ts` - Tax calculation verification (303, 130, 115)
- `company-settings-and-pdf.spec.ts` - Company setup, logo upload, PDF generation
- `test-recurring-templates.ts` - Recurring invoice automation

**Run E2E:**
```bash
npx playwright test --headed   # Watch tests run
npx playwright test test-fiscal.spec.ts  # Single file
```

## Important Business Rules

### TRADE Compliance
- **Dependency Threshold:** Must maintain < 75% revenue from single client
- **Required Expenses:** Monthly rent, electricity, internet (must be in autónomo's name)
- **Risk Assessment:** Expenses flagged ALTO if suspicious (e.g., weekend restaurant bills)

### Invoice Numbering
- **Format:** `{year}-{sequential}` (e.g., `2024-001`)
- **Series:** Optional prefix (A, B, C for different clients)
- **Uniqueness:** Enforced by DB constraint on `(user_id, numero_factura)`

### Tax Rates (Spanish Defaults)
- **IVA General:** 21%
- **IRPF New Autónomos:** 7% (first 2 years)
- **IRPF Standard:** 15%
- **Modelo 130:** 20% of net income per quarter

### Fiscal Calendar
- **Quarters:** Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
- **Deadlines:** Typically 20th of month following quarter end
- **Modelo 303/130:** Quarterly
- **Modelo 115:** Monthly (if applicable)
- **Modelo 390:** Annual (by Jan 30)

## Configuration

**Backend `.env` (required):**
```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=migestor
DB_USER=migestor_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# OCR
VISION_PROVIDER=anthropic    # or openai, openrouter
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...        # fallback

# Uploads
UPLOAD_DIR=/path/to/uploads
MAX_FILE_SIZE=10485760       # 10MB

# CORS
CORS_ORIGIN=http://localhost:3001
```

**Frontend `.env.local` (required):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

**Root `package.json` (concurrent server setup):**
```json
{
  "name": "mi-gestor",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently -n backend,frontend -c cyan,magenta \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "start": "concurrently -n backend,frontend -c cyan,magenta \"npm run start:backend\" \"npm run start:frontend\"",
    "start:backend": "cd backend && npm start",
    "start:frontend": "cd frontend && npm start"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "concurrently": "^8.2.2"
  }
}
```

**Helper Scripts:**
- `start-dev.sh` - Startup script with dependency checks (executable)

## Common Development Patterns

### Starting a Development Session

**Quick Start (Single Command):**
```bash
# From project root - starts both backend and frontend
npm run dev

# Output shows both servers with colored labels:
# [backend]  Server running at: http://localhost:3000
# [frontend] Ready in 2.5s at: http://localhost:3001

# Both servers have hot-reload enabled:
# - Backend: Nodemon watches .ts files and auto-restarts
# - Frontend: Next.js watches .tsx files and auto-refreshes browser

# Stop both servers: Press Ctrl+C
```

**Development Workflow:**
1. Start servers: `npm run dev`
2. Open browser: http://localhost:3001
3. Make code changes (auto-reload handles the rest)
4. API endpoints available at: http://localhost:3000/api
5. Health check: http://localhost:3000/health

### Adding a New API Endpoint

1. **Define Route** in `backend/src/routes/{module}.routes.ts`:
```typescript
import { validate } from '../middleware/validate';
import { z } from 'zod';

const mySchema = z.object({
  body: z.object({
    field: z.string().min(1),
  }),
});

router.post('/my-endpoint', authenticate, validate(mySchema), myController);
```

2. **Create Controller** in `backend/src/controllers/{module}.controller.ts`:
```typescript
import { Request, Response } from 'express';
import { query } from '../config/database';
import { BadRequestError } from '../middleware/errorHandler';

export const myController = async (req: Request, res: Response) => {
  const userId = (req as any).user.id; // From authenticate middleware
  const { field } = req.body;

  // Query DB directly
  const result = await query(
    'SELECT * FROM my_table WHERE user_id = $1 AND field = $2',
    [userId, field]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Resource not found');
  }

  res.json({ success: true, data: result.rows[0] });
};
```

3. **Add Frontend API Function** in `frontend/lib/api.ts`:
```typescript
export const myModule = {
  myAction: async (field: string) => {
    return api('/my-endpoint', {
      method: 'POST',
      body: JSON.stringify({ field }),
    });
  },
};
```

### Database Query Pattern

**Always use parameterized queries:**
```typescript
// ✅ Correct (prevents SQL injection)
const result = await query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ Wrong (vulnerable to injection)
const result = await query(`SELECT * FROM users WHERE email = '${email}'`);
```

**Transactions:**
```typescript
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO table1 VALUES ($1)', [val1]);
  await client.query('UPDATE table2 SET field = $1', [val2]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### File Upload (Frontend)

**Don't use JSON for file uploads:**
```typescript
// ✅ Correct
const formData = new FormData();
formData.append('invoice', file);

const response = await fetch(`${API_URL}/expenses/extract-from-invoice`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    // NO Content-Type header - browser sets it with boundary
  },
  body: formData,
});
```

## Troubleshooting

### "Token de autenticación no proporcionado"
- Check `Authorization: Bearer <token>` header is sent
- Verify token exists in localStorage

### "Usuario no autenticado" / "Token inválido"
- Token expired (7-day default)
- JWT secret changed - register new user

### Database Connection Errors
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Check max connections not exceeded

### OCR Failures
- Verify API key is set: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- Check image quality (OCR works best with clear, high-res scans)
- Review `requiresReview` flag for low-confidence extractions

### PDF Generation Fails
- Ensure company settings exist (`company_settings` table)
- Check upload directory is writable
- Verify invoice has all required fields

### Server Startup Issues
- **Port already in use (EADDRINUSE):**
  ```bash
  # Kill processes on ports 3000 and 3001
  lsof -ti:3000 | xargs kill -9
  lsof -ti:3001 | xargs kill -9
  ```
- **Servers won't start:**
  - Verify PostgreSQL is running: `pg_isready`
  - Check all dependencies installed: `npm install` in root, backend, and frontend
  - Ensure `.env` exists in backend directory
  - Check backend `.env` has correct database credentials
  - Frontend `.env.local` should have `NEXT_PUBLIC_API_URL=http://localhost:3000/api`
- **Only one server starts (using `npm run dev`):**
  - Check `concurrently` package is installed in root: `npm install`
  - Verify individual commands work: `npm run dev:backend` and `npm run dev:frontend`

## Key Documentation Files

- `README.md` - Project overview & setup instructions
- `QUICK_START.md` - 5-minute quickstart guide
- `DATABASE_SCHEMA.md` - Full PostgreSQL schema with table descriptions
- `API_ROUTES.md` - Complete API endpoint reference
- `TESTING_GUIDE.md` - curl examples for all endpoints
- `FISCALIDAD_AUTONOMOS_2026.md` - Spanish tax rules for 2026
- `TARIFA_PLANA_2026.md` - Flat-rate contribution details

## Skills Available

This project has custom skills configured:

- `/reboot` - Restarts both frontend and backend servers for mi-gestor project. Kills processes on ports 3000 and 3001, then starts fresh development servers.
- `/test-credentials` - Provides test user credentials for the mi-gestor project. Use when you need to log in, run tests with authentication, test the login flow, or access the application with test users.

Invoke with: `/reboot` or `/test-credentials`

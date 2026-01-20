# Quick Start Guide - miGestor

Get your TRADE freelancer tax management application running in 5 minutes.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ installed and running
- One terminal window (two if running manually)

---

## Step 1: Database Setup

### Create Database
```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE migestor;
CREATE USER migestor_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE migestor TO migestor_user;
\q
```

### Run Migrations
```bash
cd /Users/anayusta/workspace/mi-gestor/backend
psql -U migestor_user -d migestor -f database/schema.sql
```

---

## Step 2: Configure Backend

```bash
cd /Users/anayusta/workspace/mi-gestor/backend

# Create .env file (if not exists)
cat > .env << EOF
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=migestor
DB_USER=migestor_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001
EOF

# Install dependencies (if not already installed)
npm install
```

---

## Step 3: Start Both Servers

### Option 1: Automatic (Recommended)

```bash
# From project root - starts both backend and frontend
cd /Users/anayusta/workspace/mi-gestor
npm run dev
```

**Expected Output:**
```
[backend] Server running on port 3000
[backend] Database connected successfully
[frontend] ▲ Next.js 14.2.35
[frontend] - Local: http://localhost:3001
[frontend] ✓ Ready in 2.5s
```

Both servers are now running:
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

### Option 2: Manual (Separate Terminals)

**Terminal 1 - Backend**
```bash
cd /Users/anayusta/workspace/mi-gestor/backend
npm run dev
```

**Terminal 2 - Frontend**
```bash
cd /Users/anayusta/workspace/mi-gestor/frontend
npm run dev
```

---

## Step 4: First Use

### Open Browser
Navigate to: `http://localhost:3001`

### Create Your Account
1. You'll be redirected to `/login`
2. Click **"Regístrate"** (Register)
3. Fill in the form:
   ```
   Nombre Comercial: Tu Nombre
   Email: tu@email.com
   NIF: 12345678A
   Actividad Económica: Desarrollo de software
   [✓] Soy autónomo TRADE (if you bill >75% to one client)
   Contraseña: ********
   ```
4. Click **"Registrarse"**

### You're In!
You'll be automatically logged in and see the Dashboard.

---

## Step 5: Initial Setup (First Time)

### 1. Create Your Principal Client
1. Click **"Clientes"** in navigation
2. Click **"+ Nuevo Cliente"**
3. Fill in client details
4. ✓ Check **"Marcar como cliente principal"** (if TRADE)
5. Click **"Crear Cliente"**

### 2. Add an Expense (Optional)
1. Click **"Gastos"** → **"Nuevo Gasto"**
2. Example: Monthly rent
   ```
   Concepto: Alquiler oficina enero 2025
   Categoría: Alquiler
   Proveedor: Nombre del propietario
   Base Imponible: 500.00
   IVA: 21%
   IRPF: 19%
   ```
3. Click **"Guardar Gasto"**
4. See the warning if it's an independence expense

### 3. Generate an Invoice
1. Click **"Facturas"** → **"Nueva Factura"**
2. Select your client
3. Fill in:
   ```
   Concepto: Servicios de desarrollo - Enero 2025
   Base Imponible: 3000.00
   IVA: 21% (auto-calculated: 630.00€)
   IRPF: 7% (auto-calculated: -210.00€)
   Total a Cobrar: 3,420.00€
   ```
4. Click **"Generar Factura"**
5. You'll see the invoice number (e.g., 2025-001)

### 4. Check Your Taxes
1. Click **"Modelo 303"** (VAT)
   - See IVA to pay this quarter
   - AEAT form field mapping
2. Click **"Modelo 130"** (IRPF)
   - See IRPF prepayment calculation

---

## Troubleshooting

### Backend Won't Start
- **Check PostgreSQL is running:**
  ```bash
  pg_isready
  ```
- **Check database credentials in `.env`**
- **Check port 3000 is not in use:**
  ```bash
  lsof -i :3000
  ```

### Frontend Won't Connect
- **Verify backend is running** at `http://localhost:3000`
- **Check `.env.local` has correct API URL:**
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3000/api
  ```
- **Clear browser localStorage** (if login issues persist)

### Database Errors
- **Re-run migrations:**
  ```bash
  psql -U migestor_user -d migestor -f database/schema.sql
  ```
- **Check database exists:**
  ```bash
  psql -U migestor_user -d migestor -c "\dt"
  ```

---

## API Endpoints (for Testing)

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_comercial": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "nif": "12345678A",
    "es_trade": true,
    "actividad_economica": "Software development"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## Development Tips

### Hot Reload
Both backend and frontend have hot reload enabled:
- **Backend:** Changes to `.ts` files auto-restart via nodemon
- **Frontend:** Changes to `.tsx` files auto-refresh browser

### View Logs
- **Backend:** Terminal 1 shows API requests and database queries
- **Frontend:** Terminal 2 shows Next.js build and page loads

### Database Inspection
```bash
psql -U migestor_user -d migestor

# View users
SELECT * FROM usuarios;

# View invoices
SELECT * FROM facturas_emitidas;

# View expenses
SELECT * FROM gastos;
```

---

## Production Deployment (Future)

### Backend
- Set `NODE_ENV=production`
- Use proper database credentials
- Enable SSL/TLS
- Set up process manager (PM2)
- Configure reverse proxy (nginx)

### Frontend
```bash
npm run build
npm start
```
- Deploy to Vercel, Netlify, or your own server
- Set `NEXT_PUBLIC_API_URL` to production backend URL

---

## Summary

**You're now running a complete TRADE freelancer management system!**

✅ Backend API running on port 3000
✅ Frontend UI running on port 3001
✅ PostgreSQL database configured
✅ All features working end-to-end

**Next steps:**
1. Create your first invoice
2. Add your monthly expenses
3. Check Modelo 303 and 130 before deadlines
4. Monitor your Balance Real

**Need help?** Refer to:
- `FRONTEND_COMPLETED.md` - Frontend documentation
- `API_ROUTES.md` - API endpoint reference
- `TESTING_GUIDE.md` - curl examples for all endpoints
- `DATABASE_SCHEMA.md` - Database structure

---

**Enjoy managing your Spanish freelance taxes! 🎉**

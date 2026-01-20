# 🎨 miGestor - Frontend Implementation Plan

**Status:** Backend 100% complete ✅ | Frontend ready to build

---

## 🎯 Objetivo

Construir un frontend mínimo pero funcional con Next.js 14 que permita:
1. Login/Register
2. Dashboard con Balance Real
3. Crear gastos
4. Generar facturas
5. Ver Modelo 303 y 130

---

## 📦 Stack Frontend

```
✅ Next.js 14 (App Router)
✅ TypeScript
✅ Tailwind CSS
✅ Recharts (gráficos)
✅ date-fns (fechas)
✅ lucide-react (iconos)
```

**Archivos de configuración creados:**
- ✅ package.json
- ✅ tsconfig.json
- ✅ next.config.js
- ✅ tailwind.config.ts
- ✅ postcss.config.js
- ✅ globals.css

---

## 🏗️ Estructura de Páginas

```
app/
├── layout.tsx                  # Layout principal con navegación
├── globals.css                 # ✅ Creado
├── page.tsx                    # Landing page (redirect a /dashboard)
│
├── login/
│   └── page.tsx               # Formulario de login
│
├── register/
│   └── page.tsx               # Formulario de registro
│
├── dashboard/
│   └── page.tsx               # Dashboard con Balance Real
│
├── gastos/
│   ├── page.tsx               # Lista de gastos
│   └── nuevo/
│       └── page.tsx           # Crear gasto
│
├── facturas/
│   ├── page.tsx               # Lista de facturas
│   └── nueva/
│       └── page.tsx           # Generar factura
│
├── clientes/
│   ├── page.tsx               # Lista de clientes
│   └── nuevo/
│       └── page.tsx           # Crear cliente
│
└── fiscal/
    ├── modelo-303/
    │   └── page.tsx           # Ver Modelo 303
    └── modelo-130/
        └── page.tsx           # Ver Modelo 130
```

---

## 🔧 Utilidades a Crear

### `lib/api.ts` - Cliente API

```typescript
const API_URL = 'http://localhost:3000/api';

export async function api(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la petición');
  }

  return response.json();
}

// Métodos helper
export const auth = {
  register: (data: any) => api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => api('/auth/me'),
};

export const expenses = {
  list: (params?: any) => api(`/expenses?${new URLSearchParams(params)}`),
  create: (data: any) => api('/expenses', { method: 'POST', body: JSON.stringify(data) }),
};

export const invoices = {
  list: () => api('/invoices'),
  generate: (data: any) => api('/invoices/generate', { method: 'POST', body: JSON.stringify(data) }),
};

export const dashboard = {
  summary: (year: number) => api(`/dashboard/summary?year=${year}`),
  chart: (year: number) => api(`/dashboard/charts/ingresos-gastos?year=${year}`),
};

export const tax = {
  modelo303: (year: number, trimestre: number) => api(`/tax/modelo-303/${year}/${trimestre}`),
  modelo130: (year: number, trimestre: number) => api(`/tax/modelo-130/${year}/${trimestre}`),
};
```

### `lib/format.ts` - Utilidades de formato

```typescript
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-ES');
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
```

### `components/Card.tsx` - Componente reutilizable

```typescript
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {children}
    </div>
  );
}
```

---

## 📱 Páginas Clave

### 1. Dashboard (`app/dashboard/page.tsx`)

**Características:**
- Balance Real (grande y visible)
- Año actual (ingresos, gastos, beneficio)
- Próximo trimestre (fecha límite, IVA/IRPF a presentar)
- Estado TRADE (si aplica)
- Gráfico de ingresos vs gastos

**Layout:**
```
┌─────────────────────────────────────┐
│  BALANCE REAL: 10.510,00€          │
│  (Saldo 15k - IVA 2.5k - IRPF 1.6k)│
└─────────────────────────────────────┘

┌────────────┬────────────┬───────────┐
│ Ingresos   │ Gastos     │ Beneficio │
│ 36.000€    │ 12.000€    │ 24.000€   │
└────────────┴────────────┴───────────┘

┌─────────────────────────────────────┐
│  Próximo Trimestre                  │
│  📅 Fecha límite: 20/04/2024        │
│  💶 IVA a presentar: 1.288,36€      │
│  📊 IRPF a presentar: 561,88€       │
└─────────────────────────────────────┘

[Gráfico de ingresos vs gastos por mes]
```

### 2. Crear Gasto (`app/gastos/nuevo/page.tsx`)

**Formulario:**
```
Concepto: ___________________________
Categoría: [Dropdown]
Fecha emisión: [Date picker]
Proveedor: ___________________________
CIF: _________

Base Imponible: ___________€
IVA: [21%] → Calculado: 164.88€
IRPF: [0%] → Calculado: 0.00€

Total: 950.88€ (calculado automáticamente)

[Guardar Gasto]
```

**Al enviar:**
- POST /api/expenses
- Muestra alertas (gasto de independencia, alto riesgo)
- Redirect a /gastos

### 3. Generar Factura (`app/facturas/nueva/page.tsx`)

**Formulario:**
```
Cliente: [Dropdown de clientes] ▼
Fecha emisión: [Date picker]
Concepto: ___________________________
Periodo: [De] _________ [A] _________

Base Imponible: ___________€
IVA 21%: (Auto) 630.00€
IRPF 7%: (Auto) 210.00€

TOTAL A COBRAR: 3.420,00€

[Generar Factura]
```

**Al generar:**
- POST /api/invoices/generate
- Muestra número de factura (2024-001)
- Botón para descargar PDF (futuro)
- Redirect a /facturas

### 4. Modelo 303 (`app/fiscal/modelo-303/page.tsx`)

**Selector de trimestre:**
```
[1T 2024] [2T 2024] [3T 2024] [4T 2024]
```

**Muestra:**
```
┌─────────────────────────────────────┐
│  MODELO 303 - IVA 1T 2024          │
│  Fecha límite: 20/04/2024           │
└─────────────────────────────────────┘

IVA Repercutido:      1.995,00€
IVA Soportado:          706,64€
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO:  A INGRESAR 1.288,36€


CASILLAS AEAT:
┌────────┬──────────────────────────┐
│ 01     │ 9.500,00€                │
│ 03     │ 1.995,00€                │
│ 28     │ 3.365,62€                │
│ 29     │ 706,64€                  │
│ 46     │ 1.288,36€  ← RESULTADO  │
└────────┴──────────────────────────┘

INSTRUCCIONES:
1. Accede a Sede Electrónica AEAT
2. Modelo 303 > Declaración trimestral
3. Casilla 01: Base imponible → 9.500€
...
```

---

## 🎨 Estilos y Componentes

### Paleta de Colores

```css
Verde (Positivo):    #10b981
Rojo (Negativo):     #ef4444
Azul (Principal):    #3b82f6
Amarillo (Warning):  #f59e0b
Gris (Texto):        #6b7280
```

### Componentes Reutilizables

1. **Card** - Contenedor con shadow
2. **Button** - Botón con variantes (primary, secondary, danger)
3. **Input** - Campo de texto estilizado
4. **Badge** - Etiqueta de estado (BAJO/MEDIO/ALTO)
5. **Alert** - Alertas de éxito/warning/error

---

## 🔐 Autenticación

### Login Flow
```
1. Usuario ingresa email/password
2. POST /api/auth/login
3. Guardar token en localStorage
4. Redirect a /dashboard
```

### Protected Routes
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### Register Flow
```
1. Usuario completa formulario
2. POST /api/auth/register
3. Auto-login con token recibido
4. Redirect a /dashboard
```

---

## 📊 Dashboard - Componentes

### BalanceRealCard
```typescript
<Card>
  <h2>Balance Real Disponible</h2>
  <div className="text-4xl font-bold">
    {formatEuro(balanceReal)}
  </div>
  <div className="text-sm text-gray-500">
    Saldo bancario: {formatEuro(saldoBancario)}
    - IVA pendiente: {formatEuro(ivaPendiente)}
    - Brecha IRPF: {formatEuro(irpfBrecha)}
  </div>
</Card>
```

### AnoActualCard
```typescript
<Card>
  <h3>Año 2024</h3>
  <div className="grid grid-cols-3 gap-4">
    <div>
      <span className="text-green-600">Ingresos</span>
      <div className="text-2xl">{formatEuro(ingresos)}</div>
    </div>
    <div>
      <span className="text-red-600">Gastos</span>
      <div className="text-2xl">{formatEuro(gastos)}</div>
    </div>
    <div>
      <span className="text-blue-600">Beneficio</span>
      <div className="text-2xl">{formatEuro(beneficio)}</div>
    </div>
  </div>
</Card>
```

### TradeStatusCard
```typescript
{es_trade && (
  <Card>
    <h3>Estado TRADE</h3>
    <div>
      Cliente principal: {clientePrincipal}
      Dependencia: {formatPercent(porcentajeDependencia)}
      <Badge variant={getNivelColor(nivelRiesgo)}>
        {nivelRiesgo}
      </Badge>
    </div>
    <div className="mt-4">
      <h4>Gastos de Independencia (Enero)</h4>
      {alquiler ? '✅' : '❌'} Alquiler
      {electricidad ? '✅' : '❌'} Electricidad
      {internet ? '✅' : '❌'} Internet
    </div>
  </Card>
)}
```

---

## 🚀 Para Implementar (Next Steps)

### Orden Recomendado:

1. **Instalar dependencias**
```bash
cd frontend
npm install
```

2. **Crear `lib/api.ts`** - Cliente API
3. **Crear `app/layout.tsx`** - Layout con navegación
4. **Crear `app/login/page.tsx`** - Página de login
5. **Crear `app/dashboard/page.tsx`** - Dashboard principal
6. **Crear `app/gastos/nuevo/page.tsx`** - Formulario de gastos
7. **Crear `app/facturas/nueva/page.tsx`** - Formulario de facturas
8. **Crear `app/fiscal/modelo-303/page.tsx`** - Ver Modelo 303

### Testing
```bash
npm run dev
# Visitar http://localhost:3001
```

---

## 💡 Decisiones de Diseño

1. **Mobile-first:** Responsive desde el inicio
2. **Colores semánticos:** Verde=positivo, Rojo=negativo, Amarillo=warning
3. **Feedback inmediato:** Alertas al crear/editar
4. **Cálculos automáticos:** IVA/IRPF se calculan en tiempo real
5. **Validación frontend:** Antes de enviar al backend
6. **Loading states:** Spinners mientras cargan datos

---

## 📝 Ejemplo Completo: Login Page

```typescript
'use client';
import { useState } from 'react';
import { auth } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await auth.login({ email, password });
      localStorage.setItem('token', response.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          miGestor - Iniciar Sesión
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Regístrate
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

**El backend está 100% listo. Con este plan, puedes construir un frontend funcional en 2-3 horas.**

¿Comenzamos a implementar las páginas principales?

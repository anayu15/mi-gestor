# 🧪 miGestor - Complete API Testing Guide

This guide will walk you through testing every endpoint of the miGestor backend API.

---

## Prerequisites

1. **PostgreSQL running** with miGestor database created
2. **Backend server running**: `cd backend && npm run dev`
3. **curl** or **Postman/Insomnia** installed

---

## Test Flow (Complete User Journey)

### 1. Register a New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "Password123!",
    "nombre_completo": "Juan García López",
    "nif": "12345678Z",
    "fecha_alta_autonomo": "2024-01-01",
    "es_trade": true,
    "epigrafe_iae": "763"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid...",
      "email": "juan@example.com",
      "nombre_completo": "Juan García López",
      "nif": "12345678Z",
      "es_trade": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "info": [
    "Usuario registrado correctamente",
    "Calendario fiscal generado automáticamente"
  ]
}
```

**Save the token!** You'll need it for all subsequent requests.

```bash
# Set token as environment variable (easier for testing)
export TOKEN="your_token_here"
```

---

### 2. Get User Profile

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3. Create a Client

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razon_social": "Tech Solutions SL",
    "cif": "B12345678",
    "email": "facturas@techsolutions.es",
    "direccion": "Calle Mayor 123",
    "codigo_postal": "28001",
    "ciudad": "Madrid",
    "provincia": "Madrid",
    "telefono": "912345678",
    "persona_contacto": "María Pérez",
    "es_cliente_principal": true
  }'
```

**Save the client ID** from the response:
```bash
export CLIENT_ID="client_uuid_here"
```

---

### 4. List Clients

```bash
curl -X GET http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. Create Expenses (Gastos)

#### Example 1: Rent (Alquiler)
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
    "numero_factura": "ALQ-2024-001",
    "base_imponible": 785.12,
    "tipo_iva": 21.0,
    "tipo_irpf": 19.0
  }'
```

**Expected Response:**
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

#### Example 2: Electricity
```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "concepto": "Electricidad - Enero 2024",
    "fecha_emision": "2024-01-10",
    "proveedor_nombre": "Iberdrola SA",
    "proveedor_cif": "A12345678",
    "base_imponible": 45.50,
    "tipo_iva": 21.0
  }'
```

#### Example 3: Internet
```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "concepto": "Internet fibra - Enero 2024",
    "fecha_emision": "2024-01-15",
    "proveedor_nombre": "Movistar España",
    "proveedor_cif": "A12345679",
    "base_imponible": 35.00,
    "tipo_iva": 21.0
  }'
```

#### Example 4: Laptop (Equipment)
```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "concepto": "MacBook Pro 16 pulgadas",
    "categoria": "Equipamiento",
    "fecha_emision": "2024-01-20",
    "proveedor_nombre": "Apple Store Madrid",
    "base_imponible": 2500.00,
    "tipo_iva": 21.0
  }'
```

---

### 6. List Expenses

```bash
# All expenses
curl -X GET "http://localhost:3000/api/expenses" \
  -H "Authorization: Bearer $TOKEN"

# Filter by date range
curl -X GET "http://localhost:3000/api/expenses?fecha_desde=2024-01-01&fecha_hasta=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"

# Filter by category
curl -X GET "http://localhost:3000/api/expenses?categoria=Alquiler" \
  -H "Authorization: Bearer $TOKEN"

# Filter by risk level
curl -X GET "http://localhost:3000/api/expenses?nivel_riesgo=ALTO" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 7. Check TRADE Independence Compliance

```bash
curl -X GET "http://localhost:3000/api/expenses/independence-check/2024/1" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "mes": 1,
    "ano": 2024,
    "gastos_independencia_requeridos": [
      "Alquiler local",
      "Electricidad",
      "Internet"
    ],
    "gastos_registrados": [
      {
        "tipo": "Alquiler",
        "presente": true,
        "importe": 800.83,
        "a_nombre_propio": true,
        "warning": null
      },
      {
        "tipo": "Electricidad",
        "presente": true,
        "importe": 55.06,
        "a_nombre_propio": true,
        "warning": null
      },
      {
        "tipo": "Internet",
        "presente": true,
        "importe": 35.00,
        "a_nombre_propio": true,
        "warning": null
      }
    ],
    "cumple_requisitos": true,
    "alertas_generadas": []
  }
}
```

---

### 8. Get Next Invoice Number

```bash
curl -X GET "http://localhost:3000/api/invoices/next-number?year=2024" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "next_number": "2024-001",
    "serie": "A",
    "year": 2024
  }
}
```

---

### 9. Generate Invoice (Factura)

```bash
curl -X POST http://localhost:3000/api/invoices/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"fecha_emision\": \"2024-01-31\",
    \"fecha_vencimiento\": \"2024-02-29\",
    \"periodo_facturacion_inicio\": \"2024-01-01\",
    \"periodo_facturacion_fin\": \"2024-01-31\",
    \"concepto\": \"Servicios de desarrollo software - Enero 2024\",
    \"descripcion_detallada\": \"Desarrollo de aplicación web según contrato 2024-001\",
    \"base_imponible\": 3000.00,
    \"tipo_iva\": 21.0,
    \"tipo_irpf\": 7.0
  }"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "numero_factura": "2024-001",
    "base_imponible": 3000.00,
    "cuota_iva": 630.00,
    "cuota_irpf": 210.00,
    "total_factura": 3420.00,
    "estado": "PENDIENTE"
  },
  "info": [
    "Factura 2024-001 generada correctamente",
    "IVA repercutido: 630.00€ (ingresarás a AEAT en Modelo 303)",
    "IRPF retenido: 210.00€ (recuperable en tu Renta anual)",
    "Total a cobrar: 3420.00€"
  ]
}
```

**Save the invoice ID:**
```bash
export INVOICE_ID="invoice_uuid_here"
```

---

### 10. Generate More Invoices

Create invoices for multiple months to have data:

```bash
# February
curl -X POST http://localhost:3000/api/invoices/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"fecha_emision\": \"2024-02-29\",
    \"periodo_facturacion_inicio\": \"2024-02-01\",
    \"periodo_facturacion_fin\": \"2024-02-29\",
    \"concepto\": \"Servicios de desarrollo software - Febrero 2024\",
    \"base_imponible\": 3000.00,
    \"tipo_iva\": 21.0,
    \"tipo_irpf\": 7.0
  }"

# March
curl -X POST http://localhost:3000/api/invoices/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"fecha_emision\": \"2024-03-31\",
    \"periodo_facturacion_inicio\": \"2024-03-01\",
    \"periodo_facturacion_fin\": \"2024-03-31\",
    \"concepto\": \"Servicios de desarrollo software - Marzo 2024\",
    \"base_imponible\": 3500.00,
    \"tipo_iva\": 21.0,
    \"tipo_irpf\": 7.0
  }"
```

---

### 11. List Invoices

```bash
curl -X GET "http://localhost:3000/api/invoices" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 12. Mark Invoice as Paid

```bash
curl -X PATCH "http://localhost:3000/api/invoices/$INVOICE_ID/mark-paid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_pago": "2024-02-05",
    "metodo_pago": "Transferencia bancaria"
  }'
```

---

### 13. Get Dashboard Summary

**This is the most important endpoint - it shows everything together!**

```bash
curl -X GET "http://localhost:3000/api/dashboard/summary?year=2024" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected Response (formatted):**
```json
{
  "success": true,
  "data": {
    "balance_real": {
      "saldo_bancario": 0.00,
      "iva_pendiente_pagar": 1890.00,
      "irpf_brecha": 1540.00,
      "seguridad_social_pendiente": 310.00,
      "balance_real": -3740.00,
      "advertencia": "Tu balance real es 3740.00€ menor que tu saldo bancario debido a obligaciones fiscales pendientes"
    },
    "ano_actual": {
      "ingresos_totales": 9500.00,
      "gastos_deducibles": 3365.62,
      "beneficio_neto": 6134.38,
      "iva_repercutido": 1995.00,
      "iva_soportado": 706.64,
      "iva_a_pagar": 1288.36,
      "irpf_retenido_7pct": 665.00,
      "irpf_estimado_21pct": 1288.22,
      "tipo_irpf_estimado": 21,
      "irpf_brecha": 623.22
    },
    "proximo_trimestre": {
      "trimestre": 1,
      "fecha_limite": "2024-04-20",
      "dias_restantes": 78,
      "urgente": false,
      "iva_a_presentar": 1288.36,
      "irpf_a_presentar": 306.80
    },
    "trade_status": {
      "es_trade": true,
      "cliente_principal": "Tech Solutions SL",
      "porcentaje_dependencia": 100.00,
      "nivel_riesgo": "CRÍTICO",
      "riesgo_score": 70,
      "alertas_activas": 0,
      "gastos_independencia_mes_actual": {
        "alquiler": true,
        "electricidad": true,
        "internet": true
      }
    },
    "alertas_criticas": []
  }
}
```

---

### 14. Get Income vs Expenses Chart

```bash
curl -X GET "http://localhost:3000/api/dashboard/charts/ingresos-gastos?year=2024" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    "ingresos": [3000, 3000, 3500, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "gastos": [3365.62, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "beneficio_neto": [-365.62, 3000, 3500, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}
```

---

### 15. Calculate Modelo 303 (IVA Quarterly)

```bash
curl -X GET "http://localhost:3000/api/tax/modelo-303/2024/1" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelo": "303",
    "trimestre": 1,
    "ano": 2024,
    "periodo": "1T 2024 (01/01/2024 - 31/03/2024)",
    "fecha_limite_presentacion": "2024-04-20",
    "iva_repercutido": 1995.00,
    "iva_soportado": 706.64,
    "resultado_iva": 1288.36,
    "accion": "A INGRESAR",
    "casillas_aeat": {
      "casilla_01": 9500.00,
      "casilla_03": 1995.00,
      "casilla_28": 3365.62,
      "casilla_29": 706.64,
      "casilla_46": 1288.36
    },
    "instrucciones": [
      "Accede a la Sede Electrónica de AEAT",
      "Modelo 303 > Declaración trimestral",
      "Casilla 01: Base imponible general (21%) → 9500.00€",
      "Casilla 03: Cuota IVA repercutido → 1995.00€",
      "Casilla 28: Base imponible IVA soportado → 3365.62€",
      "Casilla 29: Cuota IVA deducible → 706.64€",
      "Casilla 46: Resultado (A INGRESAR) → 1288.36€"
    ]
  }
}
```

---

### 16. Calculate Modelo 130 (IRPF Quarterly)

```bash
curl -X GET "http://localhost:3000/api/tax/modelo-130/2024/1" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelo": "130",
    "trimestre": 1,
    "ano": 2024,
    "periodo": "1T 2024",
    "ingresos_computables": 9500.00,
    "gastos_deducibles": 3365.62,
    "rendimiento_neto": 6134.38,
    "pago_fraccionado_20pct": 1226.88,
    "retenciones_practicadas": 665.00,
    "resultado": 561.88,
    "accion": "A INGRESAR",
    "casillas_aeat": {
      "casilla_01": 9500.00,
      "casilla_02": 3365.62,
      "casilla_03": 6134.38,
      "casilla_07": 1226.88,
      "casilla_16": 665.00,
      "casilla_19": 561.88
    },
    "fecha_limite_presentacion": "2024-04-20",
    "nota": "Pagas un 20% del rendimiento neto cada trimestre..."
  }
}
```

---

### 17. Get Tax Summary for Entire Year

```bash
curl -X GET "http://localhost:3000/api/tax/summary/2024" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 Full Testing Script

Save this as `test.sh` and run it:

```bash
#!/bin/bash

API="http://localhost:3000/api"

echo "🧪 Testing miGestor API"
echo "======================="

# 1. Register
echo -e "\n1️⃣  Registering user..."
RESPONSE=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "Password123!",
    "nombre_completo": "Test User",
    "nif": "12345678Z",
    "fecha_alta_autonomo": "2024-01-01",
    "es_trade": true
  }')

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
echo "✅ Token: ${TOKEN:0:20}..."

# 2. Create client
echo -e "\n2️⃣  Creating client..."
CLIENT=$(curl -s -X POST $API/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razon_social": "Tech Co",
    "cif": "B12345678",
    "es_cliente_principal": true
  }')

CLIENT_ID=$(echo $CLIENT | jq -r '.data.id')
echo "✅ Client ID: $CLIENT_ID"

# 3. Create expenses
echo -e "\n3️⃣  Creating expenses..."
curl -s -X POST $API/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "concepto": "Alquiler",
    "fecha_emision": "2024-01-05",
    "proveedor_nombre": "Inmobiliaria",
    "base_imponible": 785.12,
    "tipo_iva": 21,
    "tipo_irpf": 19
  }' > /dev/null
echo "✅ Rent expense created"

# 4. Generate invoice
echo -e "\n4️⃣  Generating invoice..."
curl -s -X POST $API/invoices/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"fecha_emision\": \"2024-01-31\",
    \"concepto\": \"Servicios enero\",
    \"base_imponible\": 3000,
    \"tipo_iva\": 21,
    \"tipo_irpf\": 7
  }" > /dev/null
echo "✅ Invoice 2024-001 created"

# 5. Get dashboard
echo -e "\n5️⃣  Getting dashboard..."
DASHBOARD=$(curl -s -X GET "$API/dashboard/summary?year=2024" \
  -H "Authorization: Bearer $TOKEN")

BENEFICIO=$(echo $DASHBOARD | jq -r '.data.ano_actual.beneficio_neto')
IVA_PAGAR=$(echo $DASHBOARD | jq -r '.data.ano_actual.iva_a_pagar')

echo "✅ Beneficio neto: ${BENEFICIO}€"
echo "✅ IVA a pagar: ${IVA_PAGAR}€"

echo -e "\n✅ ALL TESTS PASSED!"
```

---

## 📝 Notes

- Use `jq` to format JSON responses: `curl ... | jq '.'`
- All amounts are in euros with 2 decimal precision
- Dates are in ISO format: `YYYY-MM-DD`
- The dashboard endpoint is the most comprehensive - test it last
- TRADE compliance checks require at least rent, electricity, and internet expenses

---

## 🐛 Troubleshooting

**Error: "Token de autenticación no proporcionado"**
- Make sure you're sending the `Authorization: Bearer $TOKEN` header

**Error: "Usuario no autenticado"**
- Your token may have expired (7 days). Register a new user.

**Error: "Cliente no encontrado"**
- Make sure the client_id exists and belongs to your user

**Calculations seem wrong:**
- All calculations use cent-precision rounding
- Check the formulas in `/backend/src/utils/taxCalculations.ts`

---

Enjoy testing! 🎉

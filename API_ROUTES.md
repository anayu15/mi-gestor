# miGestor - API Routes Documentation

## Base URL
```
Development: http://localhost:3000/api
Production: https://api.migestor.es/api
```

## Authentication
Todas las rutas (excepto `/auth/*`) requieren header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

# 1. Authentication Routes

## POST `/api/auth/register`
Registro de nuevo autónomo.

**Request Body:**
```json
{
  "email": "usuario@example.com",
  "password": "SecurePass123!",
  "nombre_completo": "Juan García López",
  "nif": "12345678A",
  "fecha_alta_autonomo": "2024-01-15",
  "es_trade": true,
  "epigrafe_iae": "763"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@example.com",
      "nombre_completo": "Juan García López",
      "es_trade": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Auto-actions:**
- Genera calendario fiscal para el año actual
- Crea cuenta bancaria placeholder
- Envía email de bienvenida

---

## POST `/api/auth/login`
Inicio de sesión.

**Request Body:**
```json
{
  "email": "usuario@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "nombre_completo": "Juan García", "es_trade": true },
    "token": "JWT_TOKEN"
  }
}
```

---

## GET `/api/auth/me`
Obtener perfil del usuario autenticado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "usuario@example.com",
    "nombre_completo": "Juan García López",
    "nif": "12345678A",
    "es_trade": true,
    "tipo_irpf_actual": 7.00,
    "tipo_irpf_estimado": 21.00,
    "porcentaje_dependencia": 85.00
  }
}
```

---

# 2. Client Management

## GET `/api/clients`
Listar todos los clientes.

**Query Params:**
- `activo`: `true` / `false`
- `sort`: `razon_social` / `porcentaje_facturacion`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "razon_social": "Tech Solutions SL",
      "cif": "B12345678",
      "es_cliente_principal": true,
      "porcentaje_facturacion": 85.00,
      "email": "facturas@techsolutions.es"
    }
  ]
}
```

---

## POST `/api/clients`
Crear nuevo cliente.

**Request Body:**
```json
{
  "razon_social": "Tech Solutions SL",
  "cif": "B12345678",
  "email": "facturas@techsolutions.es",
  "direccion": "Calle Mayor 123",
  "codigo_postal": "28001",
  "ciudad": "Madrid",
  "es_cliente_principal": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "razon_social": "Tech Solutions SL",
    "es_cliente_principal": true
  },
  "warnings": [
    "Este cliente representa el 85% de tu facturación. Riesgo TRADE: ALTO"
  ]
}
```

**Validations:**
- Solo un cliente puede ser `es_cliente_principal = true`
- Si es TRADE y nuevo cliente principal > 75%, genera alerta

---

## PATCH `/api/clients/:id`
Actualizar cliente.

## DELETE `/api/clients/:id`
Desactivar cliente (soft delete).

---

# 3. Asset Management (Bienes de Inversión)

## GET `/api/assets`
Listar bienes de inversión.

**Query Params:**
- `activo`: `true` / `false`
- `categoria`: `Informático` / `Mobiliario` / `Vehículo`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "MacBook Pro 16\" 2024",
      "categoria": "Informático",
      "fecha_adquisicion": "2024-01-15",
      "importe_adquisicion": 2500.00,
      "iva_soportado": 525.00,
      "vida_util_anos": 5,
      "porcentaje_amortizacion_anual": 20.00,
      "amortizacion_acumulada": 250.00,
      "valor_residual": 2250.00
    }
  ]
}
```

---

## POST `/api/assets`
Registrar nuevo bien.

**Request Body:**
```json
{
  "nombre": "MacBook Pro 16\" 2024",
  "descripcion": "Ordenador para desarrollo",
  "categoria": "Informático",
  "fecha_adquisicion": "2024-01-15",
  "importe_adquisicion": 2500.00,
  "iva_soportado": 525.00,
  "numero_factura": "A-2024-001",
  "proveedor": "Apple Store Madrid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "MacBook Pro 16\" 2024",
    "vida_util_anos": 5,
    "amortizacion_anual": 500.00
  },
  "info": [
    "Amortización anual: 500€ durante 5 años",
    "IVA soportado 525€ deducible en Modelo 303"
  ]
}
```

---

## GET `/api/assets/:id/amortizacion`
Obtener tabla de amortización completa.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "asset_id": "uuid",
    "nombre": "MacBook Pro 16\" 2024",
    "importe_inicial": 2500.00,
    "amortizacion_por_ano": [
      { "ano": 2024, "amortizacion": 500.00, "valor_residual": 2000.00 },
      { "ano": 2025, "amortizacion": 500.00, "valor_residual": 1500.00 },
      { "ano": 2026, "amortizacion": 500.00, "valor_residual": 1000.00 },
      { "ano": 2027, "amortizacion": 500.00, "valor_residual": 500.00 },
      { "ano": 2028, "amortizacion": 500.00, "valor_residual": 0.00 }
    ]
  }
}
```

---

# 4. Expense Management (Gastos + OCR)

## GET `/api/expenses`
Listar gastos.

**Query Params:**
- `fecha_desde`: `2024-01-01`
- `fecha_hasta`: `2024-12-31`
- `categoria`: `Alquiler` / `Suministros` / `Material`
- `es_deducible`: `true` / `false`
- `nivel_riesgo`: `BAJO` / `MEDIO` / `ALTO`
- `pagado`: `true` / `false`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "concepto": "Alquiler oficina - Enero 2024",
      "proveedor_nombre": "Inmobiliaria XYZ SL",
      "fecha_emision": "2024-01-05",
      "base_imponible": 785.12,
      "tipo_iva": 21.00,
      "cuota_iva": 164.88,
      "tipo_irpf": 19.00,
      "cuota_irpf": -149.17,
      "total_factura": 800.83,
      "es_gasto_independencia": true,
      "nivel_riesgo": "BAJO",
      "ocr_procesado": true,
      "archivo_url": "/uploads/factura-alquiler-ene24.pdf"
    }
  ],
  "meta": {
    "total": 15,
    "suma_base_imponible": 5234.50,
    "suma_iva_deducible": 1099.25
  }
}
```

---

## POST `/api/expenses`
Crear gasto manualmente (sin OCR).

**Request Body:**
```json
{
  "concepto": "Alquiler oficina - Enero 2024",
  "categoria": "Alquiler",
  "fecha_emision": "2024-01-05",
  "proveedor_nombre": "Inmobiliaria XYZ SL",
  "proveedor_cif": "B87654321",
  "numero_factura": "ALQ-2024-001",
  "base_imponible": 785.12,
  "tipo_iva": 21.00,
  "tipo_irpf": 19.00
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "cuota_iva": 164.88,
    "cuota_irpf": 149.17,
    "total_factura": 800.83
  },
  "alerts": [
    {
      "tipo": "success",
      "mensaje": "Gasto de independencia registrado (Alquiler a tu nombre)"
    }
  ]
}
```

**Auto-calculations:**
- `cuota_iva = base_imponible * tipo_iva / 100`
- `cuota_irpf = base_imponible * tipo_irpf / 100`
- `total_factura = base_imponible + cuota_iva - cuota_irpf`

---

## POST `/api/expenses/upload-ocr`
Subir factura y procesar con OCR.

**Request (multipart/form-data):**
```
file: [PDF/JPG/PNG]
categoria: "Alquiler" (opcional, ayuda al OCR)
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "expense_id": "uuid",
    "ocr_status": "PROCESSING",
    "mensaje": "Procesando factura con OCR. Recibirás notificación al finalizar."
  }
}
```

**Webhook callback (cuando termine OCR):**
```json
{
  "expense_id": "uuid",
  "ocr_status": "COMPLETED",
  "ocr_confianza": 0.92,
  "datos_extraidos": {
    "proveedor_nombre": "Iberdrola SA",
    "proveedor_cif": "A12345678",
    "numero_factura": "EB-2024-001234",
    "fecha_emision": "2024-01-10",
    "base_imponible": 45.50,
    "tipo_iva": 21.00,
    "cuota_iva": 9.56,
    "total_factura": 55.06
  },
  "ocr_requiere_revision": false,
  "sugerencias": [
    "Concepto sugerido: Electricidad - Enero 2024",
    "Categoría sugerida: Suministros",
    "Es gasto de independencia: true (suministro a tu nombre)"
  ]
}
```

**Flujo:**
1. POST a `/upload-ocr` → Responde inmediatamente con 202
2. Backend procesa con Tesseract.js (5-15 segundos)
3. Guarda datos en `ocr_datos_extraidos` (JSONB)
4. Frontend hace polling a `GET /api/expenses/:id` o usa WebSocket

---

## GET `/api/expenses/:id`
Obtener detalle completo de un gasto.

## PATCH `/api/expenses/:id`
Editar gasto (ej: corregir datos del OCR).

## DELETE `/api/expenses/:id`
Eliminar gasto.

---

## GET `/api/expenses/independence-check/:year/:month`
**Validación TRADE:** Verificar gastos de independencia del mes.

**Response (200):**
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
        "a_nombre_propio": true
      },
      {
        "tipo": "Electricidad",
        "presente": true,
        "importe": 55.06,
        "a_nombre_propio": true
      },
      {
        "tipo": "Internet",
        "presente": false,
        "warning": "Falta factura de internet a tu nombre"
      }
    ],
    "cumple_requisitos": false,
    "alertas_generadas": [
      {
        "severidad": "WARNING",
        "mensaje": "Falta registrar factura de Internet de Enero 2024"
      }
    ]
  }
}
```

---

# 5. Invoice Generation

## GET `/api/invoices`
Listar facturas emitidas.

**Query Params:**
- `fecha_desde` / `fecha_hasta`
- `client_id`
- `estado`: `PENDIENTE` / `PAGADA` / `VENCIDA`
- `pagada`: `true` / `false`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "numero_factura": "2024-001",
      "fecha_emision": "2024-01-31",
      "cliente": {
        "razon_social": "Tech Solutions SL",
        "cif": "B12345678"
      },
      "concepto": "Servicios desarrollo software - Enero 2024",
      "base_imponible": 3000.00,
      "cuota_iva": 630.00,
      "cuota_irpf": 210.00,
      "total_factura": 3420.00,
      "estado": "PAGADA",
      "fecha_pago": "2024-02-05",
      "pdf_url": "/invoices/2024-001.pdf"
    }
  ],
  "meta": {
    "total_facturado": 36000.00,
    "total_iva_repercutido": 7560.00,
    "total_irpf_retenido": 2520.00
  }
}
```

---

## POST `/api/invoices/generate`
Generar factura automáticamente.

**Request Body:**
```json
{
  "client_id": "uuid",
  "fecha_emision": "2024-01-31",
  "periodo_facturacion_inicio": "2024-01-01",
  "periodo_facturacion_fin": "2024-01-31",
  "concepto": "Servicios de desarrollo software - Enero 2024",
  "base_imponible": 3000.00,
  "tipo_iva": 21.00,
  "tipo_irpf": 7.00
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "numero_factura": "2024-001",
    "cuota_iva": 630.00,
    "cuota_irpf": 210.00,
    "total_factura": 3420.00,
    "pdf_url": "/invoices/2024-001.pdf",
    "pdf_generado": true
  },
  "info": [
    "Factura generada correctamente",
    "IVA repercutido: 630€ (ingresarás a AEAT en Modelo 303)",
    "IRPF retenido: 210€ (recuperable en tu Renta anual)"
  ]
}
```

**Auto-actions:**
- Calcula automáticamente `cuota_iva` y `cuota_irpf` con precisión céntimos
- Asigna número de factura secuencial (`2024-001`, `2024-002`, etc.)
- Genera PDF con plantilla profesional
- Valida que cálculos sean exactos (trigger DB)

---

## POST `/api/invoices/:id/send-email`
Enviar factura por email al cliente.

**Request Body:**
```json
{
  "email": "facturas@techsolutions.es",
  "mensaje_adicional": "Adjunto factura del mes de enero. Plazo de pago: 30 días."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "enviada": true,
    "fecha_envio": "2024-01-31T10:30:00Z"
  }
}
```

---

## PATCH `/api/invoices/:id/mark-paid`
Marcar factura como pagada.

**Request Body:**
```json
{
  "fecha_pago": "2024-02-05",
  "metodo_pago": "Transferencia bancaria"
}
```

---

## GET `/api/invoices/:id/pdf`
Descargar PDF de factura.

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="Factura-2024-001.pdf"`

---

# 6. Dashboard & Analytics

## GET `/api/dashboard/summary`
Resumen completo para la pantalla principal.

**Query Params:**
- `year`: `2024` (por defecto año actual)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "balance_real": {
      "saldo_bancario": 15000.00,
      "iva_pendiente_pagar": 2500.00,
      "irpf_brecha": 1680.00,
      "seguridad_social_pendiente": 310.00,
      "balance_real": 10510.00,
      "advertencia": "Tu balance real es 4490€ menor que tu saldo bancario debido a obligaciones fiscales pendientes"
    },
    "ano_actual": {
      "ingresos_totales": 36000.00,
      "gastos_deducibles": 12000.00,
      "beneficio_neto": 24000.00,
      "iva_repercutido": 7560.00,
      "iva_soportado": 2520.00,
      "iva_a_pagar": 5040.00,
      "irpf_retenido_7pct": 2520.00,
      "irpf_estimado_21pct": 5040.00,
      "irpf_brecha": 2520.00
    },
    "proximo_trimestre": {
      "trimestre": 1,
      "fecha_limite": "2024-04-20",
      "dias_restantes": 15,
      "iva_a_presentar": 1260.00,
      "irpf_a_presentar": 630.00
    },
    "trade_status": {
      "es_trade": true,
      "cliente_principal": "Tech Solutions SL",
      "porcentaje_dependencia": 85.00,
      "nivel_riesgo": "ALTO",
      "alertas_activas": 2,
      "gastos_independencia_mes_actual": {
        "alquiler": true,
        "electricidad": true,
        "internet": false
      }
    },
    "alertas_criticas": [
      {
        "tipo": "FALTA_GASTO_INDEPENDENCIA",
        "severidad": "CRITICAL",
        "mensaje": "Falta factura de Internet de Enero 2024 a tu nombre",
        "accion": "Sube la factura en Gastos > Subir factura"
      }
    ]
  }
}
```

---

## GET `/api/dashboard/cash-flow-history`
Histórico de balance real.

**Query Params:**
- `fecha_desde`: `2024-01-01`
- `fecha_hasta`: `2024-12-31`
- `granularidad`: `diaria` / `semanal` / `mensual`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "fecha": "2024-01-31",
      "saldo_bancario": 12000.00,
      "balance_real": 9500.00,
      "diferencia": 2500.00
    },
    {
      "fecha": "2024-02-29",
      "saldo_bancario": 15000.00,
      "balance_real": 11200.00,
      "diferencia": 3800.00
    }
  ]
}
```

---

## GET `/api/dashboard/charts/ingresos-gastos`
Datos para gráfico de ingresos vs gastos.

**Query Params:**
- `year`: `2024`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "labels": ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    "ingresos": [3000, 3000, 3500, 3000, 3200, 3000, 3000, 0, 0, 0, 0, 0],
    "gastos": [1200, 1100, 1400, 1050, 1300, 1150, 1200, 0, 0, 0, 0, 0],
    "beneficio_neto": [1800, 1900, 2100, 1950, 1900, 1850, 1800, 0, 0, 0, 0, 0]
  }
}
```

---

# 7. Tax Calculations (Modelos AEAT)

## GET `/api/tax/modelo-303/:year/:trimestre`
Calcular Modelo 303 (IVA trimestral).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "modelo": "303",
    "trimestre": 1,
    "ano": 2024,
    "periodo": "1T 2024 (Enero-Marzo)",
    "fecha_limite_presentacion": "2024-04-20",

    "iva_repercutido": 1890.00,
    "iva_soportado": 630.00,
    "resultado_iva": 1260.00,
    "accion": "A INGRESAR",

    "casillas_aeat": {
      "casilla_01": 9000.00,
      "casilla_03": 1890.00,
      "casilla_28": 3000.00,
      "casilla_29": 630.00,
      "casilla_46": 1260.00
    },

    "instrucciones": [
      "Accede a la Sede Electrónica de AEAT",
      "Modelo 303 > Declaración trimestral",
      "Casilla 01: Base imponible general (21%) → 9000.00€",
      "Casilla 03: Cuota IVA repercutido → 1890.00€",
      "Casilla 28: Base imponible IVA soportado → 3000.00€",
      "Casilla 29: Cuota IVA deducible → 630.00€",
      "Casilla 46: Resultado (A INGRESAR) → 1260.00€"
    ]
  }
}
```

---

## GET `/api/tax/modelo-130/:year/:trimestre`
Calcular Modelo 130 (IRPF trimestral).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "modelo": "130",
    "trimestre": 1,
    "ano": 2024,

    "ingresos_computables": 9000.00,
    "gastos_deducibles": 3000.00,
    "rendimiento_neto": 6000.00,

    "pago_fraccionado_20pct": 1200.00,
    "retenciones_practicadas": 630.00,
    "resultado": 570.00,
    "accion": "A INGRESAR",

    "casillas_aeat": {
      "casilla_01": 9000.00,
      "casilla_02": 3000.00,
      "casilla_03": 6000.00,
      "casilla_07": 1200.00,
      "casilla_16": 630.00,
      "casilla_19": 570.00
    },

    "nota": "Pagas un 20% del rendimiento neto cada trimestre. En la Renta anual ajustarás con el tipo real (~21% para tus ingresos)."
  }
}
```

---

## GET `/api/tax/modelo-390/:year`
Resumen anual IVA (Modelo 390).

---

## POST `/api/tax/generate-libro-ingresos`
Generar Libro de Ingresos (formato AEAT).

**Query Params:**
- `year`: `2024`
- `format`: `pdf` / `csv` / `excel`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "archivo_url": "/exports/libro-ingresos-2024.pdf",
    "total_registros": 12,
    "suma_base_imponible": 36000.00,
    "suma_iva_repercutido": 7560.00
  }
}
```

**Formato del Libro:**
```
| Fecha      | Nº Factura | Cliente           | Base      | IVA 21%  | Total     |
|------------|------------|-------------------|-----------|----------|-----------|
| 31/01/2024 | 2024-001   | Tech Solutions SL | 3.000,00€ | 630,00€  | 3.630,00€ |
| 29/02/2024 | 2024-002   | Tech Solutions SL | 3.000,00€ | 630,00€  | 3.630,00€ |
| ...        | ...        | ...               | ...       | ...      | ...       |
| TOTALES    |            |                   | 36.000€   | 7.560€   | 43.560€   |
```

---

## POST `/api/tax/generate-libro-gastos`
Generar Libro de Gastos.

---

## POST `/api/tax/generate-libro-bienes-inversion`
Generar Libro de Bienes de Inversión.

---

# 8. Compliance & Alerts

## GET `/api/compliance/alerts`
Obtener alertas de cumplimiento.

**Query Params:**
- `leida`: `true` / `false`
- `severidad`: `INFO` / `WARNING` / `CRITICAL`
- `tipo`: `FALTA_GASTO_INDEPENDENCIA` / `EXCESO_DEPENDENCIA` / `GASTO_ALTO_RIESGO`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tipo": "FALTA_GASTO_INDEPENDENCIA",
      "severidad": "CRITICAL",
      "titulo": "Falta gasto de independencia: Internet",
      "descripcion": "No has registrado factura de Internet de Enero 2024 a tu nombre.",
      "recomendacion": "Como autónomo TRADE con local alquilado, debes demostrar independencia del cliente. Sube la factura de internet a tu nombre lo antes posible.",
      "periodo_mes": 1,
      "periodo_ano": 2024,
      "leida": false,
      "created_at": "2024-02-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "tipo": "GASTO_ALTO_RIESGO",
      "severidad": "WARNING",
      "titulo": "Gasto de riesgo detectado",
      "descripcion": "Has registrado una comida de 85€ un sábado. AEAT puede cuestionar gastos de restauración en fines de semana.",
      "recomendacion": "Asegúrate de tener justificación (reunión con cliente, formación, etc.) y documentación adicional.",
      "related_expense_id": "uuid",
      "leida": false
    }
  ],
  "meta": {
    "total_no_leidas": 3,
    "criticas": 1,
    "warnings": 2
  }
}
```

---

## PATCH `/api/compliance/alerts/:id/mark-read`
Marcar alerta como leída.

---

## GET `/api/compliance/trade-score`
Calcular score de riesgo TRADE.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "es_trade": true,
    "porcentaje_dependencia": 85.00,
    "riesgo_general": "ALTO",
    "score": 75,
    "factores_riesgo": [
      {
        "factor": "Dependencia > 75%",
        "impacto": "ALTO",
        "puntos": +40,
        "descripcion": "Facturas el 85% a un solo cliente"
      },
      {
        "factor": "Sin gastos independencia completos",
        "impacto": "CRÍTICO",
        "puntos": +30,
        "descripcion": "Falta factura de Internet de Enero"
      },
      {
        "factor": "Gastos de alto riesgo",
        "impacto": "MEDIO",
        "puntos": +5,
        "descripcion": "1 gasto cuestionable detectado"
      }
    ],
    "recomendaciones": [
      "Busca un segundo cliente para reducir dependencia por debajo del 75%",
      "Completa gastos de independencia (sube factura Internet)",
      "Revisa gasto de comida del 15/01/2024"
    ]
  }
}
```

---

# 9. Fiscal Calendar

## GET `/api/calendar/events`
Obtener eventos fiscales.

**Query Params:**
- `fecha_desde`: `2024-01-01`
- `fecha_hasta`: `2024-12-31`
- `tipo`: `MODELO_303` / `MODELO_130` / etc.
- `completado`: `true` / `false`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tipo": "MODELO_303",
      "titulo": "Modelo 303 - IVA 1T",
      "descripcion": "Declaración trimestral de IVA (Enero-Marzo 2024)",
      "fecha_limite": "2024-04-20",
      "trimestre": 1,
      "ano": 2024,
      "completado": false,
      "dias_restantes": 15,
      "urgente": true
    }
  ]
}
```

---

## PATCH `/api/calendar/events/:id/complete`
Marcar evento como completado.

---

## GET `/api/calendar/notifications`
Obtener notificaciones pendientes (próximos 7 días).

---

# 10. Scenario Simulator

## POST `/api/simulator/calculate`
Simular escenario fiscal.

**Request Body:**
```json
{
  "nombre": "Agregar Cliente Secundario",
  "ingresos_cliente_principal": 30000.00,
  "ingresos_cliente_secundario": 6000.00,
  "gastos_mensuales_adicionales": 0.00
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "escenario_actual": {
      "ingresos_totales": 36000.00,
      "porcentaje_dependencia": 100.00,
      "cumple_trade": false,
      "riesgo_score": 85
    },
    "escenario_simulado": {
      "ingresos_totales": 36000.00,
      "porcentaje_dependencia": 83.33,
      "cumple_trade": false,
      "riesgo_score": 70,
      "mejora_riesgo": -15
    },
    "impacto_fiscal": {
      "iva_anual": 7560.00,
      "irpf_anual": 5040.00,
      "beneficio_neto": 24000.00,
      "diferencia": "Sin cambios fiscales, solo menor riesgo TRADE"
    },
    "recomendaciones": [
      "Con 83.33% de dependencia, aún estás por encima del 75% límite TRADE",
      "Necesitas facturar al menos 9000€ anuales a un segundo cliente para bajar del 75%",
      "Tu riesgo bajaría de 85 a 60 si llegas al 74% de dependencia"
    ]
  }
}
```

---

## GET `/api/simulator/recommendations`
Obtener recomendaciones inteligentes para reducir riesgo.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "situacion_actual": {
      "ingresos_anuales": 36000.00,
      "cliente_principal_pct": 85.00,
      "riesgo_score": 75
    },
    "opciones": [
      {
        "titulo": "Opción 1: Agregar cliente menor",
        "descripcion": "Factura 500€/mes a un segundo cliente",
        "impacto": {
          "nueva_dependencia": 71.43,
          "cumple_trade": true,
          "nuevo_riesgo": 45,
          "mejora": "30 puntos menos de riesgo"
        }
      },
      {
        "titulo": "Opción 2: Reducir facturación principal",
        "descripcion": "Reduce a 2500€/mes con cliente actual y busca más clientes",
        "impacto": {
          "nueva_dependencia": 69.44,
          "cumple_trade": true,
          "nuevo_riesgo": 40
        }
      }
    ]
  }
}
```

---

# 11. Bank Accounts

## GET `/api/bank-accounts`
Listar cuentas bancarias.

## POST `/api/bank-accounts`
Agregar cuenta bancaria.

## PATCH `/api/bank-accounts/:id/update-balance`
Actualizar saldo actual.

**Request Body:**
```json
{
  "saldo_actual": 15000.00
}
```

---

# Error Handling

Todos los errores siguen este formato:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El NIF proporcionado no es válido",
    "details": {
      "field": "nif",
      "value": "12345678",
      "expected": "Formato: 8 dígitos + letra (ej: 12345678A)"
    }
  }
}
```

**Códigos de error comunes:**
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409) - ej: ya existe cliente principal
- `INTERNAL_SERVER_ERROR` (500)

---

# Rate Limiting

- **Límite general:** 100 requests / minuto por IP
- **OCR endpoint:** 10 uploads / minuto (proceso intensivo)
- **PDF generation:** 20 generaciones / minuto

**Header de respuesta:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1609459200
```

---

# Webhooks (Futuro)

Para notificaciones en tiempo real (opcional):

```json
POST https://tu-webhook.com/migestor
{
  "event": "invoice.paid",
  "data": {
    "invoice_id": "uuid",
    "numero_factura": "2024-001",
    "importe": 3420.00
  }
}
```

---

Este diseño de API está completo y listo para implementar todas las funcionalidades de miGestor con enfoque en precisión fiscal española.

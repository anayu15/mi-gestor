# miGestor - Database Schema (PostgreSQL)

## Overview
Este esquema está diseñado específicamente para gestores fiscales autónomos TRADE en España, con soporte completo para cálculos de IVA, IRPF, y generación de libros oficiales AEAT.

---

## 1. **users** (Perfil del Autónomo)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Datos personales
  nombre_completo VARCHAR(255) NOT NULL,
  nif VARCHAR(9) UNIQUE NOT NULL,

  -- Datos fiscales
  regimen_fiscal VARCHAR(50) DEFAULT 'TRADE', -- TRADE, General, Módulos
  fecha_alta_autonomo DATE NOT NULL,
  epigrafe_iae VARCHAR(10), -- e.g., "763" para programadores

  -- Configuración TRADE
  es_trade BOOLEAN DEFAULT true,
  porcentaje_dependencia DECIMAL(5,2) DEFAULT 75.00, -- % facturación de cliente principal
  tiene_local_alquilado BOOLEAN DEFAULT false,

  -- Configuración fiscal
  tipo_iva_predeterminado DECIMAL(4,2) DEFAULT 21.00,
  tipo_irpf_actual DECIMAL(4,2) DEFAULT 7.00, -- Nuevos autónomos 7%
  tipo_irpf_estimado DECIMAL(4,2) DEFAULT 21.00, -- Estimación para brecha IRPF

  -- Preferencias
  timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  idioma VARCHAR(5) DEFAULT 'es-ES',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_nif ON users(nif);
```

---

## 2. **clients** (Empresas que Facturan)
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos del cliente
  razon_social VARCHAR(255) NOT NULL,
  cif VARCHAR(9) NOT NULL,

  -- Dirección
  direccion TEXT,
  codigo_postal VARCHAR(10),
  ciudad VARCHAR(100),
  provincia VARCHAR(100),

  -- Contacto
  email VARCHAR(255),
  telefono VARCHAR(20),
  persona_contacto VARCHAR(255),

  -- Control TRADE
  es_cliente_principal BOOLEAN DEFAULT false, -- Solo uno puede ser true
  porcentaje_facturacion DECIMAL(5,2), -- Calculado automáticamente

  -- Estado
  activo BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_main_client_per_user UNIQUE (user_id, es_cliente_principal)
    WHERE es_cliente_principal = true
);

CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_clients_cif ON clients(cif);
```

---

## 3. **assets** (Bienes de Inversión)
```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos del bien
  nombre VARCHAR(255) NOT NULL, -- e.g., "MacBook Pro 2024"
  descripcion TEXT,
  categoria VARCHAR(100), -- Informático, Mobiliario, Vehículo, etc.

  -- Datos fiscales
  fecha_adquisicion DATE NOT NULL,
  importe_adquisicion DECIMAL(10,2) NOT NULL, -- Base imponible
  iva_soportado DECIMAL(10,2), -- 21% normalmente

  -- Amortización
  vida_util_anos INTEGER DEFAULT 5, -- Ej: ordenadores 5 años
  porcentaje_amortizacion_anual DECIMAL(5,2), -- e.g., 20% si 5 años
  amortizacion_acumulada DECIMAL(10,2) DEFAULT 0.00,

  -- Control
  numero_factura VARCHAR(100),
  proveedor VARCHAR(255),

  -- Estado
  activo BOOLEAN DEFAULT true,
  fecha_baja DATE,
  motivo_baja TEXT, -- Venta, robo, obsoleto, etc.

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_fecha ON assets(fecha_adquisicion);
```

---

## 4. **expenses** (Gastos con OCR)
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos básicos
  concepto VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) NOT NULL, -- Alquiler, Suministros, Material, Formación, etc.

  -- Datos fiscales
  fecha_emision DATE NOT NULL,
  numero_factura VARCHAR(100),
  proveedor_nombre VARCHAR(255) NOT NULL,
  proveedor_cif VARCHAR(9),

  -- Importes (en céntimos para precisión)
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2), -- IVA deducible
  tipo_irpf DECIMAL(4,2) DEFAULT 0.00, -- 19% en alquileres
  cuota_irpf DECIMAL(10,2), -- IRPF retenido (recuperable)
  total_factura DECIMAL(10,2) NOT NULL,

  -- Deducibilidad
  porcentaje_deducible DECIMAL(5,2) DEFAULT 100.00, -- Algunos gastos solo parcialmente deducibles
  es_deducible BOOLEAN DEFAULT true,
  motivo_no_deducible TEXT,

  -- Control TRADE
  es_gasto_independencia BOOLEAN DEFAULT false, -- Alquiler, luz, internet a nombre propio
  nivel_riesgo VARCHAR(20) DEFAULT 'BAJO', -- BAJO, MEDIO, ALTO (comidas fines de semana = ALTO)
  notas_riesgo TEXT,

  -- OCR Data
  ocr_procesado BOOLEAN DEFAULT false,
  ocr_confianza DECIMAL(3,2), -- 0.00 a 1.00
  ocr_texto_completo TEXT,
  ocr_datos_extraidos JSONB, -- JSON con campos extraídos
  ocr_requiere_revision BOOLEAN DEFAULT false,

  -- Archivo
  archivo_url TEXT, -- Ruta al PDF/imagen
  archivo_nombre VARCHAR(255),
  archivo_tipo VARCHAR(50), -- pdf, jpg, png

  -- Estado
  estado VARCHAR(50) DEFAULT 'PENDIENTE', -- PENDIENTE, VALIDADO, RECHAZADO
  pagado BOOLEAN DEFAULT false,
  fecha_pago DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_fecha ON expenses(fecha_emision);
CREATE INDEX idx_expenses_categoria ON expenses(categoria);
CREATE INDEX idx_expenses_deducible ON expenses(es_deducible);
CREATE INDEX idx_expenses_independencia ON expenses(es_gasto_independencia);
```

---

## 5. **invoices** (Facturas Emitidas)
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,

  -- Numeración
  numero_factura VARCHAR(50) UNIQUE NOT NULL, -- e.g., "2024-001"
  serie VARCHAR(10) DEFAULT 'A',

  -- Fechas
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  periodo_facturacion_inicio DATE, -- Para facturas mensuales
  periodo_facturacion_fin DATE,

  -- Concepto
  concepto TEXT NOT NULL, -- e.g., "Servicios de desarrollo software - Enero 2024"
  descripcion_detallada TEXT,

  -- Importes (precisión céntimos)
  base_imponible DECIMAL(10,2) NOT NULL,
  tipo_iva DECIMAL(4,2) DEFAULT 21.00,
  cuota_iva DECIMAL(10,2) NOT NULL,
  tipo_irpf DECIMAL(4,2) DEFAULT 7.00, -- 7% nuevos autónomos, 15% general
  cuota_irpf DECIMAL(10,2) NOT NULL,
  total_factura DECIMAL(10,2) NOT NULL, -- base + IVA - IRPF

  -- Cálculo: total = base_imponible + cuota_iva - cuota_irpf
  -- Ejemplo: 1000€ base + 210€ IVA (21%) - 70€ IRPF (7%) = 1140€ total

  -- Estado de pago
  estado VARCHAR(50) DEFAULT 'PENDIENTE', -- PENDIENTE, PAGADA, VENCIDA, CANCELADA
  pagada BOOLEAN DEFAULT false,
  fecha_pago DATE,
  metodo_pago VARCHAR(50), -- Transferencia, etc.

  -- Archivo generado
  pdf_url TEXT,
  pdf_generado BOOLEAN DEFAULT false,

  -- Envío
  enviada_cliente BOOLEAN DEFAULT false,
  fecha_envio DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_fecha ON invoices(fecha_emision);
CREATE INDEX idx_invoices_numero ON invoices(numero_factura);
CREATE INDEX idx_invoices_estado ON invoices(estado);
```

---

## 6. **tax_calculations** (Cálculos Trimestrales IVA/IRPF)
```sql
CREATE TABLE tax_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Periodo
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  ano INTEGER NOT NULL,
  modelo VARCHAR(10) NOT NULL, -- '303' (IVA), '130' (IRPF estimación directa), '115' (retenciones)

  -- IVA (Modelo 303)
  iva_repercutido DECIMAL(10,2) DEFAULT 0.00, -- IVA cobrado (facturas emitidas)
  iva_soportado DECIMAL(10,2) DEFAULT 0.00, -- IVA pagado (gastos)
  iva_resultado DECIMAL(10,2), -- Positivo = a pagar, Negativo = a compensar

  -- IRPF (Modelo 130)
  ingresos_totales DECIMAL(10,2) DEFAULT 0.00,
  gastos_deducibles DECIMAL(10,2) DEFAULT 0.00,
  rendimiento_neto DECIMAL(10,2), -- ingresos - gastos
  retencion_practicada DECIMAL(10,2) DEFAULT 0.00, -- IRPF ya retenido
  pago_fraccionado DECIMAL(10,2), -- 20% del rendimiento - retención

  -- Retenciones practicadas (Modelo 115) - si contratas subcontratistas
  retenciones_profesionales DECIMAL(10,2) DEFAULT 0.00,

  -- Estado
  calculado_automaticamente BOOLEAN DEFAULT true,
  presentado_aeat BOOLEAN DEFAULT false,
  fecha_presentacion DATE,
  justificante_url TEXT,

  -- Metadatos
  notas TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_tax_period UNIQUE (user_id, trimestre, ano, modelo)
);

CREATE INDEX idx_tax_calcs_user ON tax_calculations(user_id);
CREATE INDEX idx_tax_calcs_periodo ON tax_calculations(ano, trimestre);
```

---

## 7. **compliance_alerts** (Alertas de Cumplimiento TRADE)
```sql
CREATE TABLE compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo de alerta
  tipo VARCHAR(100) NOT NULL, -- 'FALTA_GASTO_INDEPENDENCIA', 'EXCESO_DEPENDENCIA', 'GASTO_ALTO_RIESGO'
  severidad VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'CRITICAL'

  -- Mensaje
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  recomendacion TEXT,

  -- Contexto
  periodo_mes INTEGER, -- Mes al que aplica (1-12)
  periodo_ano INTEGER,

  -- Referencias
  related_expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  related_invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Estado
  leida BOOLEAN DEFAULT false,
  resuelta BOOLEAN DEFAULT false,
  fecha_resolucion TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON compliance_alerts(user_id);
CREATE INDEX idx_alerts_leida ON compliance_alerts(leida);
CREATE INDEX idx_alerts_severidad ON compliance_alerts(severidad);
```

---

## 8. **fiscal_events** (Calendario Fiscal)
```sql
CREATE TABLE fiscal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Evento
  tipo VARCHAR(50) NOT NULL, -- 'MODELO_303', 'MODELO_130', 'MODELO_390', 'MODELO_180', etc.
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Fechas
  fecha_limite DATE NOT NULL,
  fecha_recordatorio DATE, -- 5 días antes

  -- Periodo al que aplica
  trimestre INTEGER CHECK (trimestre BETWEEN 1 AND 4),
  mes INTEGER CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,

  -- Estado
  completado BOOLEAN DEFAULT false,
  fecha_completado DATE,

  -- Notificaciones
  notificacion_enviada BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fiscal_events_user ON fiscal_events(user_id);
CREATE INDEX idx_fiscal_events_fecha ON fiscal_events(fecha_limite);
CREATE INDEX idx_fiscal_events_completado ON fiscal_events(completado);
```

---

## 9. **bank_accounts** (Cuentas Bancarias)
```sql
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos bancarios
  banco VARCHAR(255) NOT NULL,
  iban VARCHAR(34) UNIQUE NOT NULL,
  alias VARCHAR(100), -- e.g., "Cuenta Autónomo Santander"

  -- Balance
  saldo_actual DECIMAL(10,2) DEFAULT 0.00,
  fecha_ultimo_balance DATE DEFAULT NOW(),

  -- Control
  cuenta_principal BOOLEAN DEFAULT false,
  activa BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user ON bank_accounts(user_id);
```

---

## 10. **cash_flow_snapshots** (Instantáneas Balance Real)
```sql
CREATE TABLE cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Fecha snapshot
  fecha_snapshot DATE NOT NULL DEFAULT NOW(),

  -- Balance bancario
  saldo_bancario_total DECIMAL(10,2) NOT NULL,

  -- Obligaciones pendientes
  iva_pendiente_pagar DECIMAL(10,2) DEFAULT 0.00, -- IVA repercutido no ingresado a AEAT
  irpf_brecha DECIMAL(10,2) DEFAULT 0.00, -- Diferencia entre 7% retenido y ~21% estimado
  seguridad_social_pendiente DECIMAL(10,2) DEFAULT 0.00,

  -- Balance real
  balance_real DECIMAL(10,2), -- saldo - iva_pendiente - irpf_brecha - ss_pendiente

  -- Contexto
  ingresos_acumulados_ano DECIMAL(10,2) DEFAULT 0.00,
  gastos_acumulados_ano DECIMAL(10,2) DEFAULT 0.00,
  beneficio_neto_estimado DECIMAL(10,2),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cash_flow_user ON cash_flow_snapshots(user_id);
CREATE INDEX idx_cash_flow_fecha ON cash_flow_snapshots(fecha_snapshot);
```

---

## 11. **scenario_simulations** (Simulador de Escenarios)
```sql
CREATE TABLE scenario_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Escenario
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Parámetros simulados
  ingresos_cliente_principal DECIMAL(10,2),
  ingresos_cliente_secundario DECIMAL(10,2),
  gastos_mensuales_adicionales DECIMAL(10,2),

  -- Resultados
  nuevo_porcentaje_dependencia DECIMAL(5,2),
  cumple_trade BOOLEAN,
  riesgo_score INTEGER, -- 0-100

  -- Impacto fiscal
  iva_anual_estimado DECIMAL(10,2),
  irpf_anual_estimado DECIMAL(10,2),
  beneficio_neto_anual_estimado DECIMAL(10,2),

  -- Recomendaciones
  recomendaciones TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulations_user ON scenario_simulations(user_id);
```

---

## Relaciones Clave

### Dependencias TRADE:
- **users.es_trade** → Activa validaciones especiales
- **clients.es_cliente_principal** → Solo uno permitido, controla % dependencia
- **expenses.es_gasto_independencia** → Alquiler/Luz a nombre propio (obligatorio TRADE)
- **compliance_alerts** → Se generan automáticamente al detectar incumplimientos

### Flujo IVA:
- **invoices.cuota_iva** (repercutido) → `tax_calculations.iva_repercutido`
- **expenses.cuota_iva** (soportado) → `tax_calculations.iva_soportado`
- **Resultado** → `iva_repercutido - iva_soportado` = A pagar/compensar

### Flujo IRPF:
- **invoices.cuota_irpf** (retenido 7%) → Recuperable en Renta
- **tax_calculations.rendimiento_neto** → `ingresos - gastos`
- **Brecha IRPF** → `(rendimiento_neto * 0.21) - retención_practicada_7%`

### Balance Real:
```
Balance Real = Saldo Bancario
             - IVA Pendiente Pagar
             - Brecha IRPF (14% adicional)
             - Seguridad Social Pendiente
```

---

## Triggers y Funciones Útiles

### 1. Auto-actualizar `updated_at`:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- (Repetir para cada tabla)
```

### 2. Validar precisión céntimos:
```sql
CREATE OR REPLACE FUNCTION validate_invoice_calculations()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar cuota_iva
  IF ABS(NEW.cuota_iva - (NEW.base_imponible * NEW.tipo_iva / 100)) > 0.01 THEN
    RAISE EXCEPTION 'IVA calculation error: expected %, got %',
      (NEW.base_imponible * NEW.tipo_iva / 100), NEW.cuota_iva;
  END IF;

  -- Validar total
  IF ABS(NEW.total_factura - (NEW.base_imponible + NEW.cuota_iva - NEW.cuota_irpf)) > 0.01 THEN
    RAISE EXCEPTION 'Total calculation error';
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_invoice_before_insert
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION validate_invoice_calculations();
```

### 3. Auto-generar eventos fiscales:
```sql
-- Función para generar calendario fiscal automático al crear usuario
CREATE OR REPLACE FUNCTION generate_fiscal_calendar(p_user_id UUID, p_year INTEGER)
RETURNS void AS $$
BEGIN
  -- Modelo 303 (IVA trimestral): 20 de abril, julio, octubre, enero
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, trimestre, ano)
  VALUES
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 1T',
     DATE(p_year || '-04-20'), 1, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 2T',
     DATE(p_year || '-07-20'), 2, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 3T',
     DATE(p_year || '-10-20'), 3, p_year),
    (p_user_id, 'MODELO_303', 'Modelo 303 - IVA 4T',
     DATE((p_year + 1) || '-01-20'), 4, p_year);

  -- Modelo 130 (IRPF trimestral): mismas fechas
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, trimestre, ano)
  VALUES
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 1T',
     DATE(p_year || '-04-20'), 1, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 2T',
     DATE(p_year || '-07-20'), 2, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 3T',
     DATE(p_year || '-10-20'), 3, p_year),
    (p_user_id, 'MODELO_130', 'Modelo 130 - IRPF 4T',
     DATE((p_year + 1) || '-01-20'), 4, p_year);

  -- Modelo 390 (Resumen anual IVA): 30 de enero
  INSERT INTO fiscal_events (user_id, tipo, titulo, fecha_limite, ano)
  VALUES
    (p_user_id, 'MODELO_390', 'Modelo 390 - Resumen Anual IVA',
     DATE((p_year + 1) || '-01-30'), p_year);
END;
$$ language 'plpgsql';
```

---

## Índices para Optimización

```sql
-- Búsquedas frecuentes por periodo
CREATE INDEX idx_expenses_user_fecha ON expenses(user_id, fecha_emision);
CREATE INDEX idx_invoices_user_fecha ON invoices(user_id, fecha_emision);

-- Filtros comunes
CREATE INDEX idx_expenses_pagado ON expenses(user_id, pagado);
CREATE INDEX idx_invoices_pagada ON invoices(user_id, pagada);

-- Búsqueda de texto en OCR (usando GIN para JSONB)
CREATE INDEX idx_expenses_ocr_data ON expenses USING GIN (ocr_datos_extraidos);
```

---

Este esquema está listo para manejar todos los requisitos fiscales españoles con precisión de céntimos y trazabilidad completa para auditorías AEAT.

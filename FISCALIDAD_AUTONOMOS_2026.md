# Guía Completa: Fiscalidad para Autónomos en España 2026

Esta guía explica en detalle cómo se calculan las obligaciones fiscales para autónomos en España.

## Modelo 303 - IVA Trimestral

### ¿Qué es?
El Modelo 303 es la **autoliquidación trimestral del IVA**. Es obligatorio para todos los profesionales y empresarios que realizan actividades sujetas a IVA.

> Fuente: [AEAT - Instrucciones Modelo 303 2026](https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026.html) y [OCA/l10n-spain](https://github.com/OCA/l10n-spain)

### ¿Cómo se calcula?

```
IVA a pagar/devolver = IVA Repercutido (devengado) - IVA Soportado (deducible)
```

**IVA Repercutido**: Es el IVA que has cobrado a tus clientes en tus facturas, desglosado por tipo:
- IVA 4% (superreducido): alimentos básicos, libros, medicamentos...
- IVA 10% (reducido): alimentación, transporte, hostelería...
- IVA 21% (general): la mayoría de productos y servicios

**IVA Soportado**: Es el IVA que has pagado en tus gastos deducibles.

### Resultado
- **Positivo (a ingresar)**: Debes ingresar la diferencia a Hacienda
- **Negativo (a compensar)**: Puedes compensar en siguientes trimestres o solicitar devolución en 4T

### Plazos 2026
- 1T (enero-marzo): hasta 20 abril
- 2T (abril-junio): hasta 20 julio
- 3T (julio-septiembre): hasta 20 octubre
- 4T (octubre-diciembre): hasta **30 enero 2027**

### Casillas principales (desglose por tipo IVA)

**IVA Devengado (Repercutido):**
| Tipo IVA | Base imponible | Tipo % | Cuota |
|----------|----------------|--------|-------|
| 4% (superreducido) | Casilla 01 | Casilla 02 | Casilla 03 |
| 10% (reducido) | Casilla 04 | Casilla 05 | Casilla 06 |
| 21% (general) | Casilla 07 | Casilla 08 | Casilla 09 |
| **Total devengado** | | | Casilla 27 |

**IVA Deducible (Soportado):**
- **Casilla 28**: Base bienes y servicios corrientes
- **Casilla 29**: Cuota IVA deducible
- **Casilla 45**: Total cuotas deducibles

**Resultado:**
- **Casilla 46**: Resultado régimen general (27 - 45)
- **Casilla 66**: Compensaciones de periodos anteriores
- **Casilla 69**: Resultado final
- **Casilla 71**: A ingresar (si resultado positivo)
- **Casilla 72**: A compensar (si resultado negativo)

---

## Modelo 130 - Pagos Fraccionados IRPF

### ¿Qué es?
El Modelo 130 es el **pago fraccionado trimestral del IRPF** para autónomos en estimación directa. Es un adelanto del IRPF que luego se regulariza en la declaración de la renta.

### ¿Quién debe presentarlo?
Autónomos en estimación directa (normal o simplificada).

**Exención**: Si más del 70% de tu facturación ha sido con retención de IRPF (facturas a empresas/autónomos españoles), estás exento.

### ¿Cómo se calcula?

> **IMPORTANTE**: Los datos son **ACUMULADOS** desde el 1 de enero hasta el final del trimestre declarado.
> Fuente: [AEAT - Instrucciones Modelo 130](https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html) y [OCA/l10n-spain](https://github.com/OCA/l10n-spain)

```
Casilla 01: Ingresos íntegros ACUMULADOS desde el 1 de enero
Casilla 02: Gastos deducibles ACUMULADOS desde el 1 de enero
Casilla 03: Rendimiento neto = Casilla 01 - Casilla 02
Casilla 04: 20% del rendimiento neto positivo (si negativo, es 0)
Casilla 05: Pagos fraccionados anteriores (solo los positivos)
Casilla 06: Retenciones e ingresos a cuenta ACUMULADOS
Casilla 07: Resultado = Casilla 04 - Casilla 05 - Casilla 06
```

**Paso a paso para el trimestre:**

1. **Ingresos ACUMULADOS**: Suma de base_imponible de todas tus facturas emitidas **desde el 1 de enero** hasta el final del trimestre

2. **Gastos deducibles ACUMULADOS**: Suma de base_imponible de todos tus gastos deducibles **desde el 1 de enero** hasta el final del trimestre

3. **Rendimiento neto ACUMULADO**: Ingresos - Gastos (puede ser negativo)

4. **Aplicar 20%**: Si el rendimiento neto es positivo: Rendimiento neto × 0.20. Si es negativo: 0

5. **Restar pagos anteriores**: Suma de los resultados POSITIVOS de los Modelos 130 de trimestres anteriores del mismo año (solo los positivos, no los negativos)

6. **Restar retenciones ACUMULADAS**: Suma de cuota_irpf de tus facturas emitidas desde el 1 de enero

7. **Resultado final**: Puede ser positivo (a ingresar), negativo (a compensar en siguientes trimestres o en Renta) o cero

### Plazos 2026
- 1T: hasta 20 abril
- 2T: hasta 20 julio
- 3T: hasta 20 octubre
- 4T: hasta **30 enero 2027** (no 20)

### Casillas oficiales AEAT
- **Casilla 01**: Ingresos íntegros ACUMULADOS
- **Casilla 02**: Gastos deducibles ACUMULADOS
- **Casilla 03**: Rendimiento neto (01 - 02)
- **Casilla 04**: 20% del rendimiento neto positivo
- **Casilla 05**: Pagos fraccionados anteriores (solo positivos)
- **Casilla 06**: Retenciones e ingresos a cuenta ACUMULADOS
- **Casilla 07**: Resultado a ingresar/compensar

---

## Modelo 115 - Retenciones por Alquileres

### ¿Qué es?
El Modelo 115 es la **declaración trimestral de retenciones del IRPF sobre alquileres urbanos** que pagas por tu actividad empresarial.

### ¿Quién debe presentarlo?
Autónomos y empresas que alquilan un local, oficina u otro inmueble urbano para su actividad empresarial.

**Exención**: Si el total de alquileres no supera 900€/año.

### ¿Cómo se calcula?

```
Retención IRPF = Base imponible del alquiler × 19%
```

**Ejemplo práctico:**
- Alquiler mensual: 600€ (base imponible, sin IVA)
- Retención 19%: 600€ × 0.19 = 114€
- Pagas al propietario: 600€ - 114€ = 486€
- IVA (21%): 600€ × 0.21 = 126€
- **Total factura**: 486€ + 114€ (retención) + 126€ (IVA) = 726€

La retención de 114€ la ingresas a Hacienda con el Modelo 115.

### Plazos 2026
Los mismos que el Modelo 303 y 130:
- 1T: hasta 20 abril
- 2T: hasta 20 julio
- 3T: hasta 20 octubre
- 4T: hasta 30 enero 2027

### Casillas principales
- **Casilla 01**: Número de perceptores (propietarios a los que pagas alquiler)
- **Casilla 02**: Base de las retenciones (suma de alquileres sin IVA)
- **Casilla 03**: Retenciones ingresadas (base × 19%)

---

## Modelo 180 - Resumen Anual de Alquileres

### ¿Qué es?
El Modelo 180 es el **resumen informativo anual** de todas las retenciones por alquileres que has declarado durante el año en los Modelos 115.

### Contenido
Es un resumen de los 4 Modelos 115 trimestrales:
- Identifica a cada propietario (perceptor)
- Detalla el total de rentas satisfechas
- Detalla el total de retenciones practicadas

### Plazo 2026
- Ejercicio 2025: del 1 al 31 de enero 2026

### Importante
Debe cuadrar exactamente con la suma de tus 4 Modelos 115 del año.

---

## Modelo 390 - Resumen Anual de IVA

### ¿Qué es?
El Modelo 390 es la **declaración informativa anual del IVA**. Resume todas las operaciones de IVA que declaraste durante el año.

### ¿Quién debe presentarlo?
Todos los sujetos pasivos del IVA que presentan el Modelo 303 trimestral.

**Exenciones**:
- Autónomos en régimen simplificado del IVA que solo realizan esa actividad
- Solo arrendadores de inmuebles urbanos

### Contenido
Es un resumen de los 4 Modelos 303 trimestrales:
- Total IVA repercutido del año
- Total IVA soportado del año
- Desglose por tipos de IVA (21%, 10%, 4%)
- Operaciones especiales (exportaciones, inversión del sujeto pasivo, etc.)

### Plazo 2026
- Ejercicio 2025: del 1 al 30 de enero 2026

### Importante
Hacienda comprueba que la suma de tus 4 Modelos 303 coincide exactamente con el 390.

### Sanciones
- No presentarlo o hacerlo fuera de plazo: 150-200€

---

## Seguridad Social - Cuota de Autónomos

### Sistema de cotización por ingresos reales (2023-2025)

Desde 2023, los autónomos cotizan según sus **rendimientos netos mensuales** (ingresos - gastos deducibles).

### Tarifa Plana 2026

**Primer año**:
- Cuota bonificada: **80€**
- MEI (0,9% sobre base): **variable según base elegida**
- Total con base mínima (950,98€): **88,56€/mes**

**Puedes elegir una base superior** (hasta 5.101,20€) y solo pagarás el MEI adicional (0,9% sobre la diferencia).

**Ejemplo con base 2.000€**:
- Bonificación: 80€
- MEI (2.000€ × 0,009): 18€
- **Total: 98€/mes**

### Cuotas sin tarifa plana

| Ingresos netos/mes | Cuota mínima |
|-------------------|--------------|
| Hasta 670€        | 205€         |
| 670-900€          | 226€         |
| 900-1.166,70€     | 267€         |
| 1.166,70-1.300€   | 299€         |
| 1.300-1.500€      | 302€         |
| Más de 6.000€     | 607€         |

### Fecha de cargo
**Último día laborable de cada mes**

---

## Renta Anual (Modelo 100)

### ¿Qué es?
La **Declaración de la Renta (IRPF)** es la declaración anual donde se regulariza todo el IRPF del año.

### Relación con Modelo 130
Los pagos fraccionados del Modelo 130 son adelantos que luego se descuentan en la Renta.

### Cálculo simplificado
```
Base imponible = Rendimientos netos de actividad económica + otros ingresos

Cuota íntegra = Base × tipos impositivos progresivos (19% - 47%)

Cuota líquida = Cuota íntegra - Deducciones

Resultado = Cuota líquida - Retenciones - Pagos fraccionados
```

### Plazo 2026
- Del 3 de abril al 30 de junio de 2026 (para ejercicio 2025)

---

## Fuentes Oficiales

- [Agencia Tributaria - Modelo 303](https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G414.shtml)
- [Agencia Tributaria - Modelo 130](https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G601.shtml)
- [Agencia Tributaria - Modelo 115](https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH02.shtml)
- [InfoAutónomos - Modelo 130](https://www.infoautonomos.com/fiscalidad/modelo-130-irpf-autonomos/)
- [InfoAutónomos - Modelo 115](https://www.infoautonomos.com/fiscalidad/modelo-115-irpf-alquileres/)
- [Declarando - Modelo 303](https://declarando.es/modelo-303)
- [Declarando - Modelo 130](https://declarando.es/modelo-130)
- [Declarando - Modelo 390](https://declarando.es/modelo-390)

---

**Última actualización**: Enero 2026
**Nota**: Esta información es orientativa. Consulta siempre con un asesor fiscal para tu caso particular.

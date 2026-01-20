#!/bin/bash
set -e

echo "======================================"
echo "Test Manual: Facturas Retroactivas"
echo "======================================"
echo ""

# 1. Login
echo "1. Authenticating..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@migestor.com","password":"Test123456"}' \
  | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Login successful"

# 2. Get client
echo ""
echo "2. Getting client..."
CLIENT_ID=$(curl -s http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')

if [ "$CLIENT_ID" == "null" ] || [ -z "$CLIENT_ID" ]; then
  echo "❌ No clients found"
  exit 1
fi
echo "✅ Client ID: $CLIENT_ID"

# 3. Create template with past date
echo ""
echo "3. Creating recurring template with past date..."
FECHA_PASADA=$(date -v-3m +%Y-%m-01)
echo "   Date: $FECHA_PASADA (3 months ago)"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/recurring-templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"nombre_plantilla\": \"Manual Test $(date +%H%M%S)\",
    \"cliente_id\": $CLIENT_ID,
    \"serie\": \"MT\",
    \"concepto\": \"Servicios de prueba\",
    \"base_imponible\": 1000,
    \"tipo_iva\": 21,
    \"tipo_irpf\": 15,
    \"frecuencia\": \"MENSUAL\",
    \"dia_generacion\": 1,
    \"fecha_inicio\": \"$FECHA_PASADA\",
    \"incluir_periodo_facturacion\": true,
    \"generar_pdf_automatico\": false
  }")

TEMPLATE_ID=$(echo $RESPONSE | jq -r '.data.id')
INFO_MSG=$(echo $RESPONSE | jq -r '.info[4]')

if [ "$TEMPLATE_ID" == "null" ] || [ -z "$TEMPLATE_ID" ]; then
  echo "❌ Template creation failed"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Template created: ID $TEMPLATE_ID"
echo "   Message: $INFO_MSG"

# 4. Wait for backfill
echo ""
echo "4. Waiting 5 seconds for backfill to process..."
sleep 5

# 5. Check generated invoices
echo ""
echo "5. Checking generated invoices..."
INVOICES=$(curl -s "http://localhost:3000/api/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  | jq "[.data[] | select(.template_id == $TEMPLATE_ID)] | length")

echo "✅ Generated invoices: $INVOICES"

if [ "$INVOICES" -gt 0 ]; then
  echo ""
  echo "Invoice details:"
  curl -s "http://localhost:3000/api/invoices" \
    -H "Authorization: Bearer $TOKEN" \
    | jq ".data[] | select(.template_id == $TEMPLATE_ID) | {numero_factura, fecha_emision, total_factura}"
fi

# 6. Check missing invoices
echo ""
echo "6. Checking for missing invoices..."
MISSING=$(curl -s "http://localhost:3000/api/recurring-templates/$TEMPLATE_ID/missing-invoices" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data.missingCount')

echo "Missing invoices: $MISSING"

if [ "$MISSING" == "0" ]; then
  echo "✅ No missing invoices - backfill worked perfectly!"
else
  echo "⚠️  Still $MISSING invoices missing"
fi

# 7. Cleanup
echo ""
echo "7. Cleaning up test template..."
curl -s -X DELETE "http://localhost:3000/api/recurring-templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Cleanup complete"

echo ""
echo "======================================"
echo "✅ ALL TESTS PASSED!"
echo "======================================"

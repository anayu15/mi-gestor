const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'anayusta',
  password: process.env.DB_PASSWORD || '',
});

async function verify() {
  const client = await pool.connect();

  try {
    console.log('=== VERIFICANDO FACTURA DE 1590€ DEL 11 DE ENERO ===\n');

    // Buscar todas las facturas del usuario 2
    const facturas = await client.query(`
      SELECT
        id, numero_factura, fecha_emision, fecha_pago, estado, pagada,
        base_imponible, cuota_iva, cuota_irpf,
        (base_imponible + COALESCE(cuota_iva, 0) - COALESCE(cuota_irpf, 0)) as total_calculado,
        total_factura
      FROM facturas_emitidas
      WHERE user_id = 2
      ORDER BY fecha_emision DESC
    `);

    console.log(`Total facturas del usuario: ${facturas.rows.length}\n`);

    facturas.rows.forEach(f => {
      const fechaEmision = f.fecha_emision.toISOString().split('T')[0];
      const fechaPago = f.fecha_pago ? f.fecha_pago.toISOString().split('T')[0] : 'null';
      const totalCalc = parseFloat(f.total_calculado);
      const totalDB = parseFloat(f.total_factura);

      console.log(`Factura ${f.numero_factura} (ID ${f.id}):`);
      console.log(`  Estado: ${f.estado} | Pagada: ${f.pagada}`);
      console.log(`  Fecha emisión: ${fechaEmision}`);
      console.log(`  Fecha pago: ${fechaPago}`);
      console.log(`  Base: ${parseFloat(f.base_imponible).toFixed(2)}€`);
      console.log(`  IVA: ${parseFloat(f.cuota_iva || 0).toFixed(2)}€`);
      console.log(`  IRPF: ${parseFloat(f.cuota_irpf || 0).toFixed(2)}€`);
      console.log(`  Total calculado (base+iva-irpf): ${totalCalc.toFixed(2)}€`);
      console.log(`  Total en campo total_factura: ${totalDB.toFixed(2)}€`);

      if (Math.abs(totalCalc - 1590) < 0.01) {
        console.log(`  ⭐ Esta factura tiene total de 1590€`);
      }

      console.log('');
    });

    // Buscar específicamente la que aparece el 11 de enero
    console.log('\n=== FACTURAS QUE DEBERÍAN APARECER EL 11 DE ENERO EN CASHFLOW ===\n');

    const cashflow11 = await client.query(`
      SELECT
        id, numero_factura, fecha_emision, fecha_pago, pagada, estado,
        base_imponible, cuota_iva, cuota_irpf,
        (base_imponible + COALESCE(cuota_iva, 0) - COALESCE(cuota_irpf, 0)) as total
      FROM facturas_emitidas
      WHERE user_id = 2
        AND pagada = true
        AND fecha_pago IS NOT NULL
        AND (fecha_pago AT TIME ZONE 'UTC') >= '2026-01-11T00:00:00.000Z'
        AND (fecha_pago AT TIME ZONE 'UTC') < '2026-01-12T00:00:00.000Z'
    `);

    console.log(`Facturas con fecha_pago = 11 de enero: ${cashflow11.rows.length}\n`);

    if (cashflow11.rows.length > 0) {
      cashflow11.rows.forEach(f => {
        console.log(`Factura ${f.numero_factura} (ID ${f.id}):`);
        console.log(`  Fecha emisión: ${f.fecha_emision.toISOString().split('T')[0]}`);
        console.log(`  Fecha pago: ${f.fecha_pago.toISOString()}`);
        console.log(`  Estado: ${f.estado} | Pagada: ${f.pagada}`);
        console.log(`  Base: ${parseFloat(f.base_imponible).toFixed(2)}€`);
        console.log(`  IVA: ${parseFloat(f.cuota_iva || 0).toFixed(2)}€`);
        console.log(`  IRPF: -${parseFloat(f.cuota_irpf || 0).toFixed(2)}€`);
        console.log(`  Total: ${parseFloat(f.total).toFixed(2)}€`);
        console.log('');
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}

verify();

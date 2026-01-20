import { query } from '../config/database';

async function testChatQueries() {
  console.log('🧪 Testing Chat Controller Database Queries\n');
  
  // First, get a valid user ID
  const usersResult = await query('SELECT id, email FROM users LIMIT 1');
  if (usersResult.rows.length === 0) {
    console.error('❌ No users found in the database');
    process.exit(1);
  }
  
  const userId = usersResult.rows[0].id;
  const year = new Date().getFullYear();
  
  console.log(`📋 Testing with User ID: ${userId}, Year: ${year}\n`);
  console.log('=' .repeat(60) + '\n');

  const tests = [
    {
      name: 'Invoices Summary',
      query: `
        SELECT 
          COUNT(*) as total_facturas,
          COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as facturas_pendientes,
          COUNT(*) FILTER (WHERE estado = 'PAGADA') as facturas_cobradas,
          COALESCE(SUM(total_factura), 0) as total_facturado,
          COALESCE(SUM(total_factura) FILTER (WHERE estado = 'PENDIENTE'), 0) as pendiente_cobro,
          COALESCE(SUM(total_factura) FILTER (WHERE estado = 'PAGADA'), 0) as cobrado
        FROM facturas_emitidas 
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      `,
      params: [userId, year]
    },
    {
      name: 'Recent Invoices',
      query: `
        SELECT f.numero_factura, c.nombre as cliente, f.total_factura, f.estado, f.fecha_emision
        FROM facturas_emitidas f
        LEFT JOIN clientes c ON f.cliente_id = c.id
        WHERE f.user_id = $1
        ORDER BY f.fecha_emision DESC
        LIMIT 5
      `,
      params: [userId]
    },
    {
      name: 'Expenses Summary',
      query: `
        SELECT 
          COUNT(*) as total_gastos,
          COALESCE(SUM(total_factura), 0) as total_gastado,
          COALESCE(SUM(cuota_iva), 0) as iva_soportado
        FROM expenses 
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      `,
      params: [userId, year]
    },
    {
      name: 'Recent Expenses',
      query: `
        SELECT concepto, categoria, total_factura, fecha_emision, proveedor_nombre
        FROM expenses 
        WHERE user_id = $1
        ORDER BY fecha_emision DESC
        LIMIT 5
      `,
      params: [userId]
    },
    {
      name: 'Clients List',
      query: `
        SELECT c.id, c.nombre, c.cif,
          COALESCE(SUM(f.total_factura) FILTER (WHERE EXTRACT(YEAR FROM f.fecha_emision) = $2), 0) as facturado_este_ano
        FROM clientes c
        LEFT JOIN facturas_emitidas f ON f.cliente_id = c.id
        WHERE c.user_id = $1 AND c.activo = true
        GROUP BY c.id
        ORDER BY facturado_este_ano DESC
        LIMIT 5
      `,
      params: [userId, year]
    },
    {
      name: 'IVA Repercutido',
      query: `
        SELECT COALESCE(SUM(cuota_iva), 0) as total 
        FROM facturas_emitidas 
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      `,
      params: [userId, year]
    },
    {
      name: 'IVA Soportado',
      query: `
        SELECT COALESCE(SUM(cuota_iva), 0) as total 
        FROM expenses 
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2 AND es_deducible = true
      `,
      params: [userId, year]
    },
    {
      name: 'IRPF Retenido',
      query: `
        SELECT COALESCE(SUM(cuota_irpf), 0) as irpf_retenido
        FROM facturas_emitidas 
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      `,
      params: [userId, year]
    },
    {
      name: 'Bank Balance',
      query: `
        SELECT COALESCE(SUM(saldo_actual), 0) as saldo_total 
        FROM bank_accounts 
        WHERE user_id = $1 AND activa = true
      `,
      params: [userId]
    },
    {
      name: 'Documents Summary',
      query: `
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(*) FILTER (WHERE categoria = 'CONTRATO') as contratos,
          COUNT(*) FILTER (WHERE categoria = 'FACTURA_GASTO') as facturas_gasto,
          COUNT(*) FILTER (WHERE categoria = 'FACTURA_INGRESO') as facturas_ingreso
        FROM documents 
        WHERE user_id = $1 AND estado = 'ACTIVO'
      `,
      params: [userId]
    },
    {
      name: 'Programaciones',
      query: `
        SELECT p.nombre, p.tipo, p.periodicidad, 
          COALESCE((p.datos_base->>'importe_base')::numeric, 0) as importe_base,
          p.fecha_inicio
        FROM programaciones p
        WHERE p.user_id = $1
        ORDER BY p.fecha_inicio DESC
        LIMIT 5
      `,
      params: [userId]
    },
    {
      name: 'Monthly Income',
      query: `
        SELECT 
          EXTRACT(MONTH FROM fecha_emision) as mes,
          COALESCE(SUM(base_imponible), 0) as ingresos
        FROM facturas_emitidas
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
        GROUP BY EXTRACT(MONTH FROM fecha_emision)
        ORDER BY mes
      `,
      params: [userId, year]
    },
    {
      name: 'Monthly Expenses',
      query: `
        SELECT 
          EXTRACT(MONTH FROM fecha_emision) as mes,
          COALESCE(SUM(total_factura), 0) as gastos
        FROM expenses
        WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
        GROUP BY EXTRACT(MONTH FROM fecha_emision)
        ORDER BY mes
      `,
      params: [userId, year]
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      const result = await query(test.query, test.params);
      console.log(`   ✅ Success - ${result.rows.length} row(s) returned`);
      if (result.rows.length > 0) {
        console.log(`   📊 Sample: ${JSON.stringify(result.rows[0])}`);
      }
      passed++;
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      console.log(`   📝 Query: ${test.query.substring(0, 100)}...`);
      failed++;
    }
    console.log('');
  }

  console.log('=' .repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ Some queries failed. Check the database schema.');
    process.exit(1);
  } else {
    console.log('✅ All queries passed successfully!');
    process.exit(0);
  }
}

testChatQueries().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QG1pZ2VzdG9yLmNvbSIsIm5vbWJyZV9jb21wbGV0byI6IlRlc3QgVXNlciBUUkFERSIsImVzX3RyYWRlIjp0cnVlLCJpYXQiOjE3NjgwODQyMTIsImV4cCI6MTc2ODY4OTAxMn0.L6kHrb5A8Azhrex6Av33TR1Af1KoQXrnSFDWOXPWI9g';

async function checkCashflow() {
  const response = await fetch('http://localhost:3000/api/cashflow/daily?start=2026-01-01&end=2026-01-31', {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const data = await response.json();

  console.log('Response status:', response.status);
  console.log('Response data:', JSON.stringify(data, null, 2));

  if (!data.data || !data.data.daily_data) {
    console.log('ERROR: No se pudo obtener data.daily_data');
    return;
  }

  console.log('=== CASHFLOW DE ENERO 2026 (CORREGIDO) ===\n');

  data.data.daily_data.forEach(day => {
    if (day.movimiento !== 0) {
      console.log(`${day.fecha}: ${day.transacciones} transacciones - Movimiento: ${day.movimiento}€`);
    }
  });

  console.log('\n=== RESUMEN ===');
  console.log(`Saldo inicial: ${data.data.summary.saldo_inicial}€`);
  console.log(`Total ingresos: ${data.data.summary.total_ingresos}€`);
  console.log(`Total gastos: ${data.data.summary.total_gastos}€`);
  console.log(`Saldo final: ${data.data.summary.saldo_final}€`);
}

checkCashflow();

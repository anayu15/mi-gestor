const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QG1pZ2VzdG9yLmNvbSIsIm5vbWJyZV9jb21wbGV0byI6IlRlc3QgVXNlciBUUkFERSIsImVzX3RyYWRlIjp0cnVlLCJpYXQiOjE3NjgwODQyMTIsImV4cCI6MTc2ODY4OTAxMn0.L6kHrb5A8Azhrex6Av33TR1Af1KoQXrnSFDWOXPWI9g';

async function checkCashflow() {
  const response = await fetch('http://localhost:3000/api/cashflow/daily?start=2026-01-01&end=2026-01-31', {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const data = await response.json();

  if (!data.success) {
    console.log('ERROR:', data.error);
    return;
  }

  console.log('=== CASHFLOW DE ENERO 2026 (CORREGIDO) ===\n');

  data.data.flujo_diario.forEach(day => {
    if (day.movimiento !== 0) {
      console.log(`${day.fecha}:`);
      console.log(`  Ingresos: ${day.ingresos}€ (reales: ${day.ingresos_reales}€, potenciales: ${day.ingresos_potenciales}€)`);
      console.log(`  Gastos: ${day.gastos}€ (reales: ${day.gastos_reales}€, potenciales: ${day.gastos_potenciales}€)`);
      console.log(`  Movimiento: ${day.movimiento}€`);
      console.log(`  Saldo acumulado: ${day.saldo}€`);
      console.log('');
    }
  });

  const lastDay = data.data.flujo_diario[data.data.flujo_diario.length - 1];
  console.log('=== RESUMEN DEL MES ===');
  console.log(`Saldo inicial: ${data.data.saldo_inicial}€`);
  console.log(`Saldo final: ${lastDay.saldo}€`);
}

checkCashflow();

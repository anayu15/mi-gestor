import { query } from '../config/database';

async function verifyTemplates() {
  try {
    console.log('🔍 Verificando plantillas recurrentes en la base de datos...\n');

    // Check templates
    const templatesResult = await query(`
      SELECT
        rt.id,
        rt.nombre_plantilla,
        rt.frecuencia,
        rt.tipo_dia_generacion,
        rt.dia_generacion,
        rt.proxima_generacion,
        rt.activo,
        rt.pausado,
        c.nombre as cliente_nombre,
        u.email as usuario_email,
        rt.created_at
      FROM recurring_invoice_templates rt
      INNER JOIN clientes c ON rt.cliente_id = c.id
      INNER JOIN usuarios u ON rt.user_id = u.id
      ORDER BY rt.created_at DESC
      LIMIT 10;
    `);

    if (templatesResult.rows.length === 0) {
      console.log('⚠️  No hay plantillas recurrentes en la base de datos\n');
      console.log('💡 Puedes crear una desde: http://localhost:3001/facturas/recurrentes/nueva\n');
    } else {
      console.log(`✅ Encontradas ${templatesResult.rows.length} plantilla(s):\n`);

      templatesResult.rows.forEach((template, index) => {
        console.log(`${index + 1}. "${template.nombre_plantilla}"`);
        console.log(`   ID: ${template.id}`);
        console.log(`   Usuario: ${template.usuario_email}`);
        console.log(`   Cliente: ${template.cliente_nombre}`);
        console.log(`   Frecuencia: ${template.frecuencia}`);
        console.log(`   Tipo día: ${template.tipo_dia_generacion}`);
        if (template.tipo_dia_generacion === 'DIA_ESPECIFICO') {
          console.log(`   Día generación: ${template.dia_generacion}`);
        }
        console.log(`   Próxima generación: ${new Date(template.proxima_generacion).toLocaleDateString('es-ES')}`);
        console.log(`   Estado: ${template.activo ? (template.pausado ? 'Pausado' : 'Activo') : 'Inactivo'}`);
        console.log(`   Creado: ${new Date(template.created_at).toLocaleString('es-ES')}`);
        console.log('');
      });
    }

    // Count by type
    const countByType = await query(`
      SELECT tipo_dia_generacion, COUNT(*) as total
      FROM recurring_invoice_templates
      GROUP BY tipo_dia_generacion
      ORDER BY total DESC;
    `);

    if (countByType.rows.length > 0) {
      console.log('📊 Distribución por tipo de día:');
      countByType.rows.forEach(row => {
        console.log(`   ${row.tipo_dia_generacion}: ${row.total} plantilla(s)`);
      });
      console.log('');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyTemplates();

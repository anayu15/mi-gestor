import { Request, Response } from 'express';
import OpenAI from 'openai';
import { query } from '../config/database';
import config from '../config';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Lazy initialization of OpenRouter client
let openrouter: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouter) {
    const apiKey = config.vision.openrouterApiKey;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    openrouter = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return openrouter;
}

// Best model for conversational AI with context understanding
const CHAT_MODEL = 'anthropic/claude-sonnet-4';

// Helper to get current year
const getCurrentYear = () => new Date().getFullYear();

// Fetch all relevant financial context for the user
async function getFinancialContext(userId: number): Promise<string> {
  const year = getCurrentYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  try {
    // Get invoices summary
    const invoicesResult = await query(`
      SELECT 
        COUNT(*) as total_facturas,
        COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as facturas_pendientes,
        COUNT(*) FILTER (WHERE estado = 'PAGADA') as facturas_cobradas,
        COALESCE(SUM(total_factura), 0) as total_facturado,
        COALESCE(SUM(total_factura) FILTER (WHERE estado = 'PENDIENTE'), 0) as pendiente_cobro,
        COALESCE(SUM(total_factura) FILTER (WHERE estado = 'PAGADA'), 0) as cobrado
      FROM facturas_emitidas 
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
    `, [userId, year]);
    const invoicesSummary = invoicesResult.rows[0];

    // Get recent invoices with client names
    const recentInvoicesResult = await query(`
      SELECT f.numero_factura, c.nombre as cliente, f.total_factura, f.estado, f.fecha_emision, f.fecha_vencimiento
      FROM facturas_emitidas f
      LEFT JOIN clientes c ON f.cliente_id = c.id
      WHERE f.user_id = $1
      ORDER BY f.fecha_emision DESC
      LIMIT 10
    `, [userId]);
    const recentInvoices = recentInvoicesResult.rows;

    // Get expenses summary
    const expensesResult = await query(`
      SELECT 
        COUNT(*) as total_gastos,
        COALESCE(SUM(total_factura), 0) as total_gastado,
        COALESCE(SUM(cuota_iva), 0) as iva_soportado
      FROM expenses 
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
    `, [userId, year]);
    const expensesSummary = expensesResult.rows[0];

    // Get recent expenses
    const recentExpensesResult = await query(`
      SELECT concepto, categoria, total_factura, fecha_emision, proveedor_nombre
      FROM expenses 
      WHERE user_id = $1
      ORDER BY fecha_emision DESC
      LIMIT 10
    `, [userId]);
    const recentExpenses = recentExpensesResult.rows;

    // Get clients list with billing
    const clientsResult = await query(`
      SELECT c.id, c.nombre, c.cif,
        COALESCE(SUM(f.total_factura) FILTER (WHERE EXTRACT(YEAR FROM f.fecha_emision) = $2), 0) as facturado_este_ano,
        COUNT(f.id) FILTER (WHERE EXTRACT(YEAR FROM f.fecha_emision) = $2) as facturas_este_ano
      FROM clientes c
      LEFT JOIN facturas_emitidas f ON f.cliente_id = c.id
      WHERE c.user_id = $1 AND c.activo = true
      GROUP BY c.id
      ORDER BY facturado_este_ano DESC
    `, [userId, year]);
    const clients = clientsResult.rows;

    // Get IVA repercutido y soportado
    const ivaRepercutidoResult = await query(`
      SELECT COALESCE(SUM(cuota_iva), 0) as total 
      FROM facturas_emitidas 
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
    `, [userId, year]);
    const ivaSoportadoResult = await query(`
      SELECT COALESCE(SUM(cuota_iva), 0) as total 
      FROM expenses 
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2 AND es_deducible = true
    `, [userId, year]);

    const ivaRepercutido = parseFloat(ivaRepercutidoResult.rows[0]?.total || 0);
    const ivaSoportado = parseFloat(ivaSoportadoResult.rows[0]?.total || 0);
    const ivaAPagar = ivaRepercutido - ivaSoportado;

    // Get IRPF retained by clients
    const irpfResult = await query(`
      SELECT COALESCE(SUM(cuota_irpf), 0) as irpf_retenido
      FROM facturas_emitidas 
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
    `, [userId, year]);
    const irpfRetenido = parseFloat(irpfResult.rows[0]?.irpf_retenido || 0);

    // Get bank balance from bank_accounts
    const bankResult = await query(`
      SELECT COALESCE(SUM(saldo_actual), 0) as saldo_total 
      FROM bank_accounts 
      WHERE user_id = $1 AND activa = true
    `, [userId]);
    const saldoBancario = parseFloat(bankResult.rows[0]?.saldo_total || 0);

    // Get documents summary
    const documentsResult = await query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(*) FILTER (WHERE categoria = 'CONTRATO') as contratos,
        COUNT(*) FILTER (WHERE categoria = 'FACTURA_GASTO') as facturas_gasto,
        COUNT(*) FILTER (WHERE categoria = 'FACTURA_INGRESO') as facturas_ingreso
      FROM documents 
      WHERE user_id = $1 AND estado = 'ACTIVO'
    `, [userId]);
    const documentsSummary = documentsResult.rows[0];

    // Get scheduled items (programaciones)
    const programacionesResult = await query(`
      SELECT p.nombre, p.tipo, p.periodicidad, 
        COALESCE((p.datos_base->>'importe_base')::numeric, 0) as importe_base,
        p.fecha_inicio
      FROM programaciones p
      WHERE p.user_id = $1
      ORDER BY p.fecha_inicio DESC
      LIMIT 10
    `, [userId]);
    const programaciones = programacionesResult.rows;

    // Get monthly breakdown for current year - invoices
    const monthlyResult = await query(`
      SELECT 
        EXTRACT(MONTH FROM fecha_emision) as mes,
        COALESCE(SUM(base_imponible), 0) as ingresos
      FROM facturas_emitidas
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      GROUP BY EXTRACT(MONTH FROM fecha_emision)
      ORDER BY mes
    `, [userId, year]);
    const monthlyIncome = monthlyResult.rows;

    // Get monthly breakdown - expenses
    const monthlyExpensesResult = await query(`
      SELECT 
        EXTRACT(MONTH FROM fecha_emision) as mes,
        COALESCE(SUM(total_factura), 0) as gastos
      FROM expenses
      WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      GROUP BY EXTRACT(MONTH FROM fecha_emision)
      ORDER BY mes
    `, [userId, year]);
    const monthlyExpenses = monthlyExpensesResult.rows;

    // Calculate net income
    const totalFacturado = parseFloat(invoicesSummary.total_facturado || 0);
    const totalGastado = parseFloat(expensesSummary.total_gastado || 0);
    const beneficioNeto = totalFacturado - totalGastado;

    // Build context string
    const context = `
=== CONTEXTO FINANCIERO DEL USUARIO (Año ${year}) ===

📅 FECHA ACTUAL: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
📊 TRIMESTRE ACTUAL: T${currentQuarter}

💰 RESUMEN DE TESORERÍA:
- Saldo bancario actual: ${saldoBancario.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IVA pendiente de pagar: ${ivaAPagar.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IRPF retenido por clientes: ${irpfRetenido.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- Balance real disponible (saldo - IVA pendiente): ${(saldoBancario - Math.max(0, ivaAPagar)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- Pendiente de cobrar: ${parseFloat(invoicesSummary.pendiente_cobro || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

📝 FACTURAS (${year}):
- Total facturas emitidas: ${invoicesSummary.total_facturas}
- Facturas pendientes de cobro: ${invoicesSummary.facturas_pendientes}
- Facturas cobradas: ${invoicesSummary.facturas_cobradas}
- Total facturado: ${totalFacturado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- Pendiente de cobrar: ${parseFloat(invoicesSummary.pendiente_cobro || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- Ya cobrado: ${parseFloat(invoicesSummary.cobrado || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

📋 ÚLTIMAS 10 FACTURAS:
${recentInvoices.length > 0 
  ? recentInvoices.map(f => `  - ${f.numero_factura} | ${f.cliente || 'Sin cliente'} | ${parseFloat(f.total_factura).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} | ${f.estado} | ${f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-ES') : 'Sin fecha'}`).join('\n')
  : '  No hay facturas registradas'}

💸 GASTOS (${year}):
- Total gastos registrados: ${expensesSummary.total_gastos}
- Total gastado: ${totalGastado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IVA soportado (deducible): ${parseFloat(expensesSummary.iva_soportado || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

📋 ÚLTIMOS 10 GASTOS:
${recentExpenses.length > 0
  ? recentExpenses.map(g => `  - ${g.concepto} | ${g.categoria || 'Sin categoría'} | ${parseFloat(g.total_factura).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} | ${g.fecha_emision ? new Date(g.fecha_emision).toLocaleDateString('es-ES') : 'Sin fecha'}${g.proveedor_nombre ? ` | ${g.proveedor_nombre}` : ''}`).join('\n')
  : '  No hay gastos registrados'}

👥 CLIENTES (${clients.length} activos):
${clients.length > 0
  ? clients.slice(0, 10).map(c => `  - ${c.nombre}${c.cif ? ` (${c.cif})` : ''} | Facturado ${year}: ${parseFloat(c.facturado_este_ano || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} (${c.facturas_este_ano} facturas)`).join('\n')
  : '  No hay clientes registrados'}

🧾 IMPUESTOS (${year}):
- IVA repercutido (cobrado a clientes): ${ivaRepercutido.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IVA soportado (pagado en gastos): ${ivaSoportado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IVA a pagar a Hacienda: ${ivaAPagar.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
- IRPF retenido por clientes: ${irpfRetenido.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

📅 CALENDARIO FISCAL PRÓXIMO:
- Modelo 303 (IVA trimestral): Se presenta del 1 al 20 del mes siguiente al trimestre
- Modelo 130 (IRPF trimestral): Se presenta del 1 al 20 del mes siguiente al trimestre
- Modelo 390 (Resumen anual IVA): Se presenta en enero del año siguiente
- Modelo 100 (Renta): Se presenta de abril a junio

📁 DOCUMENTOS:
- Total documentos guardados: ${documentsSummary?.total_documentos || 0}
- Contratos: ${documentsSummary?.contratos || 0}
- Facturas de gasto: ${documentsSummary?.facturas_gasto || 0}
- Facturas de ingreso: ${documentsSummary?.facturas_ingreso || 0}

🔄 PROGRAMACIONES (Ingresos/Gastos recurrentes):
${programaciones.length > 0 
  ? programaciones.map(p => `  - ${p.nombre} (${p.tipo}) | ${p.periodicidad || 'Sin periodicidad'} | ${parseFloat(p.importe_base || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`).join('\n')
  : '  No hay programaciones registradas'}

📈 EVOLUCIÓN MENSUAL (${year}):
${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, i) => {
  const income = monthlyIncome.find(m => parseInt(m.mes) === i + 1);
  const expense = monthlyExpenses.find(m => parseInt(m.mes) === i + 1);
  const ingresoVal = parseFloat(income?.ingresos || 0);
  const gastoVal = parseFloat(expense?.gastos || 0);
  if (ingresoVal === 0 && gastoVal === 0 && i + 1 > currentMonth) return null;
  return `  ${mes}: Ingresos ${ingresoVal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} | Gastos ${gastoVal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} | Beneficio ${(ingresoVal - gastoVal).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
}).filter(Boolean).join('\n')}

💡 BENEFICIO NETO ${year}: ${beneficioNeto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
`;

    return context;
  } catch (error) {
    console.error('Error fetching financial context:', error);
    // Return a helpful error message
    return `
Error al obtener los datos financieros. Detalles del error: ${error instanceof Error ? error.message : 'Error desconocido'}

Por favor, verifica que tienes datos cargados en la aplicación.
`;
  }
}

export async function chat(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'No autorizado' }
      });
    }

    const { messages, includeContext = true } = req.body as {
      messages: ChatMessage[];
      includeContext?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requiere al menos un mensaje' }
      });
    }

    // Get financial context for the user
    const financialContext = includeContext ? await getFinancialContext(userId) : '';

    // Build system prompt
    const systemPrompt = `Eres un asistente financiero experto para autónomos y pequeñas empresas en España. Tu nombre es "miGestor AI".

Tu objetivo es ayudar al usuario con cualquier pregunta sobre:
- Su tesorería (saldo, flujo de caja, cobros pendientes)
- Sus facturas (emitidas, pendientes, cobradas)
- Sus gastos (deducibles, categorías, totales)
- Sus obligaciones fiscales (IVA, IRPF, modelos trimestrales y anuales)
- Sus clientes
- Sus documentos

REGLAS IMPORTANTES:
1. Siempre responde en español de España
2. Usa formato de moneda EUR (€) con separador de miles punto y decimal coma
3. Sé conciso pero completo en tus respuestas
4. Si no tienes información suficiente, indica qué datos adicionales necesitas
5. Puedes hacer cálculos y estimaciones basándote en los datos disponibles
6. Para temas fiscales, recuerda que estamos en España y aplica la normativa española
7. Si te preguntan algo que no está en tu contexto, indícalo amablemente
8. Usa emojis de forma moderada para hacer las respuestas más amigables
9. Formatea las cantidades de dinero siempre con el símbolo € al final

DATOS FINANCIEROS DEL USUARIO:
${financialContext}

Responde de forma natural y profesional basándote en los datos proporcionados arriba. Si los datos muestran un error, informa al usuario de manera amable.`;

    // Prepare messages for the API
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    // Call OpenRouter API
    const client = getOpenRouterClient();
    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || 'Lo siento, no pude procesar tu consulta.';

    return res.json({
      success: true,
      data: {
        message: {
          role: 'assistant',
          content: assistantMessage
        }
      }
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error al procesar la consulta'
      }
    });
  }
}

// Get quick suggestions for the chat
export async function getSuggestions(req: Request, res: Response) {
  const suggestions = [
    '¿Cuánto dinero tengo disponible realmente?',
    '¿Cuántas facturas tengo pendientes de cobrar?',
    '¿Cuánto IVA tendré que pagar este trimestre?',
    '¿Cuál es mi cliente que más factura?',
    '¿Cuánto he gastado este mes?',
    '¿Cuál es mi beneficio neto este año?',
    '¿Qué gastos puedo deducir?',
    '¿Cuándo tengo que presentar el próximo modelo fiscal?',
  ];

  return res.json({
    success: true,
    data: { suggestions }
  });
}

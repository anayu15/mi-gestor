'use client';

import { useEffect, useState } from 'react';
import { dashboard } from '@/lib/api';
import { formatEuro } from '@/lib/utils';

interface ModeloModalProps {
  modelo: string;
  trimestre?: number;
  year?: number;
  onClose: () => void;
}

export default function ModeloModal({ modelo, trimestre, year, onClose }: ModeloModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadModeloData() {
      try {
        const response = await dashboard.modeloData(modelo, trimestre, year);
        setData(response.data);
      } catch (error) {
        console.error('Error loading modelo data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadModeloData();
  }, [modelo, trimestre, year]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center">
            <div className="text-gray-500">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const renderDatosModelo = () => {
    if (!data.datos_modelo) return null;

    const datos = data.datos_modelo;

    if (modelo === '303') {
      // Check if we have IVA breakdown by rate
      const hasDesgloseIVA = datos.desglose_iva_repercutido || datos.base_21 || datos.base_10 || datos.base_4;
      
      return (
        <div className="space-y-5">
          {/* Bill-style casillas layout - matching facturas modal */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">IVA Devengado (Repercutido)</h4>
            </div>
            
            {/* IVA breakdown by rate if available */}
            {hasDesgloseIVA ? (
              <div className="divide-y divide-slate-200">
                {/* IVA 21% */}
                {(datos.desglose_iva_repercutido?.tipo_21?.base > 0 || datos.base_21 > 0) && (
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">21%</span>
                      <span className="text-sm text-slate-700">Base: {formatEuro(datos.desglose_iva_repercutido?.tipo_21?.base || datos.base_21 || 0)}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{formatEuro(datos.desglose_iva_repercutido?.tipo_21?.cuota || datos.cuota_21 || 0)}</span>
                  </div>
                )}
                {/* IVA 10% */}
                {(datos.desglose_iva_repercutido?.tipo_10?.base > 0 || datos.base_10 > 0) && (
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">10%</span>
                      <span className="text-sm text-slate-700">Base: {formatEuro(datos.desglose_iva_repercutido?.tipo_10?.base || datos.base_10 || 0)}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{formatEuro(datos.desglose_iva_repercutido?.tipo_10?.cuota || datos.cuota_10 || 0)}</span>
                  </div>
                )}
                {/* IVA 4% */}
                {(datos.desglose_iva_repercutido?.tipo_4?.base > 0 || datos.base_4 > 0) && (
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">4%</span>
                      <span className="text-sm text-slate-700">Base: {formatEuro(datos.desglose_iva_repercutido?.tipo_4?.base || datos.base_4 || 0)}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{formatEuro(datos.desglose_iva_repercutido?.tipo_4?.cuota || datos.cuota_4 || 0)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-sm text-slate-700">Base imponible total</span>
                  <span className="ml-2 text-sm font-medium">{formatEuro(datos.casilla_03_iva_repercutido_base)}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600">+{formatEuro(datos.casilla_04_iva_repercutido_cuota)}</span>
              </div>
            )}
            
            {/* Total devengado */}
            <div className="px-4 py-2.5 bg-blue-50 border-t border-slate-300 flex justify-between items-center">
              <span className="text-sm font-semibold text-blue-900">Casilla [27] Total IVA devengado</span>
              <span className="text-lg font-bold text-blue-700">{formatEuro(datos.casilla_04_iva_repercutido_cuota)}</span>
            </div>
          </div>

          {/* IVA Soportado */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">IVA Deducible (Soportado)</h4>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center">
              <div>
                <span className="text-sm text-slate-700">Base imponible gastos</span>
                <span className="ml-2 text-sm font-medium">{formatEuro(datos.casilla_08_iva_soportado_base)}</span>
              </div>
              <span className="text-sm font-semibold text-rose-500">-{formatEuro(datos.casilla_09_iva_soportado_cuota)}</span>
            </div>
            <div className="px-4 py-2.5 bg-green-50 border-t border-slate-300 flex justify-between items-center">
              <span className="text-sm font-semibold text-green-900">Casilla [45] Total IVA deducible</span>
              <span className="text-lg font-bold text-green-700">{formatEuro(datos.casilla_09_iva_soportado_cuota)}</span>
            </div>
          </div>

          {/* Resultado */}
          <div className="bg-white border-2 border-slate-400 rounded-lg overflow-hidden">
            <div className={`px-4 py-3 flex justify-between items-center ${datos.casilla_71_resultado >= 0 ? 'bg-gradient-to-r from-red-50 to-red-100' : 'bg-gradient-to-r from-green-50 to-green-100'}`}>
              <div>
                <span className={`text-sm font-bold ${datos.casilla_71_resultado >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                  Casilla [69] Resultado
                </span>
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${datos.casilla_71_resultado >= 0 ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                  {datos.tipo || (datos.casilla_71_resultado >= 0 ? 'A ingresar' : 'A compensar')}
                </span>
              </div>
              <span className={`text-2xl font-bold ${datos.casilla_71_resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatEuro(datos.casilla_71_resultado)}
              </span>
            </div>
          </div>

          {/* Explicación del cálculo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-blue-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>¿Cómo se calcula este importe?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-blue-200">
                <p className="font-semibold text-blue-900 mb-1">Fórmula (según OCA/l10n-spain):</p>
                <p className="font-mono text-xs bg-slate-100 p-2 rounded">
                  Resultado = Casilla [27] IVA Devengado - Casilla [45] IVA Deducible
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-blue-900">IVA Repercutido ({formatEuro(datos.casilla_04_iva_repercutido_cuota)})</p>
                    <p className="text-xs text-slate-600">IVA que has cobrado a tus clientes en tus facturas emitidas. Se desglosa por tipos: 21%, 10%, 4%.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-green-900">IVA Soportado ({formatEuro(datos.casilla_09_iva_soportado_cuota)})</p>
                    <p className="text-xs text-slate-600">IVA que has pagado en tus gastos deducibles (solo gastos marcados como deducibles).</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0 ${datos.casilla_71_resultado >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>3</span>
                  <div>
                    <p className={`font-semibold ${datos.casilla_71_resultado >= 0 ? 'text-red-900' : 'text-green-900'}`}>Resultado</p>
                    <p className="text-xs font-mono bg-slate-100 p-2 rounded mt-1">
                      {formatEuro(datos.casilla_04_iva_repercutido_cuota)} - {formatEuro(datos.casilla_09_iva_soportado_cuota)} = <strong>{formatEuro(datos.casilla_71_resultado)}</strong>
                    </p>
                    <p className={`text-xs mt-1 ${datos.casilla_71_resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {datos.casilla_71_resultado >= 0 
                        ? '→ Positivo: Debes ingresar esta cantidad a Hacienda.'
                        : '→ Negativo: Puedes compensar en siguientes trimestres o solicitar devolución en T4.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <p className="text-xs text-amber-900">
                    <strong>📅 Plazo:</strong> Hasta el día 20 del mes siguiente (T4: hasta 30 de enero).
                  </p>
                </div>
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md p-2">
                  <p className="text-xs text-slate-700">
                    <strong>📋 Fuente:</strong> OCA/l10n-spain, AEAT 2026
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === '130') {
      const retenciones = datos.casilla_06_retenciones || datos.retenciones_acumuladas || 0;
      const pagosAnteriores = datos.casilla_05_pagos_anteriores || datos.casilla_07_pagos_anteriores || 0;
      const resultado = datos.casilla_07_resultado || datos.casilla_19_resultado || 0;
      
      return (
        <div className="space-y-5">
          {/* Important notice about accumulated data */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-900">
              <strong>Importante:</strong> Los datos son <strong>ACUMULADOS desde el 1 de enero</strong> hasta el final del trimestre, según normativa AEAT.
            </div>
          </div>

          {/* Bill-style casillas layout */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cálculo del Pago Fraccionado</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {/* Casilla 01 - Ingresos */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-100 text-blue-700 mr-2">[01]</span>
                  <span className="text-sm text-slate-700">Ingresos íntegros ACUMULADOS</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{formatEuro(datos.casilla_01_ingresos)}</span>
              </div>
              
              {/* Casilla 02 - Gastos */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-green-100 text-green-700 mr-2">[02]</span>
                  <span className="text-sm text-slate-700">Gastos deducibles ACUMULADOS</span>
                </div>
                <span className="text-sm font-bold text-green-700">-{formatEuro(datos.casilla_02_gastos)}</span>
              </div>
              
              {/* Casilla 03 - Rendimiento neto */}
              <div className="px-4 py-2.5 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-200 text-slate-700 mr-2">[03]</span>
                  <span className="text-sm font-medium text-slate-800">Rendimiento neto = [01] - [02]</span>
                </div>
                <span className={`text-sm font-bold ${datos.casilla_03_rendimiento_neto >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                  {formatEuro(datos.casilla_03_rendimiento_neto)}
                </span>
              </div>
              
              {/* Casilla 04 - 20% */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-100 text-amber-700 mr-2">[04]</span>
                  <span className="text-sm text-slate-700">20% del rendimiento neto positivo</span>
                </div>
                <span className="text-sm font-bold text-amber-700">{formatEuro(datos.casilla_04_20pct)}</span>
              </div>
              
              {/* Casilla 05 - Pagos anteriores */}
              {pagosAnteriores > 0 && (
                <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-purple-100 text-purple-700 mr-2">[05]</span>
                    <span className="text-sm text-slate-700">Pagos fraccionados anteriores</span>
                  </div>
                  <span className="text-sm font-bold text-purple-700">-{formatEuro(pagosAnteriores)}</span>
                </div>
              )}
              
              {/* Casilla 06 - Retenciones */}
              {retenciones > 0 && (
                <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-rose-100 text-rose-700 mr-2">[06]</span>
                    <span className="text-sm text-slate-700">Retenciones ACUMULADAS</span>
                  </div>
                  <span className="text-sm font-bold text-rose-600">-{formatEuro(retenciones)}</span>
                </div>
              )}
            </div>
            
            {/* Resultado */}
            <div className={`px-4 py-3 flex justify-between items-center border-t-2 border-slate-400 ${resultado >= 0 ? 'bg-gradient-to-r from-red-50 to-red-100' : 'bg-gradient-to-r from-green-50 to-green-100'}`}>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold mr-2 ${resultado >= 0 ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>[07]</span>
                <span className={`text-sm font-bold ${resultado >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                  Resultado = [04] - [05] - [06]
                </span>
                <span className={`ml-2 text-xs ${resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                  ({resultado >= 0 ? 'A ingresar' : 'A compensar'})
                </span>
              </div>
              <span className={`text-2xl font-bold ${resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatEuro(resultado)}
              </span>
            </div>
          </div>

          {/* Datos acumulados info */}
          {(datos.ingresos_acumulados || datos.gastos_acumulados) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-900 mb-2">📊 Resumen acumulado desde 1 de enero:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded p-2 border border-blue-100">
                  <span className="text-blue-600">Ingresos:</span>
                  <span className="font-bold text-blue-800 ml-1">{formatEuro(datos.ingresos_acumulados || datos.casilla_01_ingresos)}</span>
                </div>
                <div className="bg-white rounded p-2 border border-blue-100">
                  <span className="text-green-600">Gastos:</span>
                  <span className="font-bold text-green-800 ml-1">{formatEuro(datos.gastos_acumulados || datos.casilla_02_gastos)}</span>
                </div>
                <div className="bg-white rounded p-2 border border-blue-100">
                  <span className="text-slate-600">Beneficio:</span>
                  <span className="font-bold text-slate-800 ml-1">{formatEuro(datos.rendimiento_acumulado || datos.casilla_03_rendimiento_neto)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Explicación del cálculo */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-green-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>¿Cómo se calcula este pago fraccionado?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-green-200">
                <p className="font-semibold text-green-900 mb-1">Fórmula oficial AEAT (según OCA/l10n-spain):</p>
                <div className="font-mono text-xs bg-slate-100 p-2 rounded space-y-0.5">
                  <p>[01] Ingresos ACUMULADOS desde 1 enero</p>
                  <p>[02] Gastos ACUMULADOS desde 1 enero</p>
                  <p>[03] Rendimiento neto = [01] - [02]</p>
                  <p>[04] 20% sobre [03] (solo si positivo)</p>
                  <p>[05] Pagos fraccionados anteriores (solo positivos)</p>
                  <p>[06] Retenciones ACUMULADAS</p>
                  <p><strong>[07] Resultado = [04] - [05] - [06]</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-blue-900">Ingresos ACUMULADOS</p>
                    <p className="text-xs text-slate-600">Suma de todas tus facturas emitidas <strong>desde el 1 de enero</strong> hasta el final de este trimestre.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-green-900">Gastos ACUMULADOS</p>
                    <p className="text-xs text-slate-600">Suma de tus gastos deducibles <strong>desde el 1 de enero</strong> hasta el final de este trimestre.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex-shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-amber-900">20% del rendimiento</p>
                    <p className="text-xs text-slate-600">Se aplica el 20% solo si el rendimiento es positivo. Si es negativo, la casilla [04] es 0.</p>
                  </div>
                </div>

                {pagosAnteriores > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex-shrink-0">4</span>
                    <div>
                      <p className="font-semibold text-purple-900">Pagos anteriores ({formatEuro(pagosAnteriores)})</p>
                      <p className="text-xs text-slate-600">Solo se restan los pagos de trimestres anteriores que fueron <strong>positivos</strong>.</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0 ${resultado >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>5</span>
                  <div>
                    <p className={`font-semibold ${resultado >= 0 ? 'text-red-900' : 'text-green-900'}`}>Resultado final</p>
                    <p className={`text-xs mt-1 ${resultado >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {resultado >= 0 
                        ? 'Es un adelanto del IRPF que se descontará en la Renta anual.'
                        : 'Negativo: se compensa en siguientes trimestres o en la Renta anual.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <p className="text-xs text-amber-900">
                    <strong>💡 Exención:</strong> Si &gt;70% de tu facturación tiene retención IRPF, estás exento.
                  </p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-md p-2">
                  <p className="text-xs text-blue-900">
                    <strong>📅 Plazo:</strong> Día 20 del mes siguiente (T4: 30 de enero).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === '115') {
      const baseAlquiler = datos.casilla_02_base_retenciones || 0;
      const retenciones = datos.casilla_03_retenciones_ingresadas || 0;
      const numPerceptores = datos.casilla_01_num_perceptores || 0;
      
      return (
        <div className="space-y-5">
          {/* Información básica */}
          {datos.informacion && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-orange-900">
                {datos.informacion}
                {datos.nota && <span className="block text-xs text-orange-700 mt-1">{datos.nota}</span>}
              </div>
            </div>
          )}

          {/* Bill-style casillas layout */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Retenciones sobre Alquileres Urbanos</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {/* Casilla 01 - Número perceptores */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-orange-100 text-orange-700 mr-2">[01]</span>
                  <span className="text-sm text-slate-700">Número de perceptores (propietarios)</span>
                </div>
                <span className="text-lg font-bold text-orange-700">{numPerceptores}</span>
              </div>
              
              {/* Casilla 02 - Base retenciones */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-100 text-blue-700 mr-2">[02]</span>
                  <span className="text-sm text-slate-700">Base de las retenciones (alquileres sin IVA)</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{formatEuro(baseAlquiler)}</span>
              </div>
              
              {/* Casilla 03 - Retenciones (19%) */}
              <div className="px-4 py-2.5 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-red-100 text-red-700 mr-2">[03]</span>
                  <span className="text-sm font-medium text-slate-800">Retenciones e ingresos a cuenta (19%)</span>
                </div>
                <span className="text-sm font-bold text-red-600">{formatEuro(retenciones)}</span>
              </div>
            </div>
            
            {/* Resultado */}
            <div className={`px-4 py-3 flex justify-between items-center border-t-2 border-slate-400 ${retenciones > 0 ? 'bg-gradient-to-r from-red-50 to-red-100' : 'bg-slate-50'}`}>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold mr-2 ${retenciones > 0 ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-700'}`}>[05]</span>
                <span className={`text-sm font-bold ${retenciones > 0 ? 'text-red-900' : 'text-slate-600'}`}>
                  Resultado a ingresar
                </span>
              </div>
              <span className={`text-2xl font-bold ${retenciones > 0 ? 'text-red-700' : 'text-slate-600'}`}>
                {formatEuro(retenciones)}
              </span>
            </div>
          </div>

          {/* Explicación del cálculo */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-orange-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>¿Cómo se calcula la retención de alquiler?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-orange-200">
                <p className="font-semibold text-orange-900 mb-1">Fórmula:</p>
                <p className="font-mono text-xs bg-slate-100 p-2 rounded">
                  Casilla [03] = Casilla [02] × 19%
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-orange-900">¿Qué es el Modelo 115?</p>
                    <p className="text-xs text-slate-600">Declaración trimestral de las retenciones del 19% sobre alquileres de locales para tu actividad.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-blue-900">Ejemplo práctico</p>
                    <div className="text-xs mt-1 space-y-0.5 bg-slate-50 p-2 rounded border border-slate-200">
                      <p>• Alquiler mensual: <strong>600€</strong> (base sin IVA)</p>
                      <p>• Retención 19%: 600€ × 0.19 = <strong>114€</strong></p>
                      <p>• Pagas al propietario: 600€ - 114€ = 486€</p>
                      <p>• + IVA 21%: 600€ × 0.21 = 126€</p>
                      <p className="font-semibold border-t border-slate-300 pt-1 mt-1">→ Total factura: 486€ + 114€ + 126€ = 726€</p>
                    </div>
                    <p className="text-xs text-orange-700 mt-1">
                      La retención de 114€ la ingresas a Hacienda con el Modelo 115.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <p className="text-xs text-amber-900">
                    <strong>💡 Exención:</strong> Si el total de alquileres &lt; 900€/año, estás exento.
                  </p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-md p-2">
                  <p className="text-xs text-blue-900">
                    <strong>📅 Plazo:</strong> Día 20 del mes siguiente al trimestre.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === '180') {
      return (
        <div className="space-y-5">
          {/* Bill-style resumen layout */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-100 to-purple-50 px-4 py-2 border-b border-purple-200">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wide">Resumen Anual de Retenciones sobre Alquileres</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-sm text-slate-700">Número de operaciones</span>
                <span className="text-lg font-bold text-purple-700">{datos.num_operaciones || 0}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-sm text-slate-700">Base alquiler total anual</span>
                <span className="text-sm font-bold text-blue-700">{formatEuro(datos.base_alquiler_total)}</span>
              </div>
            </div>
            
            <div className="px-4 py-3 flex justify-between items-center border-t-2 border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100">
              <span className="text-sm font-bold text-purple-900">Retención total (19%)</span>
              <span className="text-2xl font-bold text-purple-700">{formatEuro(datos.retencion_total_19pct)}</span>
            </div>
          </div>

          {datos.nota && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-purple-900">{datos.nota}</p>
            </div>
          )}

          {/* Explicación */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-purple-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>¿Qué es el Modelo 180?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-purple-200">
                <p className="font-semibold text-purple-900 mb-1">Resumen anual:</p>
                <p className="text-xs">
                  El Modelo 180 es el <strong>resumen informativo anual</strong> de todas las retenciones por alquileres que declaraste durante el año en los 4 Modelos 115 trimestrales.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-purple-900">Contenido del modelo</p>
                    <p className="text-xs text-slate-600">Identifica a cada propietario (perceptor), detalla las rentas satisfechas y las retenciones practicadas (19%).</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-amber-900">Importante: debe cuadrar</p>
                    <p className="text-xs text-slate-600">El Modelo 180 debe <strong>cuadrar exactamente</strong> con la suma de tus 4 Modelos 115 del año. Hacienda comprueba esta coherencia.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                <p className="text-xs text-blue-900">
                  <strong>📅 Plazo:</strong> Del 1 al 31 de enero del año siguiente.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === '390') {
      return (
        <div className="space-y-5">
          {/* Bill-style resumen layout */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-100 to-indigo-50 px-4 py-2 border-b border-indigo-200">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Resumen Anual del IVA</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {/* IVA Repercutido */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="text-sm text-slate-700">Base imponible ingresos</span>
                  <span className="ml-2 text-xs text-slate-500">({formatEuro(datos.total_base_imponible_ingresos)})</span>
                </div>
                <span className="text-sm font-bold text-blue-700">+{formatEuro(datos.total_cuota_iva_repercutido)}</span>
              </div>
              
              {/* IVA Soportado */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="text-sm text-slate-700">Base imponible gastos</span>
                  <span className="ml-2 text-xs text-slate-500">({formatEuro(datos.total_base_imponible_gastos)})</span>
                </div>
                <span className="text-sm font-bold text-green-700">-{formatEuro(datos.total_cuota_iva_soportado)}</span>
              </div>
            </div>
            
            {/* Resultado */}
            <div className={`px-4 py-3 flex justify-between items-center border-t-2 border-indigo-300 ${datos.resultado_anual >= 0 ? 'bg-gradient-to-r from-red-50 to-red-100' : 'bg-gradient-to-r from-green-50 to-green-100'}`}>
              <span className={`text-sm font-bold ${datos.resultado_anual >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                Resultado anual
              </span>
              <span className={`text-2xl font-bold ${datos.resultado_anual >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatEuro(datos.resultado_anual)}
              </span>
            </div>
          </div>

          {datos.nota && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-indigo-900">{datos.nota}</p>
            </div>
          )}

          {/* Explicación */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-indigo-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <span>¿Qué es el Modelo 390?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-indigo-200">
                <p className="font-semibold text-indigo-900 mb-1">Declaración informativa anual del IVA:</p>
                <p className="text-xs">
                  Resumen de todas las operaciones de IVA que declaraste durante el año en los 4 Modelos 303 trimestrales.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-indigo-900">Contenido del modelo</p>
                    <p className="text-xs text-slate-600">Total IVA repercutido y soportado, desglose por tipos (21%, 10%, 4%), operaciones especiales.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-amber-900">Importante: debe cuadrar</p>
                    <p className="text-xs text-slate-600">Hacienda comprueba que la <strong>suma de tus 4 Modelos 303</strong> coincide exactamente con el 390.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-red-50 border border-red-200 rounded-md p-2">
                  <p className="text-xs text-red-900">
                    <strong>⚠️ Sanción:</strong> No presentarlo: 150-200€
                  </p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-md p-2">
                  <p className="text-xs text-blue-900">
                    <strong>📅 Plazo:</strong> Del 1 al 30 de enero.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === 'RENTA') {
      // Calculate values for display
      const cuotasSS = datos.cuotas_seguridad_social || 0;
      const gastosDificilJust = datos.gastos_dificil_justificacion || 0;
      const rendimientoNetoReducido = datos.rendimiento_neto_reducido || datos.rendimiento_neto;
      const rendimientoComputable = (datos.rendimiento_neto || 0) + cuotasSS; // For SS base calculation
      
      return (
        <div className="space-y-5">
          {/* Important notice */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-900">
              <strong>Estimación orientativa:</strong> El cálculo real incluye mínimos personales, deducciones autonómicas, otras rentas, etc. Consulta con tu asesor.
            </div>
          </div>

          {/* Bill-style layout - Rendimientos de Actividades Económicas */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-teal-100 to-teal-50 px-4 py-2 border-b border-teal-200">
              <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wide">Rendimientos de Actividades Económicas (Estimación Directa)</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {/* Ingresos íntegros */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-100 text-blue-700 mr-2">[0200]</span>
                  <span className="text-sm text-slate-700">Ingresos íntegros anuales</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{formatEuro(datos.ingresos_anuales)}</span>
              </div>
              
              {/* Gastos deducibles */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-green-100 text-green-700 mr-2">[0205]</span>
                  <span className="text-sm text-slate-700">Gastos fiscalmente deducibles</span>
                </div>
                <span className="text-sm font-bold text-green-700">-{formatEuro(datos.gastos_deducibles)}</span>
              </div>
              
              {/* Cuotas Seguridad Social */}
              {cuotasSS > 0 && (
                <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-purple-100 text-purple-700 mr-2">[0186]</span>
                    <span className="text-sm text-slate-700">Cuotas Seguridad Social autónomo</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">-{formatEuro(cuotasSS)}</span>
                </div>
              )}
              
              {/* Gastos difícil justificación (5%) */}
              {gastosDificilJust > 0 && (
                <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 mr-2">[0215]</span>
                    <span className="text-sm text-slate-700">Gastos difícil justificación (5%, máx 2.000€)</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">-{formatEuro(gastosDificilJust)}</span>
                </div>
              )}
              
              {/* Rendimiento neto */}
              <div className="px-4 py-2.5 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-teal-100 text-teal-700 mr-2">[0224]</span>
                  <span className="text-sm font-medium text-slate-800">Rendimiento neto de la actividad</span>
                </div>
                <span className={`text-sm font-bold ${datos.rendimiento_neto >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                  {formatEuro(datos.rendimiento_neto)}
                </span>
              </div>
            </div>
          </div>

          {/* Cálculo del IRPF */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cálculo del IRPF</h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {/* Tipo estimado */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-sm text-slate-700">Tipo medio estimado (progresivo 19%-47%)</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">{datos.tipo_irpf_estimado}%</span>
              </div>
              
              {/* Cuota íntegra */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-sm text-slate-700">IRPF estimado sobre rendimiento</span>
                <span className="text-sm font-bold text-red-600">{formatEuro(datos.irpf_estimado)}</span>
              </div>
              
              {/* Retenciones */}
              <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-green-100 text-green-700 mr-2">[0596]</span>
                  <span className="text-sm text-slate-700">Menos: Retenciones IRPF de clientes</span>
                </div>
                <span className="text-sm font-bold text-green-600">-{formatEuro(datos.menos_retenciones)}</span>
              </div>
              
              {/* Pagos fraccionados Modelo 130 */}
              {datos.menos_pagos_fraccionados > 0 && (
                <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-purple-100 text-purple-700 mr-2">[0599]</span>
                    <span className="text-sm text-slate-700">Menos: Pagos fraccionados (Mod. 130)</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">-{formatEuro(datos.menos_pagos_fraccionados)}</span>
                </div>
              )}
            </div>
            
            {/* Resultado */}
            <div className={`px-4 py-3 flex justify-between items-center border-t-2 border-slate-400 ${datos.resultado_provisional >= 0 ? 'bg-gradient-to-r from-red-50 to-red-100' : 'bg-gradient-to-r from-green-50 to-green-100'}`}>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold mr-2 ${datos.resultado_provisional >= 0 ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>[0610]</span>
                <span className={`text-sm font-bold ${datos.resultado_provisional >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                  Resultado de la declaración
                </span>
                <span className={`ml-2 text-xs ${datos.resultado_provisional >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                  ({datos.resultado_provisional >= 0 ? 'A ingresar' : 'A devolver'})
                </span>
              </div>
              <span className={`text-2xl font-bold ${datos.resultado_provisional >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatEuro(datos.resultado_provisional)}
              </span>
            </div>
          </div>

          {datos.nota && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-teal-900">{datos.nota}</p>
            </div>
          )}

          {/* Explicación detallada */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-teal-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>¿Cómo se calcula la Declaración de la Renta (Modelo 100)?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-white rounded-md p-3 border border-teal-200">
                <p className="font-semibold text-teal-900 mb-1">Fórmula oficial AEAT (Estimación Directa Simplificada):</p>
                <div className="font-mono text-xs bg-slate-100 p-2 rounded space-y-0.5">
                  <p>[0200] Ingresos íntegros (facturas emitidas)</p>
                  <p>[0205] - Gastos deducibles</p>
                  <p>[0186] - Cuotas Seguridad Social</p>
                  <p>[0215] - Gastos difícil justificación (5%, máx 2.000€)</p>
                  <p><strong>[0224] = Rendimiento neto de la actividad</strong></p>
                  <p className="border-t border-slate-300 pt-1 mt-1">Cuota íntegra = Base × tipos progresivos</p>
                  <p>[0596] - Retenciones de clientes</p>
                  <p>[0599] - Pagos fraccionados (Mod. 130)</p>
                  <p><strong>[0610] = Resultado final</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-teal-900">Rendimiento neto = Ingresos - Gastos</p>
                    <p className="text-xs text-slate-600 font-mono bg-slate-50 p-1 rounded mt-1">
                      {formatEuro(datos.ingresos_anuales)} - {formatEuro(datos.gastos_deducibles)} = {formatEuro(datos.rendimiento_neto)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-slate-900">Tipos progresivos IRPF 2026</p>
                    <div className="text-xs text-slate-600 mt-1 grid grid-cols-2 gap-1">
                      <span>0€ - 12.450€: <strong>19%</strong></span>
                      <span>12.450€ - 20.200€: <strong>24%</strong></span>
                      <span>20.200€ - 35.200€: <strong>30%</strong></span>
                      <span>35.200€ - 60.000€: <strong>37%</strong></span>
                      <span>60.000€ - 300.000€: <strong>45%</strong></span>
                      <span>&gt;300.000€: <strong>47%</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-green-900">Retenciones y pagos ya realizados</p>
                    <p className="text-xs text-slate-600">
                      Las retenciones de tus clientes ({formatEuro(datos.menos_retenciones)})
                      {datos.menos_pagos_fraccionados > 0 && ` + los pagos del Modelo 130 (${formatEuro(datos.menos_pagos_fraccionados)})`}
                      {' '}se descuentan del IRPF total.
                    </p>
                  </div>
                </div>

                {rendimientoComputable > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex-shrink-0">4</span>
                    <div>
                      <p className="font-semibold text-purple-900">Rendimiento neto computable (para SS)</p>
                      <p className="text-xs text-slate-600">
                        Para calcular tu base de cotización a la Seguridad Social: Casilla [0224] + [0186] = <strong>{formatEuro(rendimientoComputable)}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-teal-100 border border-teal-300 rounded-md p-2">
                  <p className="text-xs text-teal-900">
                    <strong>💡 Gastos difícil justificación:</strong> 5% del rendimiento neto (máx. 2.000€) si estás en Estimación Directa Simplificada.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <p className="text-xs text-amber-900">
                    <strong>⚠️ Obligatorio:</strong> Todo autónomo debe presentar la Renta, sin importar cuánto haya ingresado.
                  </p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-md p-2">
                  <p className="text-xs text-blue-900">
                    <strong>📅 Plazo:</strong> Del 2 de abril al 30 de junio (domiciliación hasta el 25 de junio).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (modelo === 'SEG-SOCIAL') {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return (
        <div className="space-y-5">
          {/* Bill-style layout */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-100 to-purple-50 px-4 py-2 border-b border-purple-200">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                Cuota de Autónomos - {monthNames[datos.mes - 1]} {datos.ejercicio}
              </h4>
            </div>
            
            <div className="divide-y divide-slate-200">
              {datos.tiene_tarifa_plana ? (
                <>
                  {/* Tarifa Plana */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 mr-2">TP</span>
                      <span className="text-sm text-slate-700">Tarifa Plana (bonificación)</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{formatEuro(datos.bonificacion_tarifa_plana)}</span>
                  </div>
                  
                  {/* Base de cotización */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <span className="text-sm text-slate-700">Base de cotización elegida</span>
                    <span className="text-sm font-medium text-slate-600">{formatEuro(datos.base_cotizacion)}</span>
                  </div>
                  
                  {/* MEI */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-100 text-blue-700 mr-2">MEI</span>
                      <span className="text-sm text-slate-700">Mecanismo Equidad Intergeneracional (0,9%)</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600">+{formatEuro(datos.mei_09pct)}</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Rendimiento neto */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <span className="text-sm text-slate-700">Rendimiento neto mensual estimado</span>
                    <span className="text-sm font-medium text-slate-600">{formatEuro(datos.rendimiento_neto_mensual)}</span>
                  </div>
                  
                  {/* Base de cotización */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <span className="text-sm text-slate-700">Base de cotización según tramo</span>
                    <span className="text-sm font-bold text-blue-600">{formatEuro(datos.base_cotizacion)}</span>
                  </div>
                  
                  {/* Tipo de cotización */}
                  <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                    <span className="text-sm text-slate-700">Tipo de cotización aplicado</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">~31,2%</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Total */}
            <div className="px-4 py-3 flex justify-between items-center border-t-2 border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100">
              <div>
                <span className="text-sm font-bold text-purple-900">Cuota mensual a pagar</span>
                {datos.tiene_tarifa_plana && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-200 text-green-800">Tarifa Plana</span>
                )}
              </div>
              <span className="text-2xl font-bold text-purple-700">{formatEuro(datos.cuota_total)}</span>
            </div>
          </div>

          {/* Fecha de cargo */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-sm">
              <span className="font-semibold text-slate-800">Fecha de cargo:</span>
              <span className="ml-1 text-slate-700">{datos.fecha_limite}</span>
              {datos.nota && <p className="text-xs text-slate-500 mt-0.5">{datos.nota}</p>}
            </div>
          </div>

          {/* Explicación del sistema */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-purple-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>¿Cómo funciona la cuota de autónomos?</span>
            </h4>

            <div className="space-y-3 text-sm text-slate-700">
              {datos.tiene_tarifa_plana ? (
                <>
                  <div className="bg-white rounded-md p-3 border border-purple-200">
                    <p className="font-semibold text-purple-900 mb-1">Tarifa Plana (primer año):</p>
                    <p className="text-xs">
                      Durante el primer año como autónomo tienes una <strong>bonificación de 80€</strong> mensual. Además, pagas el <strong>MEI (Mecanismo de Equidad Intergeneracional)</strong> que es el 0,9% sobre la base de cotización elegida.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">1</span>
                      <div>
                        <p className="font-semibold text-green-900">Bonificación: {formatEuro(datos.bonificacion_tarifa_plana)}</p>
                        <p className="text-xs text-slate-600">Ayuda fija del Estado para nuevos autónomos durante el primer año.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex-shrink-0">2</span>
                      <div>
                        <p className="font-semibold text-slate-900">Base elegida: {formatEuro(datos.base_cotizacion)}</p>
                        <p className="text-xs text-slate-600">Rango: mínimo 950,98€, máximo 5.101,20€. Mayor base = mejor protección social.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">3</span>
                      <div>
                        <p className="font-semibold text-blue-900">MEI (0,9%): {formatEuro(datos.mei_09pct)}</p>
                        <p className="text-xs text-slate-600 font-mono bg-slate-50 p-1 rounded mt-1">
                          {formatEuro(datos.base_cotizacion)} × 0,9% = {formatEuro(datos.mei_09pct)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-100 border border-purple-200 rounded-md p-2">
                    <p className="text-xs font-mono text-purple-900">
                      <strong>Total:</strong> {formatEuro(datos.bonificacion_tarifa_plana)} + {formatEuro(datos.mei_09pct)} = <strong>{formatEuro(datos.cuota_total)}</strong>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-md p-3 border border-purple-200">
                    <p className="font-semibold text-purple-900 mb-1">Sistema de cotización por ingresos reales (desde 2023):</p>
                    <p className="text-xs">
                      Los autónomos cotizan según sus <strong>rendimientos netos mensuales</strong>. La base y cuota varían según 15 tramos oficiales.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex-shrink-0">1</span>
                      <div>
                        <p className="font-semibold text-slate-900">Rendimiento neto mensual</p>
                        <p className="text-xs text-slate-600 font-mono bg-slate-50 p-1 rounded mt-1">
                          (Ingresos - Gastos) / 12 = {formatEuro(datos.rendimiento_neto_mensual)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">2</span>
                      <div>
                        <p className="font-semibold text-blue-900">Base de cotización: {formatEuro(datos.base_cotizacion)}</p>
                        <p className="text-xs text-slate-600">Según tu tramo de rendimientos, esta es la base aplicable.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex-shrink-0">3</span>
                      <div>
                        <p className="font-semibold text-purple-900">Cuota resultante: {formatEuro(datos.cuota_total)}</p>
                        <p className="text-xs text-slate-600">Base × tipo (~31,2%) + MEI (0,9%).</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
                    <p className="text-xs text-amber-900">
                      <strong>💡 Recuerda:</strong> Puedes cambiar tu base de cotización hasta 6 veces al año para ajustarla a tus ingresos reales.
                    </p>
                  </div>
                </>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                <p className="text-xs text-blue-900">
                  <strong>📅 Cargo automático:</strong> Último día laborable de cada mes mediante domiciliación bancaria en tu cuenta.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <div className="text-gray-600">Información del modelo no disponible</div>;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header - matching facturas modal style */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{data.descripcion}</h2>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              {data.datos_modelo?.ejercicio && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  {data.datos_modelo.ejercicio}
                </span>
              )}
              {data.datos_modelo?.trimestre && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  T{data.datos_modelo.trimestre}
                </span>
              )}
              {data.datos_modelo?.fecha_limite && (
                <span className="text-slate-600">
                  Límite: <span className="font-medium">{data.datos_modelo.fecha_limite}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto p-5">
          {/* Datos identificativos - compact card style */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-500 text-xs">Contribuyente:</span>
                  <span className="ml-1.5 font-semibold text-slate-800">{data.datos_identificativos.nombre_completo}</span>
                </div>
                <div className="h-4 w-px bg-slate-300"></div>
                <div>
                  <span className="text-slate-500 text-xs">NIF:</span>
                  <span className="ml-1.5 font-mono font-semibold text-slate-800">{data.datos_identificativos.nif}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Datos del modelo */}
          <div className="mb-4">
            {renderDatosModelo()}
          </div>
        </div>

        {/* Footer con botones - matching facturas style */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-100 transition-colors font-medium text-slate-700"
          >
            Cerrar
          </button>
          {modelo !== 'SEG-SOCIAL' && (
            <a
              href={data.url_presentacion}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-md hover:bg-emerald-600 transition-colors font-semibold shadow-sm flex items-center gap-2"
            >
              Presentar en AEAT
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

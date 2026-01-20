'use client';

import { useState, useEffect } from 'react';
import { tax } from '@/lib/api';
import { formatEuro, formatDate, formatPercent } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Toast from '@/components/Toast';
import FiscalSettings from '@/components/FiscalSettings';
import { useModelAccess } from '@/hooks/useModelAccess';

interface Modelo130Data {
  trimestre: number;
  year: number;
  fecha_limite: string;
  ingresos: number;
  gastos: number;
  rendimiento_neto: number;
  retencion_aplicable: number;
  cuota_trimestre: number;
  pagos_previos: number;
  resultado: number;
  accion: string;
  casillas_aeat: Record<string, number>;
  instrucciones: string[];
}

export default function Modelo130Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('130');
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(currentQuarter);
  const [data, setData] = useState<Modelo130Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadModelo130();
  }, [year, trimestre]);

  async function loadModelo130() {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await tax.modelo130(year, trimestre);
      setData(response.data);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el Modelo 130');
      }
    } finally {
      setLoading(false);
    }
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Modelo 130 no habilitado
            </h2>
            <p className="text-gray-700 mb-6">
              Has desactivado el Modelo 130 en tu configuracion.
              Para acceder a esta pagina, activa el modelo en tu configuracion.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/fiscal/calendario"
                className="px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300"
              >
                Ir a Calendario
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300"
              >
                Volver al Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando Modelo 130...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {error && (
        <Toast message={error} type="error" onClose={() => setError('')} />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel - matches Facturas style */}
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              {/* Year selector */}
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white hover:border-slate-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all cursor-pointer min-w-[110px]"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-300 mx-1"></div>

              {/* Trimestre selector */}
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTrimestre(t)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      trimestre === t
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t}T
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data && (
                <div className="text-right mr-2">
                  <div className="text-xs text-gray-500">Fecha limite</div>
                  <div className="text-sm font-semibold text-gray-700">{formatDate(data.fecha_limite)}</div>
                </div>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md transition-colors flex items-center justify-center ${
                  showSettings
                    ? 'bg-slate-200 text-slate-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Configuracion fiscal"
              >
                <svg className={`w-5 h-5 transition-transform ${showSettings ? 'animate-spin-slow' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <FiscalSettings onClose={() => setShowSettings(false)} onPreferenceChange={refreshAccess} />
        )}

        {!showSettings && data && (
          <>
            {/* Net Income Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculo del Rendimiento Neto</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Ingresos (acumulado del ano):</span>
                  <span className="text-xl font-bold text-green-600">{formatEuro(data.ingresos)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Gastos deducibles (acumulado del ano):</span>
                  <span className="text-xl font-bold text-red-600">{formatEuro(data.gastos)}</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Rendimiento Neto:</span>
                    <span className="text-xl font-bold text-blue-600">{formatEuro(data.rendimiento_neto)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fractional Payment */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pago Fraccionado</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">
                    Rendimiento Neto x {formatPercent(data.retencion_aplicable, 0)}:
                  </span>
                  <span className="text-lg font-bold text-gray-900">{formatEuro(data.cuota_trimestre)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Pagos fraccionados previos:</span>
                  <span className="text-lg font-bold text-red-600">- {formatEuro(data.pagos_previos)}</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">RESULTADO:</span>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${data.resultado >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatEuro(Math.abs(data.resultado))}
                      </div>
                      <div className={`text-sm font-medium ${data.resultado >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {data.accion}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {data.resultado === 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
                  No hay pago a realizar en este trimestre. Los pagos previos cubren la obligacion.
                </div>
              )}
            </div>

            {/* How it's calculated */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Como se calcula este pago fraccionado</span>
              </h3>

              <div className="space-y-4 text-gray-800">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="font-semibold text-slate-800 mb-2">Formula del Modelo 130:</p>
                  <div className="font-mono text-sm bg-white p-3 rounded border border-slate-200 space-y-1">
                    <p>Rendimiento Neto = Ingresos - Gastos</p>
                    <p>Cuota = Rendimiento Neto x 20%</p>
                    <p>Pago = Cuota - Retenciones - Pagos Previos</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">1. Ingresos Acumulados ({formatEuro(data.ingresos)})</p>
                    <p className="text-sm mt-1 text-gray-600">Suma de la <strong>base imponible</strong> (sin IVA) de todas tus facturas emitidas desde enero hasta el final de este trimestre.</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">2. Gastos Deducibles Acumulados ({formatEuro(data.gastos)})</p>
                    <p className="text-sm mt-1 text-gray-600">Suma de la base imponible de todos tus gastos marcados como "deducible" desde enero hasta el final de este trimestre.</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">3. Rendimiento Neto ({formatEuro(data.rendimiento_neto)})</p>
                    <p className="text-sm mt-1 font-mono bg-white p-2 rounded border border-slate-200">
                      {formatEuro(data.ingresos)} - {formatEuro(data.gastos)} = {formatEuro(data.rendimiento_neto)}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">4. Aplicar 20% ({formatEuro(data.cuota_trimestre)})</p>
                    <p className="text-sm mt-1 text-gray-600">El pago fraccionado es el 20% del rendimiento neto acumulado.</p>
                    <p className="text-sm mt-1 font-mono bg-white p-2 rounded border border-slate-200">
                      {formatEuro(data.rendimiento_neto)} x 20% = {formatEuro(data.cuota_trimestre)}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">5. Restar Pagos Previos ({formatEuro(data.pagos_previos)})</p>
                    <p className="text-sm mt-1 text-gray-600">Se restan los pagos fraccionados que ya hiciste en trimestres anteriores de este mismo ano.</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">6. Resultado Final</p>
                    <div className="text-sm mt-1 space-y-2">
                      <p className="font-mono bg-white p-2 rounded border border-slate-200">
                        {formatEuro(data.cuota_trimestre)} - {formatEuro(data.pagos_previos)} = {formatEuro(data.resultado)}
                      </p>
                      {data.resultado > 0 ? (
                        <p className="text-slate-700">
                          <strong>Debes ingresar {formatEuro(data.resultado)}</strong> como pago fraccionado de este trimestre.
                        </p>
                      ) : data.resultado === 0 ? (
                        <p className="text-slate-700">
                          <strong>Sin pago este trimestre:</strong> Los pagos previos ya cubren la cuota acumulada.
                        </p>
                      ) : (
                        <p className="text-slate-700">
                          <strong>Tienes un exceso de {formatEuro(Math.abs(data.resultado))}</strong> que se compensara en proximos trimestres o en la Renta.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  <p className="text-sm text-amber-900 flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>Exencion:</strong> Si mas del 70% de tu facturacion tiene retencion de IRPF (facturas a empresas), estas exento de presentar el Modelo 130.</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span><strong>Recuerda:</strong> Este es un adelanto del IRPF. En la declaracion de la Renta anual se regularizara el importe definitivo, descontando estos pagos fraccionados.</span>
                  </p>
                </div>
              </div>
            </div>

            {/* AEAT Form Fields */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Casillas para el formulario AEAT</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.casillas_aeat).map(([casilla, valor]) => (
                  <div key={casilla} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-mono font-semibold text-slate-600">Casilla {casilla}</span>
                    <span className="font-semibold text-gray-900">{formatEuro(valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-amber-50 rounded-lg shadow-sm border border-amber-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-3">Importante</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
                <li>Este es un pago a cuenta del IRPF anual</li>
                <li>Los autonomos en estimacion directa deben presentarlo trimestralmente</li>
                <li>El tipo de retencion tipico es del 20% del rendimiento neto</li>
                <li>En la declaracion anual (Renta) se regularizara el importe definitivo</li>
              </ul>
            </div>

            {/* Instructions */}
            {data.instrucciones && data.instrucciones.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Instrucciones de presentacion</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  {data.instrucciones.map((instruccion, index) => (
                    <li key={index} className="text-sm">{instruccion}</li>
                  ))}
                </ol>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <a
                    href="https://sede.agenciatributaria.gob.es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm flex items-center gap-1"
                  >
                    Acceder a la Sede Electronica de la AEAT
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

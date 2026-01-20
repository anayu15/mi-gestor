'use client';

import { useState, useEffect } from 'react';
import { tax } from '@/lib/api';
import { formatEuro, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Toast from '@/components/Toast';
import FiscalSettings from '@/components/FiscalSettings';
import { useModelAccess } from '@/hooks/useModelAccess';

interface Modelo303Data {
  trimestre: number;
  year: number;
  fecha_limite: string;
  iva_repercutido: number;
  iva_soportado: number;
  resultado: number;
  accion: string;
  casillas_aeat: Record<string, number>;
  instrucciones: string[];
}

export default function Modelo303Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('303');
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(currentQuarter);
  const [data, setData] = useState<Modelo303Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadModelo303();
  }, [year, trimestre]);

  async function loadModelo303() {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await tax.modelo303(year, trimestre);
      setData(response.data);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el Modelo 303');
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
              Modelo 303 no habilitado
            </h2>
            <p className="text-gray-700 mb-6">
              Has desactivado el Modelo 303 en tu configuración.
              Para acceder a esta página, activa el modelo en tu configuración.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/fiscal/calendario"
                className="px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300"
              >
                Ir a Configuración
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
          <p className="mt-4 text-gray-600">Cargando Modelo 303...</p>
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
                  <div className="text-xs text-gray-500">Fecha límite</div>
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
                title="Configuración fiscal"
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
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">IVA Repercutido (facturas emitidas):</span>
                  <span className="text-xl font-bold text-green-600">{formatEuro(data.iva_repercutido)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">IVA Soportado (gastos):</span>
                  <span className="text-xl font-bold text-red-600">{formatEuro(data.iva_soportado)}</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">RESULTADO:</span>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${data.resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {formatEuro(Math.abs(data.resultado))}
                      </div>
                      <div className={`text-sm font-medium ${data.resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {data.accion}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How it's calculated */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Como se calcula este importe</span>
              </h3>

              <div className="space-y-4 text-gray-800">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="font-semibold text-slate-800 mb-2">Formula del Modelo 303:</p>
                  <p className="font-mono text-sm bg-white p-3 rounded border border-slate-200">
                    Resultado = IVA Repercutido - IVA Soportado
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">1. IVA Repercutido ({formatEuro(data.iva_repercutido)})</p>
                    <p className="text-sm mt-1 text-gray-600">Es el IVA que has <strong>cobrado</strong> a tus clientes en tus facturas emitidas durante este trimestre. Aparece en la columna "Cuota IVA" de tus facturas.</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">2. IVA Soportado ({formatEuro(data.iva_soportado)})</p>
                    <p className="text-sm mt-1 text-gray-600">Es el IVA que has <strong>pagado</strong> en tus gastos deducibles durante este trimestre. Son los gastos marcados como "deducible" en tu lista de gastos.</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-semibold text-slate-800">3. Resultado</p>
                    <div className="text-sm mt-1 space-y-2">
                      <p className="font-mono bg-white p-2 rounded border border-slate-200">
                        {formatEuro(data.iva_repercutido)} - {formatEuro(data.iva_soportado)} = {formatEuro(data.resultado)}
                      </p>
                      {data.resultado >= 0 ? (
                        <p className="text-slate-700">
                          <strong>Resultado positivo:</strong> Debes ingresar {formatEuro(data.resultado)} a Hacienda (has cobrado mas IVA del que has pagado).
                        </p>
                      ) : (
                        <p className="text-slate-700">
                          <strong>Resultado negativo:</strong> Hacienda te debe {formatEuro(Math.abs(data.resultado))}. Puedes solicitar devolucion o compensarlo en siguientes trimestres.
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
                    <span><strong>Importante:</strong> El Modelo 303 es trimestral y obligatorio para todos los autonomos con actividad sujeta a IVA.</span>
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

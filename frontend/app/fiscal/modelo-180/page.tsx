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

interface Modelo180Data {
  modelo: string;
  ano: number;
  fecha_limite_presentacion: string;
  resumen_anual: {
    base_alquiler_total: number;
    retencion_total_19pct: number;
    num_operaciones: number;
  };
  desglose_trimestral: Array<{
    trimestre: number;
    base_alquiler: number;
    retencion: number;
  }>;
  accion: string;
  nota?: string;
  instrucciones: string[];
}

export default function Modelo180Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('180');
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear - 1);
  const [data, setData] = useState<Modelo180Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadModelo180();
  }, [year]);

  async function loadModelo180() {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await tax.modelo180(year);
      setData(response.data);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el Modelo 180');
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
              Modelo 180 no habilitado
            </h2>
            <p className="text-gray-700 mb-6">
              Has desactivado el Modelo 180 en tu configuracion.
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
                {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-300 mx-1"></div>

              <div className="text-sm text-gray-500">
                <p className="text-xs">Plazo: hasta el 31 de enero de {year + 1}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data && (
                <div className="text-right mr-2">
                  <div className="text-xs text-gray-500">Fecha limite</div>
                  <div className="text-sm font-semibold text-gray-700">{formatDate(data.fecha_limite_presentacion)}</div>
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

        {/* Loading State */}
        {!showSettings && loading && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos del Modelo 180...</p>
          </div>
        )}

        {/* Data Display */}
        {!showSettings && !loading && data && (
          <>
            {/* Annual Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen Anual</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Total de alquileres pagados:</span>
                  <span className="text-xl font-bold text-gray-900">{formatEuro(data.resumen_anual.base_alquiler_total)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Retenciones totales (19%):</span>
                  <span className="text-xl font-bold text-purple-600">{formatEuro(data.resumen_anual.retencion_total_19pct)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700">Numero de operaciones:</span>
                  <span className="text-xl font-bold text-gray-900">{data.resumen_anual.num_operaciones}</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">ESTADO:</span>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        data.accion === 'INFORMATIVO' ? 'text-purple-600' : 'text-gray-500'
                      }`}>
                        {data.accion}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quarterly Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Desglose Trimestral</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.desglose_trimestral.map((trimestre) => (
                  <div key={trimestre.trimestre} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-3">Trimestre {trimestre.trimestre}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base alquiler:</span>
                        <span className="font-medium">{formatEuro(trimestre.base_alquiler)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Retencion:</span>
                        <span className="font-medium text-purple-600">{formatEuro(trimestre.retencion)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Informational Note */}
            {data.nota && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-slate-700">{data.nota}</p>
                </div>
              </div>
            )}

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

        {/* Back Link */}
        {!showSettings && (
          <div className="mt-8 text-center">
            <Link
              href="/fiscal/calendario"
              className="text-slate-600 hover:text-slate-800 font-medium text-sm flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver al Calendario Fiscal
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

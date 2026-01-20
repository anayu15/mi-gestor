'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Toast from '@/components/Toast';
import FiscalSettings from '@/components/FiscalSettings';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function Modelo111Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('111');
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(currentQuarter);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

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
              Modelo 111 no habilitado
            </h2>
            <p className="text-gray-700 mb-6">
              Has desactivado el Modelo 111 en tu configuracion.
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white hover:border-slate-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all cursor-pointer min-w-[110px]"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <div className="h-5 w-px bg-slate-300 mx-1"></div>

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

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-md transition-colors flex items-center justify-center ${
                showSettings
                  ? 'bg-slate-200 text-slate-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Configuracion fiscal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {showSettings && (
          <FiscalSettings onClose={() => setShowSettings(false)} onPreferenceChange={refreshAccess} />
        )}

        {!showSettings && (
          <>
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Modelo 111</h1>
                  <p className="text-gray-600">Retenciones e ingresos a cuenta del IRPF - Trabajadores y profesionales</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Que es el Modelo 111?</h3>
                <p className="text-sm text-blue-800 mb-3">
                  El Modelo 111 es una declaracion trimestral obligatoria para autonomos que:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Tienen empleados contratados</li>
                  <li>Contratan servicios de otros profesionales autonomos con retencion</li>
                  <li>Pagan rendimientos del trabajo (nominas)</li>
                </ul>
              </div>
            </div>

            {/* Coming Soon Notice */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Funcionalidad en desarrollo</h2>
              <p className="text-gray-600 mb-4">
                La funcionalidad completa del Modelo 111 estara disponible proximamente.
                Por ahora puedes consultar la informacion sobre este modelo.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto">
                <h4 className="font-semibold text-slate-800 mb-2">Proximas funcionalidades:</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>- Registro de pagos a profesionales con retencion</li>
                  <li>- Calculo automatico de retenciones</li>
                  <li>- Generacion de casillas AEAT</li>
                  <li>- Instrucciones de presentacion</li>
                </ul>
              </div>
            </div>

            {/* Educational Content */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Modelo 111</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Plazo de presentacion</h4>
                  <p className="text-sm text-gray-600">
                    Del 1 al 20 del mes siguiente al trimestre natural.
                    Si el dia 20 es festivo, se prorroga al siguiente dia habil.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Tipos de retencion</h4>
                  <p className="text-sm text-gray-600">
                    General profesionales: 15%<br />
                    Nuevos autonomos: 7% (primeros 3 anos)<br />
                    Trabajadores: segun tablas IRPF
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <a
                  href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G322.shtml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm flex items-center gap-1"
                >
                  Acceder al Modelo 111 en la Sede Electronica de la AEAT
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Back Link */}
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
          </>
        )}
      </main>
    </div>
  );
}

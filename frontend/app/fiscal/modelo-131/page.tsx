'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import FiscalSettings from '@/components/FiscalSettings';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function Modelo131Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('131');
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [year, setYear] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(currentQuarter);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Modelo 131 no habilitado</h2>
            <p className="text-gray-700 mb-6">Activa el modelo en tu configuracion para acceder.</p>
            <Link href="/fiscal/calendario" className="px-4 py-2 bg-slate-700 text-white rounded-md">
              Ir a Calendario
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white">
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="h-5 w-px bg-slate-300 mx-1"></div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((t) => (
                  <button key={t} onClick={() => setTrimestre(t)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      trimestre === t ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}>
                    {t}T
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-md text-slate-600 hover:bg-slate-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {showSettings && <FiscalSettings onClose={() => setShowSettings(false)} onPreferenceChange={refreshAccess} />}

        {!showSettings && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Modelo 131</h1>
                  <p className="text-gray-600">Pago fraccionado IRPF - Estimacion Objetiva (Modulos)</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-900 flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span><strong>Nota:</strong> Este modelo es para autonomos que tributan por modulos (estimacion objetiva). Es mutuamente excluyente con el Modelo 130 (estimacion directa).</span>
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Que es el Modelo 131?</h3>
                <p className="text-sm text-blue-800">
                  El Modelo 131 es el pago fraccionado del IRPF para autonomos en regimen de estimacion objetiva (modulos).
                  A diferencia del Modelo 130, la cuota no se calcula sobre beneficios reales sino mediante parametros
                  objetivos como personal empleado, potencia electrica, superficie del local, etc.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Funcionalidad en desarrollo</h2>
              <p className="text-gray-600 mb-4">
                El calculo por modulos requiere configuracion especifica segun la actividad economica.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto">
                <h4 className="font-semibold text-slate-800 mb-2">Proximas funcionalidades:</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>- Configuracion de actividad economica (IAE)</li>
                  <li>- Introduccion de parametros de modulos</li>
                  <li>- Calculo automatico de cuota trimestral</li>
                  <li>- Generacion de casillas AEAT</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Modelo 131</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Plazo de presentacion</h4>
                  <p className="text-sm text-gray-600">Del 1 al 20 del mes siguiente al trimestre.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Calculo</h4>
                  <p className="text-sm text-gray-600">Segun modulos de la actividad (personal, electricidad, etc.).</p>
                </div>
              </div>
              <a href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G106.shtml" target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
                Acceder al Modelo 131 en la AEAT
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <div className="mt-8 text-center">
              <Link href="/fiscal/calendario" className="text-slate-600 hover:text-slate-800 font-medium text-sm flex items-center justify-center gap-1">
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

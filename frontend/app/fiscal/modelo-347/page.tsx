'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import FiscalSettings from '@/components/FiscalSettings';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function Modelo347Page() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading, refresh: refreshAccess } = useModelAccess('347');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Modelo 347 no habilitado</h2>
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
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white">
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
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
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Modelo 347</h1>
                  <p className="text-gray-600">Declaracion anual de operaciones con terceras personas</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Que es el Modelo 347?</h3>
                <p className="text-sm text-blue-800 mb-2">
                  El Modelo 347 es una declaracion informativa anual que deben presentar los autonomos y empresas
                  que hayan realizado operaciones con un mismo cliente o proveedor que superen los <strong>3.005,06 EUR</strong> anuales.
                </p>
                <p className="text-sm text-blue-800">
                  Se genera automaticamente a partir de tus facturas emitidas y gastos registrados.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Funcionalidad en desarrollo</h2>
              <p className="text-gray-600 mb-4">
                El sistema calculara automaticamente los terceros que superen el umbral de 3.005,06 EUR.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto">
                <h4 className="font-semibold text-slate-800 mb-2">Proximas funcionalidades:</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>- Deteccion automatica de operaciones &gt; 3.005,06 EUR</li>
                  <li>- Listado de terceros declarables</li>
                  <li>- Desglose trimestral por perceptor</li>
                  <li>- Exportacion para presentacion en AEAT</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Modelo 347</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Plazo de presentacion</h4>
                  <p className="text-sm text-gray-600">Del 1 al 28 de febrero del ano siguiente al ejercicio.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Umbral de declaracion</h4>
                  <p className="text-sm text-gray-600">3.005,06 EUR anuales con un mismo tercero (IVA incluido).</p>
                </div>
              </div>
              <a href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G404.shtml" target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
                Acceder al Modelo 347 en la AEAT
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

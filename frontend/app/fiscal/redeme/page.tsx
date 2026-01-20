'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function REDEMEPage() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading } = useModelAccess('REDEME');

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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">REDEME no habilitado</h2>
            <p className="text-gray-700 mb-6">Activa REDEME en tu configuracion para acceder.</p>
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
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">REDEME</h1>
              <p className="text-gray-600">Registro de Devolucion Mensual del IVA</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Que es el REDEME?</h2>
          <p className="text-gray-700 mb-4">
            El REDEME (Registro de Devolucion Mensual) es un registro especial de la AEAT que permite
            a los inscritos solicitar la devolucion del IVA soportado de forma mensual en lugar de
            anual. Es especialmente util para autonomos y empresas que suelen tener IVA a devolver.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900 mb-2">Ventajas del REDEME</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>- Devolucion mensual del IVA (no esperar a fin de ano)</li>
              <li>- Mejora del flujo de caja</li>
              <li>- Ideal para exportadores y empresas con inversiones</li>
              <li>- Acceso automatico al SII (menos obligaciones formales)</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-amber-900 mb-2">Quien deberia inscribirse?</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>- Exportadores con IVA a devolver frecuentemente</li>
              <li>- Empresas con grandes inversiones en activos</li>
              <li>- Autonomos con tipo de IVA reducido o exento</li>
              <li>- Actividades con margen de IVA negativo recurrente</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2">Requisitos</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>- Estar al corriente con Hacienda</li>
                <li>- No estar en procedimiento de comprobacion</li>
                <li>- Solicitar alta antes del 30 noviembre</li>
                <li>- Efecto desde el 1 enero siguiente</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2">Obligaciones</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>- Modelo 303 mensual (no trimestral)</li>
                <li>- Inclusion automatica en SII</li>
                <li>- Envio de facturas en 4 dias</li>
                <li>- Permanencia minima 1 ano</li>
              </ul>
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 mb-3">Como darse de alta</h3>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal mb-6">
            <li>Presentar el modelo 036 con la casilla correspondiente marcada</li>
            <li>Solicitar antes del 30 de noviembre del ano anterior</li>
            <li>El alta sera efectiva desde el 1 de enero del ano siguiente</li>
            <li>A partir de entonces, presentar Modelo 303 mensual</li>
            <li>La devolucion se procesara mensualmente</li>
          </ol>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-slate-800 mb-2">Plazo de devolucion</h4>
            <p className="text-sm text-slate-700">
              La AEAT tiene un plazo de 6 meses para resolver las solicitudes de devolucion.
              Si no hay respuesta en ese plazo, se entiende estimada la solicitud.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <a href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GC07.shtml" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
              Solicitar alta en REDEME (Modelo 036)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/fiscal/calendario" className="text-slate-600 hover:text-slate-800 font-medium text-sm flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al Calendario Fiscal
          </Link>
        </div>
      </main>
    </div>
  );
}

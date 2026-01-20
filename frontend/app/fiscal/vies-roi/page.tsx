'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function VIESROIPage() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading } = useModelAccess('VIES');

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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">VIES/ROI no habilitado</h2>
            <p className="text-gray-700 mb-6">Activa VIES/ROI en tu configuracion para acceder.</p>
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
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">VIES / ROI</h1>
              <p className="text-gray-600">Registro de Operadores Intracomunitarios</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Que es el ROI?</h2>
          <p className="text-gray-700 mb-4">
            El ROI (Registro de Operadores Intracomunitarios) es un censo especial de la AEAT donde deben
            inscribirse los autonomos y empresas que realizan operaciones intracomunitarias
            (compras o ventas de bienes/servicios con empresas de otros paises de la UE).
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Para que sirve?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>- Realizar operaciones sin IVA con empresas de la UE</li>
              <li>- Validar el NIF-IVA de tus clientes/proveedores europeos</li>
              <li>- Emitir facturas intracomunitarias exentas de IVA</li>
              <li>- Deducir el IVA de compras intracomunitarias</li>
            </ul>
          </div>

          <h3 className="font-semibold text-gray-900 mb-3">Que es el VIES?</h3>
          <p className="text-gray-700 mb-4">
            El VIES (VAT Information Exchange System) es el sistema europeo de intercambio de informacion
            sobre el IVA. Permite verificar si un numero de IVA intracomunitario es valido y si la empresa
            esta autorizada para realizar operaciones intracomunitarias.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Requisitos para alta en ROI</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>- Estar dado de alta como autonomo</li>
                <li>- Tener NIF valido</li>
                <li>- Solicitar el alta mediante modelo 036/037</li>
                <li>- Indicar actividades intracomunitarias</li>
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">Obligaciones tras el alta</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>- Presentar Modelo 349 trimestral</li>
                <li>- Verificar NIF-IVA de contrapartes</li>
                <li>- Emitir facturas con NIF intracomunitario</li>
                <li>- Llevar registro de operaciones UE</li>
              </ul>
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 mb-3">Como darse de alta</h3>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal mb-6">
            <li>Acceder a la Sede Electronica de la AEAT</li>
            <li>Presentar modelo 036 (o 037 simplificado)</li>
            <li>Marcar la casilla de alta en ROI</li>
            <li>Indicar las operaciones que realizaras (adquisiciones, entregas, servicios)</li>
            <li>La AEAT verificara y confirmara tu NIF-IVA intracomunitario</li>
          </ol>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-slate-800 mb-2">Verificar un NIF-IVA europeo</h4>
            <p className="text-sm text-slate-700 mb-3">
              Antes de realizar operaciones intracomunitarias, verifica que el NIF-IVA de tu cliente/proveedor
              esta activo en el sistema VIES.
            </p>
            <a href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
              Verificar NIF-IVA en VIES (Comision Europea)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <a href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GC07.shtml" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
              Solicitar alta en el ROI (Modelo 036)
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

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useModelAccess } from '@/hooks/useModelAccess';

export default function SIIPage() {
  const router = useRouter();
  const { isAllowed, loading: accessLoading } = useModelAccess('SII');

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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">SII no habilitado</h2>
            <p className="text-gray-700 mb-6">Activa SII en tu configuracion para acceder.</p>
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
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SII - Suministro Inmediato de Informacion</h1>
              <p className="text-gray-600">Sistema de facturacion electronica en tiempo real</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Que es el SII?</h2>
          <p className="text-gray-700 mb-4">
            El Suministro Inmediato de Informacion (SII) es un sistema de gestion del IVA basado en el envio
            casi inmediato de los registros de facturacion a la AEAT. Los contribuyentes deben remitir
            los detalles de las facturas en un plazo de 4 dias naturales.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">Ventajas</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>- Reduccion de obligaciones formales</li>
                <li>- No presentar modelos 347, 340, 390</li>
                <li>- Ampliacion plazos de presentacion 303</li>
                <li>- Acceso a datos contrastados en tiempo real</li>
                <li>- Devolucion mensual automatica de IVA</li>
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h3 className="font-semibold text-amber-800 mb-2">Obligaciones</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>- Envio de facturas en 4 dias</li>
                <li>- Uso de software compatible</li>
                <li>- Mantenimiento de registros actualizados</li>
                <li>- Inscripcion previa en el REDEME</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Quienes estan obligados?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>- Grandes empresas (facturacion &gt; 6 millones EUR)</li>
              <li>- Grupos de IVA</li>
              <li>- Inscritos en REDEME (voluntariamente)</li>
            </ul>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Para autonomos:</strong> El SII es voluntario en la mayoria de casos.
            </p>
          </div>

          <h3 className="font-semibold text-gray-900 mb-3">Como darse de alta</h3>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal mb-6">
            <li>Inscribirse en el REDEME (Registro de Devolucion Mensual) mediante modelo 036</li>
            <li>La inscripcion en REDEME implica automaticamente la inclusion en el SII</li>
            <li>Adaptar el software de facturacion para el envio automatico</li>
            <li>Comunicar las facturas en el plazo de 4 dias</li>
          </ol>

          <div className="border-t border-gray-200 pt-4">
            <a href="https://sede.agenciatributaria.gob.es/Sede/iva/suministro-inmediato-informacion.html" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
              Mas informacion sobre el SII en la AEAT
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatEuro, formatDate } from '@/lib/utils';
import { recurringTemplates } from '@/lib/api';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface RecurringTemplateCardProps {
  template: any;
  onRefresh: () => void;
}

export default function RecurringTemplateCard({ template, onRefresh }: RecurringTemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const getFrecuenciaLabel = (frecuencia: string) => {
    const labels: Record<string, string> = {
      MENSUAL: 'Mensual',
      TRIMESTRAL: 'Trimestral',
      ANUAL: 'Anual',
      PERSONALIZADO: 'Personalizado'
    };
    return labels[frecuencia] || frecuencia;
  };

  const isProximaSoon = () => {
    const proxima = new Date(template.proxima_generacion);
    const today = new Date();
    const diffDays = Math.ceil((proxima.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  const handleToggleActive = async () => {
    try {
      setLoading(true);
      if (template.activo) {
        await recurringTemplates.deactivate(template.id);
      } else {
        await recurringTemplates.activate(template.id);
      }
      onRefresh();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      setLoading(true);
      if (template.pausado) {
        await recurringTemplates.resume(template.id);
      } else {
        const motivo = prompt('Motivo de pausa (opcional):');
        await recurringTemplates.pause(template.id, motivo || undefined);
      }
      onRefresh();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleGenerateNow = () => {
    setShowGenerateModal(true);
    setShowMenu(false);
  };

  const confirmGenerateNow = async () => {
    try {
      setLoading(true);
      const response = await recurringTemplates.generateNow(template.id);
      alert(`Factura ${response.data.numero_factura} generada correctamente`);
      setShowGenerateModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    setShowMenu(false);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await recurringTemplates.delete(template.id);
      setShowDeleteModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const total = template.base_imponible * (1 + template.tipo_iva / 100) - (template.base_imponible * template.tipo_irpf / 100);

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.nombre_plantilla}</h3>
          <div className="flex gap-2 flex-wrap">
            {template.activo ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Activa
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                Inactiva
              </span>
            )}
            {template.pausado && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                Pausada
              </span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={loading}
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              {/* Menu */}
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <Link
                  href={`/facturas/recurrentes/${template.id}/editar`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  Editar
                </Link>
                <Link
                  href={`/facturas/recurrentes/${template.id}/historial`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  Ver historial
                </Link>
                <button
                  onClick={handleGenerateNow}
                  className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-gray-100"
                  disabled={!template.activo || loading}
                >
                  Generar ahora
                </button>
                <button
                  onClick={handleTogglePause}
                  className="w-full text-left px-4 py-2 text-sm text-yellow-700 hover:bg-gray-100"
                  disabled={!template.activo || loading}
                >
                  {template.pausado ? 'Reanudar' : 'Pausar'}
                </button>
                <button
                  onClick={handleToggleActive}
                  className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-gray-100"
                  disabled={loading}
                >
                  {template.activo ? 'Desactivar' : 'Activar'}
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                  disabled={loading}
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-3">
        <div className="text-sm text-gray-600">Cliente</div>
        <div className="font-medium text-gray-900">{template.cliente.razon_social}</div>
      </div>

      {/* Concepto */}
      <div className="mb-3">
        <div className="text-sm text-gray-600">Concepto</div>
        <div className="text-sm text-gray-900 line-clamp-2">{template.concepto}</div>
      </div>

      {/* Total */}
      <div className="mb-3">
        <div className="text-sm text-gray-600">Total factura</div>
        <div className="text-xl font-bold text-blue-600">{formatEuro(total)}</div>
      </div>

      {/* Frecuencia */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-gray-700">{getFrecuenciaLabel(template.frecuencia)}</span>
      </div>

      {/* Próxima generación */}
      <div className={`p-3 rounded-lg ${isProximaSoon() ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
        <div className="text-xs text-gray-600 mb-1">Próxima generación</div>
        <div className={`font-semibold ${isProximaSoon() ? 'text-yellow-800' : 'text-gray-900'}`}>
          {formatDate(template.proxima_generacion)}
        </div>
        {isProximaSoon() && (
          <div className="text-xs text-yellow-700 mt-1">
            ⚠️ Próximamente
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {template.total_facturas_generadas || 0} facturas generadas
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Eliminar plantilla recurrente"
        message={`¿Estás seguro de eliminar la plantilla "${template.nombre_plantilla}"? Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={loading}
      />

      {/* Generate Now Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showGenerateModal}
        title="Generar factura ahora"
        message={`¿Generar factura ahora desde la plantilla "${template.nombre_plantilla}"?`}
        confirmText="Generar"
        cancelText="Cancelar"
        onConfirm={confirmGenerateNow}
        onCancel={() => setShowGenerateModal(false)}
        isDeleting={loading}
      />
    </div>
  );
}

'use client';

interface ConfirmBulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (applyToAll: boolean) => void;
  action: 'edit' | 'delete';
  tipo: 'INGRESO' | 'GASTO';
  seriesCount: number;
  loading?: boolean;
}

export default function ConfirmBulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  tipo,
  seriesCount,
  loading = false,
}: ConfirmBulkActionModalProps) {
  if (!isOpen) return null;

  const isEdit = action === 'edit';
  const tipoLabel = tipo === 'INGRESO' ? 'factura' : 'gasto';
  const tipoLabelPlural = tipo === 'INGRESO' ? 'facturas' : 'gastos';

  const title = isEdit
    ? 'Modificar registro programado'
    : 'Eliminar registro programado';

  const description = `Este ${tipoLabel} forma parte de una serie de ${seriesCount} ${tipoLabelPlural} programados.`;

  const singleOptionLabel = isEdit
    ? `Solo este ${tipoLabel}`
    : `Solo este ${tipoLabel}`;

  const allOptionLabel = isEdit
    ? `Todos los de esta serie (${seriesCount})`
    : `Toda la serie (${seriesCount} ${tipoLabelPlural})`;

  const singleOptionDescription = isEdit
    ? 'Los cambios solo se aplicaran a este registro'
    : 'Los demas registros de la serie se mantendran';

  const allOptionDescription = isEdit
    ? 'Los cambios se aplicaran a todos los registros de esta serie'
    : 'Se eliminaran todos los registros de esta serie permanentemente';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start mb-6">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              isEdit ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              {isEdit ? (
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </div>
            <div className="ml-4">
              <p className="text-gray-600">{description}</p>
              <p className="text-sm text-gray-500 mt-1">
                Que deseas hacer?
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Single option */}
            <button
              onClick={() => onConfirm(false)}
              disabled={loading}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-medium text-gray-900">{singleOptionLabel}</div>
              <div className="text-sm text-gray-500 mt-1">{singleOptionDescription}</div>
            </button>

            {/* All option */}
            <button
              onClick={() => onConfirm(true)}
              disabled={loading}
              className={`w-full text-left p-4 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isEdit
                  ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                  : 'border-red-200 hover:border-red-500 hover:bg-red-50'
              }`}
            >
              <div className={`font-medium ${isEdit ? 'text-gray-900' : 'text-red-700'}`}>
                {allOptionLabel}
              </div>
              <div className={`text-sm mt-1 ${isEdit ? 'text-gray-500' : 'text-red-600'}`}>
                {allOptionDescription}
              </div>
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full mt-4 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="flex items-center">
              <svg className="animate-spin h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-gray-600">Procesando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

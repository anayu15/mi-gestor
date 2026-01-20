'use client';

import { useState } from 'react';

interface StatusToggleProps {
  currentStatus: boolean; // true = Pagado/Cobrado, false = Pendiente
  onChange: (newStatus: boolean, fecha_pago?: string) => Promise<void>;
  disabled?: boolean;
  type?: 'ingreso' | 'gasto'; // ingreso shows "Cobrado", gasto shows "Pagado"
}

export default function StatusToggle({
  currentStatus,
  onChange,
  disabled = false,
  type = 'ingreso'
}: StatusToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);

  const handleToggle = async () => {
    if (disabled || isLoading) return;

    // If marking as paid, show modal for details
    if (!currentStatus) {
      setShowModal(true);
    } else {
      // If unmarking as paid, just do it
      setIsLoading(true);
      try {
        await onChange(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleConfirmPaid = async () => {
    setIsLoading(true);
    try {
      await onChange(true, fechaPago);
      setShowModal(false);
      // Reset date to today for next time
      setFechaPago(new Date().toISOString().split('T')[0]);
    } catch (error) {
      // Error handling is done by parent component
      console.error('Error updating payment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          currentStatus
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
        } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isLoading ? '...' : currentStatus ? (type === 'ingreso' ? 'Cobrado' : 'Pagado') : 'Pendiente'}
      </button>

      {/* Modal for payment details */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">
              {type === 'ingreso' ? 'Marcar como Cobrado' : 'Marcar como Pagado'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{type === 'ingreso' ? 'Fecha de Cobro' : 'Fecha de Pago'}</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPaid}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

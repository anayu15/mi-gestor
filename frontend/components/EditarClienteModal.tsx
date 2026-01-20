'use client';

import { useState, useEffect } from 'react';
import { clients } from '@/lib/api';

interface EditarClienteModalProps {
  isOpen: boolean;
  clientId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditarClienteModal({ isOpen, clientId, onClose, onSuccess }: EditarClienteModalProps) {
  const [formData, setFormData] = useState({
    razon_social: '',
    cif: '',
    direccion: '',
    codigo_postal: '',
    ciudad: '',
    provincia: '',
    telefono: '',
    email: '',
    activo: true,
    es_cliente_principal: false,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasPrincipalClient, setHasPrincipalClient] = useState(false);
  const [principalClientName, setPrincipalClientName] = useState('');

  // Load client data when modal opens
  useEffect(() => {
    if (isOpen && clientId) {
      loadClient();
      checkPrincipalClient();
    }
  }, [isOpen, clientId]);

  async function loadClient() {
    if (!clientId) return;

    setLoading(true);
    setError('');

    try {
      const response = await clients.get(clientId);
      const client = response.data;
      setFormData({
        razon_social: client.razon_social || '',
        cif: client.cif || '',
        direccion: client.direccion || '',
        codigo_postal: client.codigo_postal || '',
        ciudad: client.ciudad || '',
        provincia: client.provincia || '',
        telefono: client.telefono || '',
        email: client.email || '',
        activo: client.activo !== false,
        es_cliente_principal: client.es_cliente_principal || false,
      });
    } catch (err: any) {
      setError(err.message || 'Error al cargar el cliente');
    } finally {
      setLoading(false);
    }
  }

  async function checkPrincipalClient() {
    try {
      const response = await clients.list({ activo: 'all' });
      const principalClient = response.data.find((c: any) =>
        c.es_cliente_principal && c.id !== parseInt(clientId || '0')
      );

      if (principalClient) {
        setHasPrincipalClient(true);
        setPrincipalClientName(principalClient.razon_social);
      } else {
        setHasPrincipalClient(false);
        setPrincipalClientName('');
      }
    } catch (err) {
      // If check fails, silently continue
      console.error('Error checking principal client:', err);
    }
  }

  // Reset form to initial state
  function resetForm() {
    setFormData({
      razon_social: '',
      cif: '',
      direccion: '',
      codigo_postal: '',
      ciudad: '',
      provincia: '',
      telefono: '',
      email: '',
      activo: true,
      es_cliente_principal: false,
    });
    setError('');
    setSuccess('');
    setLoading(false);
    setSaving(false);
  }

  // Handle close with reset
  function handleClose() {
    resetForm();
    onClose();
  }

  // Handle form change
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // Format CIF to uppercase
    if (name === 'cif') {
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  }

  // Handle form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await clients.update(clientId, formData);

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el cliente');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Floating notifications - top right of window */}
      {(error || success) && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm">
          {error && (
            <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-lg shadow-lg border border-rose-200 flex items-start gap-2 animate-in slide-in-from-right duration-200">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-lg shadow-lg border border-emerald-200 flex items-start gap-2 animate-in slide-in-from-right duration-200">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">{success}</p>
              </div>
              <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <h2 className="text-lg font-bold text-slate-800">Editar Cliente</h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto"></div>
                  <p className="mt-4 text-slate-600 text-sm">Cargando cliente...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Nombre / Razón Social */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre / Razón Social *</label>
                    <input
                      type="text"
                      name="razon_social"
                      value={formData.razon_social}
                      onChange={handleChange}
                      placeholder="Nombre del cliente o empresa"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Este nombre identificará a este cliente</p>
                  </div>

                  {/* CIF/NIF */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">CIF/NIF *</label>
                    <input
                      type="text"
                      name="cif"
                      value={formData.cif}
                      onChange={handleChange}
                      placeholder="12345678A o B12345678"
                      maxLength={9}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 font-mono uppercase"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Número de identificación fiscal</p>
                  </div>

                  {/* Dirección */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dirección *</label>
                    <input
                      type="text"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                      placeholder="Calle Principal, 123"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      required
                    />
                  </div>

                  {/* Código Postal */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Código Postal</label>
                    <input
                      type="text"
                      name="codigo_postal"
                      value={formData.codigo_postal}
                      onChange={handleChange}
                      placeholder="28001"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>

                  {/* Ciudad */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ciudad *</label>
                    <input
                      type="text"
                      name="ciudad"
                      value={formData.ciudad}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      required
                    />
                  </div>

                  {/* Provincia */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Provincia</label>
                    <input
                      type="text"
                      name="provincia"
                      value={formData.provincia}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Teléfono</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+34 600 000 000"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>

                  {/* Email */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="contacto@empresa.com"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>

                  {/* Estado Activo/Inactivo */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Estado</label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formData.activo
                            ? 'Este cliente estará disponible para generar facturas'
                            : 'Este cliente no estará disponible para generar facturas'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, activo: !prev.activo }))}
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        style={{ backgroundColor: formData.activo ? '#22c55e' : '#d1d5db' }}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.activo ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Cliente Principal */}
                  <div className="md:col-span-2">
                    <label className={`flex items-center p-3 rounded-lg border ${
                      hasPrincipalClient && !formData.es_cliente_principal
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <input
                        type="checkbox"
                        name="es_cliente_principal"
                        checked={formData.es_cliente_principal}
                        onChange={handleChange}
                        disabled={hasPrincipalClient && !formData.es_cliente_principal}
                        className="mr-3 h-4 w-4 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <span className={`font-medium text-sm ${
                          hasPrincipalClient && !formData.es_cliente_principal
                            ? 'text-gray-500'
                            : 'text-gray-900'
                        }`}>
                          Marcar como cliente principal
                        </span>
                        {hasPrincipalClient && !formData.es_cliente_principal ? (
                          <p className="text-xs text-gray-500 mt-1">
                            Ya tienes un cliente principal: <span className="font-medium">{principalClientName}</span>. Desmarca el actual primero.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-600 mt-1">
                            Para autónomos TRADE: Este es el cliente del que recibes más del 75% de tus ingresos
                          </p>
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors font-medium"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

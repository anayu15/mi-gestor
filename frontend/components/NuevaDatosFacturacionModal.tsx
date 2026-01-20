'use client';

import { useState, useRef, useEffect } from 'react';
import { billingConfigs } from '@/lib/api';

// Helper function to get initials from a name/razon_social
function getInitials(name: string): string {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Generate a consistent background color based on the name
function getInitialsColor(name: string): string {
  const colors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#a855f7', // purple
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f97316', // orange
    '#06b6d4', // cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface NuevaDatosFacturacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NuevaDatosFacturacionModal({ isOpen, onClose, onSuccess }: NuevaDatosFacturacionModalProps) {
  const [formData, setFormData] = useState({
    razon_social: '',
    nif: '',
    direccion: '',
    codigo_postal: '',
    ciudad: '',
    provincia: '',
    telefono: '',
    email_facturacion: '',
    iban: '',
    notas_factura: '',
    activo: true, // Default to active
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form to initial state
  function resetForm() {
    setFormData({
      razon_social: '',
      nif: '',
      direccion: '',
      codigo_postal: '',
      ciudad: '',
      provincia: '',
      telefono: '',
      email_facturacion: '',
      iban: '',
      notas_factura: '',
      activo: true,
    });
    setLogoFile(null);
    setLogoPreview(null);
    setError('');
    setSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Handle close with reset
  function handleClose() {
    resetForm();
    onClose();
  }

  // Handle form change
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;

    // Format IBAN with spaces
    if (name === 'iban') {
      const cleaned = value.replace(/\s/g, '').toUpperCase();
      const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
      setFormData((prev) => ({ ...prev, [name]: formatted }));
    } else if (name === 'nif') {
      // Format NIF to uppercase
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  // Handle logo file selection
  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Solo se permiten imágenes JPG o PNG');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('El archivo no puede superar 2MB');
      return;
    }

    setError('');
    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Remove selected logo
  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Handle form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // First create the config
      const response = await billingConfigs.create(formData);
      const newConfigId = response.data.id;

      // If logo was selected, upload it
      if (logoFile && newConfigId) {
        try {
          await billingConfigs.uploadLogo(newConfigId, logoFile);
        } catch (logoErr: any) {
          console.error('Error uploading logo:', logoErr);
          // Config was created but logo failed - still close and notify
        }
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la configuración');
    } finally {
      setLoading(false);
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
          <h2 className="text-lg font-bold text-slate-800">Nueva Configuración de Facturación</h2>
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
          <form onSubmit={handleSubmit}>
            {/* Logo Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-xs font-semibold text-slate-700 mb-3">Logo de Empresa</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain bg-white border border-gray-300 rounded-lg" />
                  ) : formData.razon_social ? (
                    <div
                      className="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: getInitialsColor(formData.razon_social) }}
                    >
                      {getInitials(formData.razon_social)}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-white border border-gray-300 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleLogoSelect}
                    className="hidden"
                    id="logo-upload-new"
                  />
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="logo-upload-new"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {logoFile ? 'Cambiar' : 'Seleccionar Logo'}
                    </label>
                    {logoFile && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {logoFile ? logoFile.name : 'JPG o PNG, máx 2MB'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Nombre / Razón Social */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre / Razón Social *</label>
                <input
                  type="text"
                  name="razon_social"
                  value={formData.razon_social}
                  onChange={handleChange}
                  placeholder="Tu nombre o nombre de empresa"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Este nombre identificará esta configuración</p>
              </div>

              {/* NIF/CIF */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">NIF/CIF *</label>
                <input
                  type="text"
                  name="nif"
                  value={formData.nif}
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

              {/* Email de Facturación */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email de Facturación</label>
                <input
                  type="email"
                  name="email_facturacion"
                  value={formData.email_facturacion}
                  onChange={handleChange}
                  placeholder="facturacion@tuempresa.com"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
              </div>

              {/* IBAN */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">IBAN *</label>
                <input
                  type="text"
                  name="iban"
                  value={formData.iban}
                  onChange={handleChange}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  maxLength={29}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 font-mono"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Cuenta bancaria para recibir pagos</p>
              </div>

              {/* Notas para Facturas */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas para Facturas</label>
                <textarea
                  name="notas_factura"
                  value={formData.notas_factura}
                  onChange={handleChange}
                  placeholder="Texto legal o notas que aparecerán en el pie de tus facturas"
                  rows={3}
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
                        ? 'Esta configuración estará disponible para generar facturas'
                        : 'Esta configuración no estará disponible para generar facturas'}
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
                disabled={loading}
                className="flex-1 text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors font-medium"
              >
                {loading ? 'Creando...' : 'Crear Configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}

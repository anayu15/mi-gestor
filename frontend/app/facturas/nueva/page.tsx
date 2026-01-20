'use client';

import { useState, useEffect } from 'react';
import { invoices, clients, billingConfigs } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';

interface Client {
  id: string;
  razon_social: string;
  cif: string;
  es_cliente_principal: boolean;
  activo: boolean;
}

interface BillingConfig {
  id: string;
  razon_social: string;
  nif?: string;
  activo: boolean;
  es_principal: boolean;
}

// Helper to normalize numeric input: converts comma to period and removes invalid characters
function normalizeNumericInput(value: string): string {
  // Replace comma with period (for Spanish locale)
  let normalized = value.replace(',', '.');
  // Remove any characters except digits and period
  normalized = normalized.replace(/[^\d.]/g, '');
  // Ensure only one decimal point
  const parts = normalized.split('.');
  if (parts.length > 2) {
    normalized = parts[0] + '.' + parts.slice(1).join('');
  }
  return normalized;
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [billingConfigsList, setBillingConfigsList] = useState<BillingConfig[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBillingConfigs, setLoadingBillingConfigs] = useState(true);
  const [formData, setFormData] = useState({
    cliente_id: '',
    datos_facturacion_id: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    concepto: '',
    periodo_facturacion_inicio: '',
    periodo_facturacion_fin: '',
    base_imponible: '',
    tipo_iva: '21',
    tipo_irpf: '7',
  });
  const [calculatedValues, setCalculatedValues] = useState({
    cuota_iva: 0,
    cuota_irpf: 0,
    total_factura: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await clients.list();
        setClientsList(response.data || []);
      } catch (err: any) {
        setError('Error al cargar clientes. Por favor, crea un cliente primero.');
      } finally {
        setLoadingClients(false);
      }
    }

    async function loadBillingConfigs() {
      try {
        const response = await billingConfigs.list();
        const configsData = response.data || [];
        setBillingConfigsList(configsData);

        // Auto-select principal billing config if exists
        const principalConfig = configsData.find((c: BillingConfig) => c.es_principal);
        if (principalConfig) {
          setFormData(prev => ({ ...prev, datos_facturacion_id: principalConfig.id }));
        }
      } catch (err: any) {
        console.error('Error loading billing configs:', err);
      } finally {
        setLoadingBillingConfigs(false);
      }
    }

    loadClients();
    loadBillingConfigs();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name } = e.target;
    let value = e.target.value;

    // For base_imponible, normalize the input to handle locale differences
    if (name === 'base_imponible') {
      value = normalizeNumericInput(value);
    }

    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    // Auto-calculate if base_imponible, tipo_iva, or tipo_irpf changes
    if (['base_imponible', 'tipo_iva', 'tipo_irpf'].includes(name)) {
      calculateTotals(newFormData);
    }
  }

  function calculateTotals(data: typeof formData) {
    const base = parseFloat(data.base_imponible) || 0;
    const iva = parseFloat(data.tipo_iva) || 0;
    const irpf = parseFloat(data.tipo_irpf) || 0;

    const cuota_iva = Math.round((base * iva) / 100 * 100) / 100;
    const cuota_irpf = Math.round((base * irpf) / 100 * 100) / 100;
    const total_factura = Math.round((base + cuota_iva - cuota_irpf) * 100) / 100;

    setCalculatedValues({ cuota_iva, cuota_irpf, total_factura });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setGeneratedInvoiceNumber('');

    try {
      const submitData = {
        ...formData,
        cliente_id: parseInt(formData.cliente_id),
        datos_facturacion_id: formData.datos_facturacion_id ? parseInt(formData.datos_facturacion_id) : null,
        base_imponible: parseFloat(formData.base_imponible),
        tipo_iva: parseFloat(formData.tipo_iva),
        tipo_irpf: parseFloat(formData.tipo_irpf),
        // Convert empty strings to null for optional date fields
        periodo_facturacion_inicio: formData.periodo_facturacion_inicio || null,
        periodo_facturacion_fin: formData.periodo_facturacion_fin || null,
      };

      const response = await invoices.generate(submitData);

      setGeneratedInvoiceNumber(response.data.numero_factura);
      setSuccess(`Factura ${response.data.numero_factura} generada correctamente`);

      // Reset form after 3 seconds
      setTimeout(() => {
        router.push('/facturas');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Error al generar la factura');
    } finally {
      setLoading(false);
    }
  }

  if (loadingClients || loadingBillingConfigs) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-6">Generar Nueva Factura</h2>

          {clientsList.length === 0 && (
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-6">
              No tienes clientes registrados. {' '}
              <Link href="/facturas/clientes/nuevo" className="font-semibold underline">
                Crear un cliente primero
              </Link>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4">
              <div className="font-semibold mb-2">{success}</div>
              {generatedInvoiceNumber && (
                <div className="text-sm">
                  Número de factura: <span className="font-mono font-bold">{generatedInvoiceNumber}</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Cliente *</label>
                <select
                  name="cliente_id"
                  value={formData.cliente_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={clientsList.length === 0}
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientsList.filter(c => c.activo !== false).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.razon_social} {client.es_cliente_principal ? '⭐ (Principal)' : ''} - {client.cif}
                    </option>
                  ))}
                </select>
              </div>

              {billingConfigsList.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Datos de Facturación *</label>
                  <select
                    name="datos_facturacion_id"
                    value={formData.datos_facturacion_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar datos de facturación...</option>
                    {billingConfigsList.filter(c => c.activo).map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.razon_social} {config.es_principal ? '⭐ (Principal)' : ''} {config.nif ? `- ${config.nif}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Fecha de Emisión *</label>
                <input
                  type="date"
                  name="fecha_emision"
                  value={formData.fecha_emision}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Concepto *</label>
                <textarea
                  name="concepto"
                  value={formData.concepto}
                  onChange={handleChange}
                  placeholder="Ej: Servicios de desarrollo de software - Enero 2024"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Periodo Desde</label>
                <input
                  type="date"
                  name="periodo_facturacion_inicio"
                  value={formData.periodo_facturacion_inicio}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Periodo Hasta</label>
                <input
                  type="date"
                  name="periodo_facturacion_fin"
                  value={formData.periodo_facturacion_fin}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Importes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Base Imponible (€) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="base_imponible"
                    value={formData.base_imponible}
                    onChange={handleChange}
                    placeholder="0.00"
                    pattern="[0-9]*[.,]?[0-9]*"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">IVA (%)</label>
                  <select
                    name="tipo_iva"
                    value={formData.tipo_iva}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0%</option>
                    <option value="4">4%</option>
                    <option value="10">10%</option>
                    <option value="21">21%</option>
                  </select>
                  <div className="text-sm text-green-600 mt-1 font-medium">
                    + {calculatedValues.cuota_iva.toFixed(2)} €
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">IRPF (% Retención)</label>
                  <select
                    name="tipo_irpf"
                    value={formData.tipo_irpf}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0%</option>
                    <option value="7">7%</option>
                    <option value="15">15%</option>
                    <option value="19">19%</option>
                  </select>
                  <div className="text-sm text-red-600 mt-1 font-medium">
                    - {calculatedValues.cuota_irpf.toFixed(2)} €
                  </div>
                </div>

                <div className="flex items-end">
                  <div className="w-full p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="text-sm text-gray-700 mb-1">Total a Cobrar</div>
                    <div className="text-3xl font-bold text-green-600">
                      {calculatedValues.total_factura.toFixed(2)} €
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-gray-700">
                <div className="font-medium mb-1">Desglose:</div>
                <div>Base Imponible: {(parseFloat(formData.base_imponible) || 0).toFixed(2)} €</div>
                <div>+ IVA ({formData.tipo_iva}%): {calculatedValues.cuota_iva.toFixed(2)} €</div>
                <div>- IRPF ({formData.tipo_irpf}%): {calculatedValues.cuota_irpf.toFixed(2)} €</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || clientsList.length === 0}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {loading ? 'Generando...' : 'Generar Factura'}
              </button>
              <Link
                href="/facturas"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

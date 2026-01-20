'use client';

import { useState, useEffect } from 'react';
import { invoices, clients, programaciones, billingConfigs } from '@/lib/api';
import Toast from './Toast';
import ProgramarSection, { ProgramarConfig } from './ProgramarSection';

interface Client {
  id: string;
  nombre: string;
  cif: string;
  es_principal: boolean;
}

interface BillingConfig {
  id: string;
  razon_social: string;
  nif?: string;
  activo: boolean;
  es_principal: boolean;
}

interface EditarFacturaModalProps {
  isOpen: boolean;
  facturaId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  editingSeriesMode?: boolean; // true when editing all items in a series
  programacionId?: string | null; // The programacion ID if editing a series
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

export default function EditarFacturaModal({
  isOpen,
  facturaId,
  onClose,
  onSuccess,
  editingSeriesMode = false,
  programacionId = null
}: EditarFacturaModalProps) {
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [billingConfigsList, setBillingConfigsList] = useState<BillingConfig[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBillingConfigs, setLoadingBillingConfigs] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    cliente_id: '',
    datos_facturacion_id: '',
    fecha_emision: '',
    concepto: '',
    base_imponible: '',
    tipo_iva: '21',
    tipo_irpf: '7',
    estado: 'PENDIENTE',
    fecha_pago: '',
  });
  const [calculatedValues, setCalculatedValues] = useState({
    cuota_iva: 0,
    cuota_irpf: 0,
    total_factura: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');

  // Programar state (for series editing mode)
  const [programarEnabled, setProgramarEnabled] = useState(false);
  const [programarConfig, setProgramarConfig] = useState<ProgramarConfig>({
    periodicidad: 'MENSUAL',
    tipoDia: 'ULTIMO_DIA_LABORAL',
    diaEspecifico: 15,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: null,
    sinFechaFin: true,
  });
  const [originalProgramarConfig, setOriginalProgramarConfig] = useState<ProgramarConfig | null>(null);
  const [previewCount, setPreviewCount] = useState(0);

  // Clean up localStorage when modal closes
  useEffect(() => {
    if (!isOpen) {
      localStorage.removeItem('editApplyToAll');
      setProgramarEnabled(false);
      setOriginalProgramarConfig(null);
    }
  }, [isOpen]);

  useEffect(() => {
    async function loadClients() {
      if (!isOpen) return;

      setLoadingClients(true);
      try {
        const response = await clients.list();
        setClientsList(response.data || []);
      } catch (err: any) {
        setError('Error al cargar clientes.');
      } finally {
        setLoadingClients(false);
      }
    }

    async function loadBillingConfigs() {
      if (!isOpen) return;

      setLoadingBillingConfigs(true);
      try {
        const response = await billingConfigs.list();
        setBillingConfigsList(response.data || []);
      } catch (err: any) {
        console.error('Error loading billing configs:', err);
      } finally {
        setLoadingBillingConfigs(false);
      }
    }

    loadClients();
    loadBillingConfigs();
  }, [isOpen]);

  useEffect(() => {
    async function loadInvoice() {
      if (!facturaId || !isOpen) return;

      setLoadingData(true);
      setError('');

      try {
        const response = await invoices.get(facturaId);
        const invoice = response.data;

        const loadedData = {
          cliente_id: invoice.cliente_id?.toString() || '',
          datos_facturacion_id: invoice.datos_facturacion_id?.toString() || '',
          fecha_emision: invoice.fecha_emision ? invoice.fecha_emision.split('T')[0] : '',
          concepto: invoice.concepto || '',
          base_imponible: invoice.base_imponible?.toString() ?? '',
          tipo_iva: invoice.tipo_iva != null ? Math.floor(parseFloat(invoice.tipo_iva)).toString() : '21',
          tipo_irpf: invoice.tipo_irpf != null ? Math.floor(parseFloat(invoice.tipo_irpf)).toString() : '7',
          estado: invoice.estado || 'PENDIENTE',
          fecha_pago: invoice.fecha_pago ? invoice.fecha_pago.split('T')[0] : '',
        };

        setFormData(loadedData);
        calculateTotals(loadedData);

        // If editing series mode, load programacion data
        if (editingSeriesMode && programacionId) {
          try {
            const progResponse = await programaciones.get(programacionId);
            const prog = progResponse.data;

            const config: ProgramarConfig = {
              periodicidad: prog.periodicidad || 'MENSUAL',
              tipoDia: prog.tipo_dia || 'ULTIMO_DIA_LABORAL',
              diaEspecifico: prog.dia_especifico || 15,
              fechaInicio: prog.fecha_inicio ? prog.fecha_inicio.split('T')[0] : new Date().toISOString().split('T')[0],
              fechaFin: prog.fecha_fin ? prog.fecha_fin.split('T')[0] : null,
              sinFechaFin: !prog.fecha_fin,
            };

            setProgramarConfig(config);
            setOriginalProgramarConfig(config);
            setProgramarEnabled(true); // Force enable and cannot be disabled
          } catch (err) {
            console.error('Error loading programacion:', err);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar la factura');
      } finally {
        setLoadingData(false);
      }
    }

    loadInvoice();
  }, [isOpen, facturaId, editingSeriesMode, programacionId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name } = e.target;
    let value = e.target.value;

    // For base_imponible, normalize the input to handle locale differences
    if (name === 'base_imponible') {
      value = normalizeNumericInput(value);
    }

    let newFormData = { ...formData, [name]: value };

    // Auto-set fecha_pago when estado changes to PAGADA
    if (name === 'estado' && value === 'PAGADA' && !formData.fecha_pago) {
      newFormData.fecha_pago = new Date().toISOString().split('T')[0];
    }
    // Clear fecha_pago when estado changes to PENDIENTE
    if (name === 'estado' && value === 'PENDIENTE') {
      newFormData.fecha_pago = '';
    }

    setFormData(newFormData);

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

  // Check if all required fields are filled
  function isFormValid(): boolean {
    const requiredFilled = !!(
      formData.cliente_id &&
      formData.fecha_emision &&
      formData.concepto.trim() &&
      formData.base_imponible &&
      parseFloat(formData.base_imponible) > 0
    );

    // If estado is PAGADA, fecha_pago is also required
    if (formData.estado === 'PAGADA') {
      return requiredFilled && !!formData.fecha_pago;
    }

    return requiredFilled;
  }

  // Check if programar config has changed (for series regeneration)
  function hasPeriodicityChanged(): boolean {
    if (!editingSeriesMode || !originalProgramarConfig) return false;

    return (
      programarConfig.periodicidad !== originalProgramarConfig.periodicidad ||
      programarConfig.tipoDia !== originalProgramarConfig.tipoDia ||
      programarConfig.diaEspecifico !== originalProgramarConfig.diaEspecifico ||
      programarConfig.fechaInicio !== originalProgramarConfig.fechaInicio ||
      programarConfig.fechaFin !== originalProgramarConfig.fechaFin ||
      programarConfig.sinFechaFin !== originalProgramarConfig.sinFechaFin
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!facturaId) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      const submitData: any = {
        ...formData,
        cliente_id: parseInt(formData.cliente_id),
        datos_facturacion_id: formData.datos_facturacion_id ? parseInt(formData.datos_facturacion_id) : null,
        base_imponible: parseFloat(formData.base_imponible),
        tipo_iva: parseFloat(formData.tipo_iva),
        tipo_irpf: parseFloat(formData.tipo_irpf),
        estado: formData.estado,
      };

      // Only include fecha_pago if estado is PAGADA
      if (formData.estado === 'PAGADA' && formData.fecha_pago) {
        submitData.fecha_pago = formData.fecha_pago;
      }

      let response;

      // If editing series mode and periodicity has changed, regenerate the entire series
      if (editingSeriesMode && programacionId && hasPeriodicityChanged()) {
        const regenerateData = {
          periodicidad: programarConfig.periodicidad,
          tipo_dia: programarConfig.tipoDia,
          dia_especifico: programarConfig.diaEspecifico,
          fecha_inicio: programarConfig.fechaInicio,
          fecha_fin: programarConfig.sinFechaFin ? null : programarConfig.fechaFin,
          datos_base: {
            cliente_id: parseInt(formData.cliente_id),
            datos_facturacion_id: formData.datos_facturacion_id ? parseInt(formData.datos_facturacion_id) : null,
            concepto: formData.concepto,
            base_imponible: parseFloat(formData.base_imponible),
            tipo_iva: parseFloat(formData.tipo_iva),
            tipo_irpf: parseFloat(formData.tipo_irpf),
            estado: formData.estado,
          },
        };

        response = await programaciones.regenerate(programacionId, regenerateData);
        onSuccess();
        onClose();
        return;
      }

      // Otherwise, use standard series update logic
      // Check if this item was part of a series (editApplyToAll will be set)
      // If so, use updateWithSeries which handles removing from series when applyToAll is false
      const editApplyToAllValue = localStorage.getItem('editApplyToAll');
      localStorage.removeItem('editApplyToAll');

      if (editApplyToAllValue !== null || editingSeriesMode) {
        // Item was part of a series - use updateWithSeries
        // If applyToAll=false, backend will remove it from the series
        const applyToAll = editingSeriesMode || editApplyToAllValue === 'true';
        response = await invoices.updateWithSeries(facturaId, submitData, applyToAll);
      } else {
        // Regular item, not part of a series
        response = await invoices.update(facturaId, submitData);
      }

      let successMsg = 'Factura actualizada correctamente';
      if (response.info && response.info.length > 0) {
        successMsg = response.info.join('. ');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la factura');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const isLoading = loadingClients || loadingBillingConfigs || loadingData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <h2 className="text-lg font-bold text-slate-800">
            {editingSeriesMode ? 'Editar Serie de Ingresos' : 'Editar Ingreso'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-5">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando...</p>
            </div>
          ) : (
            <>
              {clientsList.length === 0 && (
                <div className="bg-amber-50 text-amber-500 p-3 rounded-md mb-4 text-sm border border-amber-200">
                  No tienes clientes registrados. Por favor, crea un cliente primero.
                </div>
              )}

              {editingSeriesMode && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-md mb-4 text-sm border border-blue-200">
                  Estas editando toda la serie. Los cambios se aplicaran a todas las facturas programadas.
                </div>
              )}

              {error && (
                <Toast message={error} type="error" onClose={() => setError('')} />
              )}

              {success && (
                <Toast message={success} type="success" onClose={() => setSuccess('')} />
              )}

              {warning && (
                <Toast message={`Advertencia: ${warning}`} type="warning" onClose={() => setWarning('')} />
              )}

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cliente *</label>
                    <select
                      name="cliente_id"
                      value={formData.cliente_id}
                      onChange={handleChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      required
                      disabled={clientsList.length === 0}
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientsList.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.nombre} {client.es_principal ? '⭐' : ''} - {client.cif}
                        </option>
                      ))}
                    </select>
                  </div>

                  {billingConfigsList.length > 0 && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Datos de Facturación *</label>
                      <select
                        name="datos_facturacion_id"
                        value={formData.datos_facturacion_id}
                        onChange={handleChange}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                        required
                      >
                        <option value="">Seleccionar datos de facturación...</option>
                        {billingConfigsList.filter(c => c.activo).map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.razon_social} {config.es_principal ? '⭐' : ''} {config.nif ? `- ${config.nif}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!editingSeriesMode && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha de Emisión *</label>
                        <input
                          type="date"
                          name="fecha_emision"
                          value={formData.fecha_emision}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Estado</label>
                        <select
                          name="estado"
                          value={formData.estado}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="PAGADA">Cobrada</option>
                        </select>
                      </div>

                      {formData.estado === 'PAGADA' && (
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha de Cobro *</label>
                          <input
                            type="date"
                            name="fecha_pago"
                            value={formData.fecha_pago}
                            onChange={handleChange}
                            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                            required={formData.estado === 'PAGADA'}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Concepto *</label>
                    <textarea
                      name="concepto"
                      value={formData.concepto}
                      onChange={handleChange}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                      placeholder="Ej: Servicios de desarrollo de software - Enero 2024"
                      rows={1}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 resize-none overflow-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mb-4">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Importes</h3>

                  {/* Bill-style layout */}
                  <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                    {/* Header row */}
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 grid grid-cols-2 gap-2">
                      <div className="text-xs font-bold text-slate-700">Concepto</div>
                      <div className="text-xs font-bold text-slate-700 text-right">Importe</div>
                    </div>

                    {/* Base Imponible row */}
                    <div className="px-3 py-2.5 border-b border-slate-200 grid grid-cols-2 gap-2 items-center hover:bg-slate-50">
                      <div className="text-xs text-slate-700 font-medium">Base Imponible *</div>
                      <div className="text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          name="base_imponible"
                          value={formData.base_imponible}
                          onChange={handleChange}
                          placeholder="0.00"
                          pattern="[0-9]*[.,]?[0-9]*"
                          className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
                          required
                        />
                      </div>
                    </div>

                    {/* IVA row */}
                    <div className="px-3 py-2.5 border-b border-slate-200 grid grid-cols-2 gap-2 items-center hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700 font-medium">IVA</span>
                        <select
                          name="tipo_iva"
                          value={formData.tipo_iva}
                          onChange={handleChange}
                          className="px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                        >
                          <option value="0">0%</option>
                          <option value="4">4%</option>
                          <option value="10">10%</option>
                          <option value="21">21%</option>
                        </select>
                      </div>
                      <div className="text-right text-xs font-semibold text-emerald-500 font-mono">
                        +{calculatedValues.cuota_iva.toFixed(2)} €
                      </div>
                    </div>

                    {/* IRPF row */}
                    <div className="px-3 py-2.5 border-b-2 border-slate-300 grid grid-cols-2 gap-2 items-center hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700 font-medium">IRPF (Retención)</span>
                        <select
                          name="tipo_irpf"
                          value={formData.tipo_irpf}
                          onChange={handleChange}
                          className="px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                        >
                          <option value="0">0%</option>
                          <option value="7">7%</option>
                          <option value="15">15%</option>
                          <option value="19">19%</option>
                        </select>
                      </div>
                      <div className="text-right text-xs font-semibold text-rose-400 font-mono">
                        -{calculatedValues.cuota_irpf.toFixed(2)} €
                      </div>
                    </div>

                    {/* Total row */}
                    <div className="px-3 py-3 bg-gradient-to-r from-slate-400 to-slate-300 grid grid-cols-2 gap-2 items-center">
                      <div className="text-xs font-bold text-white">TOTAL A COBRAR</div>
                      <div className="text-right text-xs font-bold text-white font-mono">
                        {calculatedValues.total_factura.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                </div>

                {/* Programar Section (forced ON when editing series) */}
                {editingSeriesMode && (
                  <ProgramarSection
                    tipo="INGRESO"
                    enabled={programarEnabled}
                    onEnabledChange={() => {}} // Disabled - cannot toggle off
                    config={programarConfig}
                    onConfigChange={setProgramarConfig}
                    onPreviewChange={setPreviewCount}
                    disabled={true} // Force disabled toggle in series editing mode
                  />
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 transition-colors font-medium text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !isFormValid() || clientsList.length === 0}
                    className="flex-1 bg-emerald-500 text-white py-2 px-4 text-sm rounded-md hover:bg-emerald-600 disabled:bg-slate-300 transition-colors font-semibold shadow-sm"
                  >
                    {loading ? 'Actualizando...' : editingSeriesMode ? 'Actualizar Serie' : 'Actualizar Ingreso'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

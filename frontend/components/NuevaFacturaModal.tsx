'use client';

import { useState, useEffect, useRef } from 'react';
import { invoices, clients, settings, programaciones, billingConfigs } from '@/lib/api';
import ProgramarSection, { ProgramarConfig } from './ProgramarSection';
import ContractUploadSection, { ExtractedContractData, ContractFileState } from './ContractUploadSection';
import Toast from './Toast';

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

interface NuevaFacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId?: string, fechaEmision?: string) => void;
  onOpenSettings?: () => void;
}

// Helper functions for persisting tax preferences
function getPersistedTaxPrefs() {
  if (typeof window === 'undefined') return { tipo_iva: '21', tipo_irpf: '7' };
  const iva = localStorage.getItem('facturaPrefs.tipo_iva') || '21';
  const irpf = localStorage.getItem('facturaPrefs.tipo_irpf') || '7';
  return { tipo_iva: iva, tipo_irpf: irpf };
}

function persistTaxPref(key: 'tipo_iva' | 'tipo_irpf', value: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`facturaPrefs.${key}`, value);
  }
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

export default function NuevaFacturaModal({ isOpen, onClose, onSuccess, onOpenSettings }: NuevaFacturaModalProps) {
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [billingConfigsList, setBillingConfigsList] = useState<BillingConfig[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBillingConfigs, setLoadingBillingConfigs] = useState(true);
  const persistedPrefs = getPersistedTaxPrefs();
  const [formData, setFormData] = useState({
    cliente_id: '',
    datos_facturacion_id: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    concepto: '',
    base_imponible: '',
    tipo_iva: persistedPrefs.tipo_iva,
    tipo_irpf: persistedPrefs.tipo_irpf,
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
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');
  const [pdfReady, setPdfReady] = useState<boolean | null>(null);
  const [pdfWarning, setPdfWarning] = useState('');

  // Programar state
  const [programarEnabled, setProgramarEnabled] = useState(false);
  const [programarConfig, setProgramarConfig] = useState<ProgramarConfig>({
    periodicidad: 'MENSUAL',
    tipoDia: 'ULTIMO_DIA_LABORAL',
    diaEspecifico: 15,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: null,
    sinFechaFin: true,
  });
  const [previewCount, setPreviewCount] = useState(0);

  // Contract state (for programar mode)
  const [contractData, setContractData] = useState<ExtractedContractData | null>(null);
  const [contractDocumentInfo, setContractDocumentInfo] = useState<{
    archivo_url: string;
    archivo_nombre: string;
    archivo_tipo: string;
    archivo_tamanio: number;
  } | null>(null);
  const [contractConfidence, setContractConfidence] = useState<number | null>(null);

  // Contract file state for two-column preview
  const [contractFileState, setContractFileState] = useState<ContractFileState>({
    file: null,
    preview: null,
    previewType: null,
  });

  // Contract extraction processing state
  const [contractProcessing, setContractProcessing] = useState(false);
  const [contractExtractionError, setContractExtractionError] = useState('');

  // Handle contract extraction from preview panel
  async function handleExtractContractData() {
    if (!contractFileState.file) return;

    setContractProcessing(true);
    setContractExtractionError('');

    try {
      const response = await programaciones.extractFromContract(contractFileState.file);

      if (response.success && response.data) {
        const { extracted, confidence: conf, archivo_url, archivo_nombre, archivo_tipo, archivo_tamanio } = response.data;

        // Update state
        setContractData(extracted);
        setContractConfidence(conf);
        setContractDocumentInfo({
          archivo_url,
          archivo_nombre,
          archivo_tipo,
          archivo_tamanio,
        });

        // Auto-fill form with contract data (user is provider, parte_b is client)
        const matchedClient = clientsList.find(c => c.cif === extracted.parte_b_cif);

        setFormData(prev => ({
          ...prev,
          cliente_id: matchedClient?.id || prev.cliente_id,
          concepto: extracted.concepto || prev.concepto,
          base_imponible: extracted.importe?.toString() || prev.base_imponible,
          tipo_iva: extracted.tipo_iva?.toString() || prev.tipo_iva,
          tipo_irpf: extracted.tipo_irpf?.toString() || prev.tipo_irpf,
        }));

        // Auto-fill programar config with contract dates/periodicity
        if (extracted.periodicidad || extracted.fecha_inicio) {
          setProgramarConfig(prev => ({
            ...prev,
            periodicidad: extracted.periodicidad || prev.periodicidad,
            fechaInicio: extracted.fecha_inicio || prev.fechaInicio,
            fechaFin: extracted.fecha_fin || prev.fechaFin,
            sinFechaFin: !extracted.fecha_fin,
          }));
        }

        // Trigger calculations with new data
        calculateTotals({
          base_imponible: extracted.importe?.toString() || formData.base_imponible,
          tipo_iva: extracted.tipo_iva?.toString() || formData.tipo_iva,
          tipo_irpf: extracted.tipo_irpf?.toString() || formData.tipo_irpf,
        });
      }
    } catch (err: any) {
      setContractExtractionError(err.message || 'Error al extraer datos del contrato');
    } finally {
      setContractProcessing(false);
    }
  }

  // Handle contract extraction callback
  function handleContractExtracted(
    data: ExtractedContractData,
    documentInfo: { archivo_url: string; archivo_nombre: string; archivo_tipo: string; archivo_tamanio: number },
    confidence: number
  ) {
    setContractData(data);
    setContractDocumentInfo(documentInfo);
    setContractConfidence(confidence);

    // Auto-fill form with contract data (user is provider, parte_b is client)
    // Try to match client by CIF
    const matchedClient = clientsList.find(c => c.cif === data.parte_b_cif);

    setFormData(prev => ({
      ...prev,
      cliente_id: matchedClient?.id || prev.cliente_id,
      concepto: data.concepto || prev.concepto,
      base_imponible: data.importe?.toString() || prev.base_imponible,
      tipo_iva: data.tipo_iva?.toString() || prev.tipo_iva,
      tipo_irpf: data.tipo_irpf?.toString() || prev.tipo_irpf,
    }));

    // Auto-fill programar config with contract dates/periodicity
    if (data.periodicidad || data.fecha_inicio) {
      setProgramarConfig(prev => ({
        ...prev,
        periodicidad: data.periodicidad || prev.periodicidad,
        fechaInicio: data.fecha_inicio || prev.fechaInicio,
        fechaFin: data.fecha_fin || prev.fechaFin,
        sinFechaFin: !data.fecha_fin,
      }));
    }

    // Trigger calculations with new data
    calculateTotals({
      base_imponible: data.importe?.toString() || formData.base_imponible,
      tipo_iva: data.tipo_iva?.toString() || formData.tipo_iva,
      tipo_irpf: data.tipo_irpf?.toString() || formData.tipo_irpf,
    });
  }

  function handleContractRemoved() {
    setContractData(null);
    setContractDocumentInfo(null);
    setContractConfidence(null);
    // Clear preview - revoke blob URL if it's a PDF
    if (contractFileState.preview && contractFileState.previewType === 'pdf') {
      URL.revokeObjectURL(contractFileState.preview);
    }
    setContractFileState({ file: null, preview: null, previewType: null });
  }

  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadBillingConfigs();
      checkCompanySettings();
    }
  }, [isOpen]);

  async function checkCompanySettings() {
    try {
      const response = await settings.checkPDFReadiness();
      setPdfReady(response.data.ready);
      if (!response.data.ready) {
        setPdfWarning(response.data.message);
      } else {
        setPdfWarning('');
      }
    } catch (err) {
      console.error('Error checking company settings:', err);
      // Don't block if check fails, backend will validate anyway
      setPdfReady(true);
    }
  }

  async function loadClients() {
    try {
      const response = await clients.list();
      const clientsData = response.data || [];
      setClientsList(clientsData);

      // Auto-select principal client if exists and no client is currently selected
      if (!formData.cliente_id) {
        const principalClient = clientsData.find((c: Client) => c.es_cliente_principal && c.activo !== false);
        if (principalClient) {
          setFormData(prev => ({ ...prev, cliente_id: principalClient.id }));
        }
      }
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
      if (!formData.datos_facturacion_id) {
        const principalConfig = configsData.find((c: BillingConfig) => c.es_principal);
        if (principalConfig) {
          setFormData(prev => ({ ...prev, datos_facturacion_id: principalConfig.id }));
        }
      }
    } catch (err: any) {
      console.error('Error loading billing configs:', err);
    } finally {
      setLoadingBillingConfigs(false);
    }
  }

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

    // Persist tax preferences
    if (name === 'tipo_iva' || name === 'tipo_irpf') {
      persistTaxPref(name, value);
    }

    // Auto-calculate if base_imponible, tipo_iva, or tipo_irpf changes
    if (['base_imponible', 'tipo_iva', 'tipo_irpf'].includes(name)) {
      calculateTotals(newFormData);
    }
  }

  function calculateTotals(data: { base_imponible: string; tipo_iva: string; tipo_irpf: string }) {
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
      parseFloat(formData.base_imponible) > 0 &&
      // Require datos_facturacion_id if billing configs exist
      (billingConfigsList.length === 0 || formData.datos_facturacion_id)
    );

    // If estado is PAGADA, fecha_pago is also required
    if (formData.estado === 'PAGADA') {
      return requiredFilled && !!formData.fecha_pago;
    }

    return requiredFilled;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setGeneratedInvoiceNumber('');

    try {
      const baseData: any = {
        cliente_id: parseInt(formData.cliente_id),
        datos_facturacion_id: formData.datos_facturacion_id ? parseInt(formData.datos_facturacion_id) : null,
        concepto: formData.concepto,
        base_imponible: parseFloat(formData.base_imponible),
        tipo_iva: parseFloat(formData.tipo_iva),
        tipo_irpf: parseFloat(formData.tipo_irpf),
        estado: formData.estado,
      };

      // Only include fecha_pago if estado is PAGADA
      if (formData.estado === 'PAGADA' && formData.fecha_pago) {
        baseData.fecha_pago = formData.fecha_pago;
      }

      if (programarEnabled) {
        // Get max year from available years in localStorage for "sin fecha fin" mode
        let targetEndYear: number | undefined;
        if (programarConfig.sinFechaFin) {
          const storedYears: number[] = JSON.parse(localStorage.getItem('facturasCreatedYears') || '[]');
          const currentYear = new Date().getFullYear();
          targetEndYear = storedYears.length > 0 ? Math.max(...storedYears, currentYear) : currentYear;
        }

        // Generate scheduled invoices
        const scheduleData: any = {
          ...baseData,
          periodicidad: programarConfig.periodicidad,
          tipo_dia: programarConfig.tipoDia,
          dia_especifico: programarConfig.tipoDia === 'DIA_ESPECIFICO' ? programarConfig.diaEspecifico : undefined,
          fecha_inicio: programarConfig.fechaInicio,
          fecha_fin: programarConfig.sinFechaFin ? null : programarConfig.fechaFin,
          target_end_year: targetEndYear,
        };

        // Add contract data if available
        if (contractData && contractDocumentInfo) {
          // Include file info within the extracted data (contrato_document_id expects integer ID, not path)
          scheduleData.contrato_datos_extraidos = {
            ...contractData,
            archivo_url: contractDocumentInfo.archivo_url,
            archivo_nombre: contractDocumentInfo.archivo_nombre,
            archivo_tipo: contractDocumentInfo.archivo_tipo,
            archivo_tamanio: contractDocumentInfo.archivo_tamanio,
          };
          scheduleData.contrato_confianza = contractConfidence;
        }

        await invoices.generateScheduled(scheduleData);

        onSuccess();
        onClose();
        resetForm();
      } else {
        // Generate single invoice with retry logic
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            const submitData = {
              ...baseData,
              fecha_emision: formData.fecha_emision,
            };

            const response = await invoices.generate(submitData);

            const createdInvoiceId = response.data.id;
            const createdFechaEmision = formData.fecha_emision;

            onSuccess(createdInvoiceId, createdFechaEmision);
            onClose();
            resetForm();

            break; // Success - exit retry loop

          } catch (err: any) {
            // Check if it's a duplicate invoice number error (race condition)
            const isDuplicateError = err.message?.includes('DUPLICATE_INVOICE_NUMBER') ||
                                    err.message?.includes('duplicate key') ||
                                    err.message?.includes('ya existe');

            if (isDuplicateError && attempt < maxRetries - 1) {
              attempt++;
              console.log(`Duplicate invoice detected, retrying (attempt ${attempt + 1}/${maxRetries})...`);
              // Exponential backoff: 500ms, 1000ms, 1500ms
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              continue; // Retry
            }

            // Other errors or max retries reached
            throw err;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar la factura');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    const prefs = getPersistedTaxPrefs();
    setFormData({
      cliente_id: '',
      datos_facturacion_id: '',
      fecha_emision: new Date().toISOString().split('T')[0],
      concepto: '',
      base_imponible: '',
      tipo_iva: prefs.tipo_iva,
      tipo_irpf: prefs.tipo_irpf,
      estado: 'PENDIENTE',
      fecha_pago: '',
    });
    setCalculatedValues({
      cuota_iva: 0,
      cuota_irpf: 0,
      total_factura: 0,
    });
    setError('');
    setSuccess('');
    setGeneratedInvoiceNumber('');
    // Reset programar state
    setProgramarEnabled(false);
    setProgramarConfig({
      periodicidad: 'MENSUAL',
      tipoDia: 'ULTIMO_DIA_LABORAL',
      diaEspecifico: 15,
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaFin: null,
      sinFechaFin: true,
    });
    setPreviewCount(0);
    // Reset contract state
    setContractData(null);
    setContractDocumentInfo(null);
    setContractConfidence(null);
    // Clear contract preview - revoke blob URL if it's a PDF
    if (contractFileState.preview && contractFileState.previewType === 'pdf') {
      URL.revokeObjectURL(contractFileState.preview);
    }
    setContractFileState({ file: null, preview: null, previewType: null });
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  if (!isOpen) return null;

  // Check if contract preview is available (for two-column layout)
  const hasContractPreview = programarEnabled && contractFileState.preview;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${hasContractPreview ? 'max-w-7xl' : 'max-w-2xl'} max-h-[90vh] overflow-hidden border border-gray-200 transition-all duration-300`}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <h2 className="text-lg font-bold text-slate-800">Generar Nuevo Ingreso</h2>
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
        <div className="max-h-[calc(90vh-80px)]">
          <div className={`flex gap-6 p-5 ${hasContractPreview ? 'flex-row' : 'flex-col'}`}>
            {/* Left column: Contract Preview Panel - only shown when contract file is uploaded */}
            {hasContractPreview && (
              <div className="flex-shrink-0 w-[500px] overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="relative mb-3">
                    {contractFileState.previewType === 'pdf' ? (
                      <div className="w-full h-[350px] bg-white rounded-md border border-slate-300 overflow-hidden">
                        <iframe
                          src={contractFileState.preview || ''}
                          className="w-full h-full border-0"
                          title="Vista previa del contrato"
                        />
                      </div>
                    ) : (
                      <img
                        src={contractFileState.preview || ''}
                        alt="Vista previa del contrato"
                        className="w-full max-h-[350px] object-contain rounded-md border border-slate-300 shadow-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={handleContractRemoved}
                      className="absolute -top-2 -right-2 bg-rose-400 text-white rounded-full p-1.5 hover:bg-rose-500 transition-colors shadow-md"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* File info */}
                  <div className="flex items-center justify-between mb-3 p-2 bg-white rounded-md border border-slate-200">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs text-slate-600 truncate max-w-[200px]">
                        {contractFileState.file?.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {contractFileState.file ? (contractFileState.file.size / 1024).toFixed(1) : 0} KB
                    </span>
                  </div>

                  {/* Extract button - show when not yet extracted */}
                  {!contractData && (
                    <button
                      type="button"
                      onClick={handleExtractContractData}
                      disabled={contractProcessing}
                      className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                    >
                      {contractProcessing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Extraer datos del contrato
                        </>
                      )}
                    </button>
                  )}

                  {/* Extraction error */}
                  {contractExtractionError && (
                    <div className="mb-3 p-2 bg-red-50 rounded-md border border-red-200">
                      <p className="text-xs text-red-600">{contractExtractionError}</p>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {contractConfidence !== null && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">Confianza de extraccion</span>
                        <span className="text-xs font-medium text-slate-700">{contractConfidence}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            contractConfidence >= 80 ? 'bg-emerald-500' :
                            contractConfidence >= 60 ? 'bg-amber-500' :
                            'bg-rose-400'
                          }`}
                          style={{ width: `${contractConfidence}%` }}
                        />
                      </div>
                      {contractConfidence < 80 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Se recomienda revisar los datos extraidos
                        </p>
                      )}
                    </div>
                  )}

                  {/* Extraction notes */}
                  {contractData?.notas_extraccion && contractData.notas_extraccion.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                      <div className="flex items-start gap-1.5 text-blue-700">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <span className="text-xs font-medium block mb-1">Notas sobre la extraccion:</span>
                          <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
                            {contractData.notas_extraccion.map((nota, index) => (
                              <li key={index}>{nota}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 text-center">
                    Los datos se pueden editar en el formulario
                  </p>
                </div>
              </div>
            )}

            {/* Right column: Form */}
            <div className={`flex-1 overflow-y-auto max-h-[calc(90vh-140px)] ${hasContractPreview ? 'max-w-2xl' : ''}`}>
              <div className="pb-6">
          {loadingClients || loadingBillingConfigs ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando datos...</p>
            </div>
          ) : (
            <>
              {clientsList.length === 0 && (
                <div className="bg-amber-50 text-amber-500 p-3 rounded-md mb-4 text-sm border border-amber-200">
                  No tienes clientes registrados. Por favor, crea un cliente primero.
                </div>
              )}

              {pdfReady === false && (
                <div className="bg-orange-50 border border-orange-200 text-orange-500 p-3 rounded-md mb-4">
                  <div className="flex items-start">
                    <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-semibold mb-1 text-xs">Configuración incompleta</p>
                      <p className="text-xs mb-2">{pdfWarning}</p>
                      <button
                        type="button"
                        className="text-orange-500 underline font-medium text-xs hover:text-orange-600"
                        onClick={() => {
                          handleClose();
                          if (onOpenSettings) {
                            onOpenSettings();
                          }
                        }}
                      >
                        Ir a Configuración →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Toast message={error} type="error" onClose={() => setError('')} />
              )}

              {success && (
                <Toast
                  message={generatedInvoiceNumber ? `${success} - Número: ${generatedInvoiceNumber}` : success}
                  type="success"
                  onClose={() => setSuccess('')}
                />
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
                      {clientsList.filter(c => c.activo !== false).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.razon_social} {client.es_cliente_principal ? '⭐' : ''} - {client.cif}
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

                {/* Programar Section */}
                <ProgramarSection
                  tipo="INGRESO"
                  enabled={programarEnabled}
                  onEnabledChange={setProgramarEnabled}
                  config={programarConfig}
                  onConfigChange={setProgramarConfig}
                  onPreviewChange={setPreviewCount}
                />

                {/* Contract Upload Section */}
                <ContractUploadSection
                  tipo="INGRESO"
                  enabled={programarEnabled}
                  onContractExtracted={handleContractExtracted}
                  onContractRemoved={handleContractRemoved}
                  externalPreviewMode={true}
                  onFileStateChange={setContractFileState}
                  fileState={contractFileState}
                />

                {/* Show message if contract is attached but client not found */}
                {programarEnabled && contractData && contractData.parte_b_nombre && !formData.cliente_id && (
                  <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-medium">
                        Cliente del contrato: {contractData.parte_b_nombre} ({contractData.parte_b_cif}) - No encontrado, selecciona uno o crealo
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 transition-colors font-medium text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !isFormValid() || clientsList.length === 0 || pdfReady === false || (programarEnabled && previewCount === 0)}
                    className="flex-1 bg-emerald-500 text-white py-2 px-4 text-sm rounded-md hover:bg-emerald-600 disabled:bg-slate-300 transition-colors font-semibold shadow-sm"
                  >
                    {loading
                      ? (programarEnabled ? 'Generando...' : 'Generando...')
                      : (programarEnabled
                          ? `Generar ${previewCount} Ingreso${previewCount !== 1 ? 's' : ''}`
                          : 'Generar Ingreso'
                        )
                    }
                  </button>
                </div>
              </form>
            </>
          )}
              </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

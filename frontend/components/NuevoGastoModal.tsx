'use client';

import { useState, useRef } from 'react';
import { expenses, programaciones } from '@/lib/api';
import ProgramarSection, { ProgramarConfig } from './ProgramarSection';
import ContractUploadSection, { ExtractedContractData, ContractFileState } from './ContractUploadSection';
import Toast from './Toast';

const IVA_OPTIONS = [0, 4, 10, 21];
const IRPF_OPTIONS = [0, 7, 15, 19];

interface NuevoGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper functions for persisting tax preferences
function getPersistedGastoTaxPrefs() {
  if (typeof window === 'undefined') return { tipo_iva: '21', tipo_irpf: '0' };
  const iva = localStorage.getItem('gastoPrefs.tipo_iva') || '21';
  const irpf = localStorage.getItem('gastoPrefs.tipo_irpf') || '0';
  return { tipo_iva: iva, tipo_irpf: irpf };
}

function persistGastoTaxPref(key: 'tipo_iva' | 'tipo_irpf', value: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`gastoPrefs.${key}`, value);
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

export default function NuevoGastoModal({ isOpen, onClose, onSuccess }: NuevoGastoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistedPrefs = getPersistedGastoTaxPrefs();

  const [formData, setFormData] = useState({
    concepto: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    proveedor_nombre: '',
    proveedor_cif: '',
    base_imponible: '',
    tipo_iva: persistedPrefs.tipo_iva,
    tipo_irpf: persistedPrefs.tipo_irpf,
    pagado: false,
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
  const [warnings, setWarnings] = useState<string[]>([]);

  // OCR-specific state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

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

        // Auto-fill form with contract data (user is client, parte_a is provider)
        setFormData(prev => ({
          ...prev,
          concepto: extracted.concepto || prev.concepto,
          proveedor_nombre: extracted.parte_a_nombre || prev.proveedor_nombre,
          proveedor_cif: extracted.parte_a_cif || prev.proveedor_cif,
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

    // Auto-fill form with contract data (user is client, parte_a is provider)
    setFormData(prev => ({
      ...prev,
      concepto: data.concepto || prev.concepto,
      proveedor_nombre: data.parte_a_nombre || prev.proveedor_nombre,
      proveedor_cif: data.parte_a_cif || prev.proveedor_cif,
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

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Solo se aceptan archivos JPG, JPEG, PNG o PDF');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('El archivo no puede superar 5MB');
      return;
    }

    setUploadedFile(file);
    setError('');

    // Create preview
    if (file.type === 'application/pdf') {
      // For PDF, create blob URL for iframe preview
      const blobUrl = URL.createObjectURL(file);
      setImagePreview(blobUrl);
      setPreviewType('pdf');
    } else {
      // For images, create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPreviewType('image');
      };
      reader.readAsDataURL(file);
    }
  }

  // Handle OCR extraction
  async function handleExtractData() {
    if (!uploadedFile) return;

    setOcrProcessing(true);
    setError('');
    setWarnings([]);

    try {
      const response = await expenses.extractFromInvoice(uploadedFile);

      setOcrData(response.data);
      setOcrConfidence(response.data.confidence);

      // Auto-fill form with extracted data
      if (response.data.extracted) {
        const extracted = response.data.extracted;
        setFormData({
          ...formData,
          concepto: extracted.concepto || formData.concepto,
          fecha_emision: extracted.fecha_emision || formData.fecha_emision,
          proveedor_nombre: extracted.proveedor_nombre || formData.proveedor_nombre,
          proveedor_cif: extracted.proveedor_cif || formData.proveedor_cif,
          base_imponible: extracted.base_imponible?.toString() || formData.base_imponible,
          tipo_iva: extracted.tipo_iva?.toString() || formData.tipo_iva,
          tipo_irpf: extracted.tipo_irpf?.toString() || formData.tipo_irpf,
        });

        // Trigger calculations
        calculateTotals({
          base_imponible: extracted.base_imponible?.toString() || formData.base_imponible,
          tipo_iva: extracted.tipo_iva?.toString() || formData.tipo_iva,
          tipo_irpf: extracted.tipo_irpf?.toString() || formData.tipo_irpf,
        });
      }

      setSuccess(`Datos extraídos con confianza del ${response.data.confidence}%`);

      if (response.data.requiresReview) {
        setWarnings(['Se recomienda revisar los datos extraídos antes de guardar']);
      }
    } catch (err: any) {
      setError(err.message || 'Error al extraer datos de la factura');
    } finally {
      setOcrProcessing(false);
    }
  }

  // Handle clear file
  function handleClearFile() {
    // Revoke blob URL to prevent memory leaks (only for PDFs)
    if (imagePreview && previewType === 'pdf') {
      URL.revokeObjectURL(imagePreview);
    }
    setUploadedFile(null);
    setImagePreview(null);
    setPreviewType(null);
    setOcrData(null);
    setOcrConfidence(null);
    setSuccess('');
    setWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Reset form to initial state
  function resetForm() {
    // Revoke blob URL to prevent memory leaks (only for PDFs)
    if (imagePreview && previewType === 'pdf') {
      URL.revokeObjectURL(imagePreview);
    }
    const prefs = getPersistedGastoTaxPrefs();
    setFormData({
      concepto: '',
      fecha_emision: new Date().toISOString().split('T')[0],
      proveedor_nombre: '',
      proveedor_cif: '',
      base_imponible: '',
      tipo_iva: prefs.tipo_iva,
      tipo_irpf: prefs.tipo_irpf,
      pagado: false,
      fecha_pago: '',
    });
    setCalculatedValues({
      cuota_iva: 0,
      cuota_irpf: 0,
      total_factura: 0,
    });
    setError('');
    setSuccess('');
    setWarnings([]);
    setUploadedFile(null);
    setImagePreview(null);
    setPreviewType(null);
    setOcrData(null);
    setOcrConfidence(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset programar state
    setProgramarEnabled(false);
    // Reset contract state
    setContractData(null);
    setContractDocumentInfo(null);
    setContractConfidence(null);
    // Clear contract preview - revoke blob URL if it's a PDF
    if (contractFileState.preview && contractFileState.previewType === 'pdf') {
      URL.revokeObjectURL(contractFileState.preview);
    }
    setContractFileState({ file: null, preview: null, previewType: null });
    setProgramarConfig({
      periodicidad: 'MENSUAL',
      tipoDia: 'ULTIMO_DIA_LABORAL',
      diaEspecifico: 15,
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaFin: null,
      sinFechaFin: true,
    });
    setPreviewCount(0);
  }

  // Handle close with reset
  function handleClose() {
    resetForm();
    onClose();
  }

  // Calculate totals
  function calculateTotals(data: any) {
    const base = parseFloat(data.base_imponible) || 0;
    const tipoIva = parseFloat(data.tipo_iva) || 0;
    const tipoIrpf = parseFloat(data.tipo_irpf) || 0;

    const cuota_iva = (base * tipoIva) / 100;
    const cuota_irpf = (base * tipoIrpf) / 100;
    const total_factura = base + cuota_iva - cuota_irpf;

    setCalculatedValues({
      cuota_iva: parseFloat(cuota_iva.toFixed(2)),
      cuota_irpf: parseFloat(cuota_irpf.toFixed(2)),
      total_factura: parseFloat(total_factura.toFixed(2)),
    });
  }

  // Handle form change
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name } = e.target;
    let value = e.target.value;
    let newFormData: any = { ...formData };

    // For base_imponible, normalize the input to handle locale differences
    if (name === 'base_imponible') {
      value = normalizeNumericInput(value);
    }

    // Handle pagado field (convert string to boolean)
    if (name === 'pagado') {
      newFormData.pagado = value === 'true';
      // Auto-set fecha_pago when pagado changes to true
      if (value === 'true' && !formData.fecha_pago) {
        newFormData.fecha_pago = new Date().toISOString().split('T')[0];
      }
      // Clear fecha_pago when pagado changes to false
      if (value === 'false') {
        newFormData.fecha_pago = '';
      }
    } else {
      newFormData[name] = value;
    }

    setFormData(newFormData);

    // Persist tax preferences
    if (name === 'tipo_iva' || name === 'tipo_irpf') {
      persistGastoTaxPref(name, value);
    }

    // Recalculate if financial fields change
    if (['base_imponible', 'tipo_iva', 'tipo_irpf'].includes(name)) {
      calculateTotals(newFormData);
    }
  }

  // Check if all required fields are filled
  function isFormValid(): boolean {
    const requiredFilled = !!(
      formData.concepto.trim() &&
      formData.fecha_emision &&
      formData.proveedor_nombre.trim() &&
      formData.base_imponible &&
      parseFloat(formData.base_imponible) > 0
    );

    // If pagado is true, fecha_pago is also required
    if (formData.pagado) {
      return requiredFilled && !!formData.fecha_pago;
    }

    return requiredFilled;
  }

  // Handle form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const baseData: any = {
        concepto: formData.concepto,
        proveedor_nombre: formData.proveedor_nombre,
        proveedor_cif: formData.proveedor_cif,
        base_imponible: parseFloat(formData.base_imponible as string) || 0,
        tipo_iva: parseFloat(formData.tipo_iva) || 0,
        tipo_irpf: parseFloat(formData.tipo_irpf) || 0,
        ...calculatedValues,
        pagado: formData.pagado,
      };

      // Only include fecha_pago if pagado is true
      if (formData.pagado && formData.fecha_pago) {
        baseData.fecha_pago = formData.fecha_pago;
      }

      // Add OCR data if available
      if (ocrData) {
        baseData.ocr_procesado = true;
        baseData.ocr_confianza = ocrData.confidence;
        baseData.ocr_datos_extraidos = ocrData.extracted;
        baseData.archivo_url = ocrData.archivo_url;
        baseData.archivo_nombre = ocrData.archivo_nombre;
        baseData.archivo_tipo = ocrData.archivo_tipo;
      }

      if (programarEnabled) {
        // Get max year from available years in localStorage for "sin fecha fin" mode
        let targetEndYear: number | undefined;
        if (programarConfig.sinFechaFin) {
          const storedYears: number[] = JSON.parse(localStorage.getItem('facturasCreatedYears') || '[]');
          const currentYear = new Date().getFullYear();
          targetEndYear = storedYears.length > 0 ? Math.max(...storedYears, currentYear) : currentYear;
        }

        // Create scheduled expenses
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

        await expenses.createScheduled(scheduleData);

        onSuccess();
        handleClose();
      } else {
        // Create single expense
        const submitData = {
          ...baseData,
          fecha_emision: formData.fecha_emision,
        };

        await expenses.create(submitData);

        onSuccess();
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear el gasto');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  // Check if any preview is available (for two-column layout)
  const hasContractPreview = programarEnabled && !uploadedFile && contractFileState.preview;
  const hasAnyPreview = imagePreview || hasContractPreview;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${hasAnyPreview ? 'max-w-7xl' : 'max-w-2xl'} max-h-[90vh] overflow-hidden border border-gray-200 transition-all duration-300`}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <h2 className="text-lg font-bold text-slate-800">Generar Nuevo Gasto</h2>
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
          <div className={`flex gap-6 p-6 ${hasAnyPreview ? 'flex-row' : 'flex-col'}`}>
            {/* Left column: OCR Upload Panel - only shown when file is uploaded */}
            {imagePreview && (
              <div className="flex-shrink-0 w-[500px] overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="relative mb-3">
                    {previewType === 'pdf' ? (
                      <div className="w-full h-[450px] bg-white rounded-md border border-slate-300 overflow-hidden">
                        <iframe
                          src={imagePreview || ''}
                          className="w-full h-full border-0"
                          title="Vista previa de PDF"
                        />
                      </div>
                    ) : (
                      <img
                        src={imagePreview || ''}
                        alt="Vista previa de factura"
                        className="w-full max-h-[450px] object-contain rounded-md border border-slate-300 shadow-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="absolute -top-2 -right-2 bg-rose-400 text-white rounded-full p-1.5 hover:bg-rose-500 transition-colors shadow-md"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {ocrConfidence !== null && (
                    <div className="mb-3 p-2.5 bg-white rounded-md border border-slate-200">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">
                        Confianza: {ocrConfidence}%
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            ocrConfidence >= 80 ? 'bg-emerald-500' :
                            ocrConfidence >= 60 ? 'bg-amber-500' :
                            'bg-rose-400'
                          }`}
                          style={{ width: `${ocrConfidence}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExtractData}
                    disabled={ocrProcessing}
                    className="w-full bg-slate-400 text-white text-xs py-2 rounded-md hover:bg-slate-500 disabled:bg-slate-300 transition-colors font-medium"
                  >
                    {ocrProcessing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Extrayendo datos...
                      </span>
                    ) : (
                      'Extraer datos'
                    )}
                  </button>

                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Los datos se pueden editar después
                  </p>
                </div>
              </div>
            )}

            {/* Left column: Contract Preview Panel - shown when contract file is uploaded (programar mode, no receipt) */}
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

            {/* Right column: Expense Form */}
            <div className={`flex-1 overflow-y-auto max-h-[calc(90vh-140px)] ${hasAnyPreview ? 'max-w-2xl' : ''}`}>
              <div className="pb-6">
              {error && (
                <Toast message={error} type="error" onClose={() => setError('')} />
              )}

              {success && (
                <Toast message={success} type="success" onClose={() => setSuccess('')} />
              )}

              {warnings.length > 0 && (
                <Toast
                  message={`Alertas: ${warnings.join('; ')}`}
                  type="warning"
                  onClose={() => setWarnings([])}
                />
              )}

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Upload button when no file uploaded */}
                  {!imagePreview && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Extraer datos de factura (Opcional)</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="invoice-upload-modal"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-slate-400 text-white text-sm px-3 py-1.5 rounded-md hover:bg-slate-500 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Subir factura
                      </button>
                      <p className="text-xs text-slate-500 mt-1.5">
                        JPG, PNG, PDF (max 5MB)
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Proveedor *</label>
                    <input
                      type="text"
                      name="proveedor_nombre"
                      value={formData.proveedor_nombre}
                      onChange={handleChange}
                      placeholder="Nombre del proveedor"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">NIF/CIF Proveedor</label>
                    <input
                      type="text"
                      name="proveedor_cif"
                      value={formData.proveedor_cif}
                      onChange={handleChange}
                      placeholder="12345678A o B12345678"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>

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
                      name="pagado"
                      value={formData.pagado.toString()}
                      onChange={handleChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    >
                      <option value="false">Pendiente</option>
                      <option value="true">Pagado</option>
                    </select>
                  </div>

                  {formData.pagado && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha de Pago *</label>
                      <input
                        type="date"
                        name="fecha_pago"
                        value={formData.fecha_pago}
                        onChange={handleChange}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                        required={formData.pagado}
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
                      placeholder="Ej: Factura alquiler oficina enero 2024"
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
                          {IVA_OPTIONS.map((iva) => (
                            <option key={iva} value={iva}>{iva}%</option>
                          ))}
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
                          {IRPF_OPTIONS.map((irpf) => (
                            <option key={irpf} value={irpf}>{irpf}%</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-right text-xs font-semibold text-rose-400 font-mono">
                        -{calculatedValues.cuota_irpf.toFixed(2)} €
                      </div>
                    </div>

                    {/* Total row */}
                    <div className="px-3 py-3 bg-gradient-to-r from-slate-400 to-slate-300 grid grid-cols-2 gap-2 items-center">
                      <div className="text-xs font-bold text-white">TOTAL A PAGAR</div>
                      <div className="text-right text-xs font-bold text-white font-mono">
                        {calculatedValues.total_factura.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                </div>

                {/* Programar Section */}
                <ProgramarSection
                  tipo="GASTO"
                  enabled={programarEnabled}
                  onEnabledChange={setProgramarEnabled}
                  config={programarConfig}
                  onConfigChange={setProgramarConfig}
                  onPreviewChange={setPreviewCount}
                />

                {/* Contract Upload Section - only when programar enabled and no receipt uploaded */}
                {!uploadedFile && (
                  <ContractUploadSection
                    tipo="GASTO"
                    enabled={programarEnabled}
                    onContractExtracted={handleContractExtracted}
                    onContractRemoved={handleContractRemoved}
                    externalPreviewMode={true}
                    onFileStateChange={setContractFileState}
                    fileState={contractFileState}
                  />
                )}

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
                    disabled={loading || !isFormValid() || (programarEnabled && previewCount === 0)}
                    className="flex-1 text-sm bg-rose-400 text-white px-4 py-2 rounded-md hover:bg-rose-500 disabled:bg-slate-300 transition-colors font-medium"
                  >
                    {loading
                      ? (programarEnabled ? 'Creando gastos...' : 'Generando...')
                      : (programarEnabled
                          ? `Crear ${previewCount} Gasto${previewCount !== 1 ? 's' : ''}`
                          : 'Generar Gasto'
                        )
                    }
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

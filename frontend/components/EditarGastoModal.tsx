'use client';

import { useState, useEffect, useRef } from 'react';
import { expenses, programaciones } from '@/lib/api';
import Toast from './Toast';
import ProgramarSection, { ProgramarConfig } from './ProgramarSection';

const IVA_OPTIONS = [0, 4, 10, 21];
const IRPF_OPTIONS = [0, 7, 15, 19];

interface EditarGastoModalProps {
  isOpen: boolean;
  gastoId: string | null;
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

export default function EditarGastoModal({
  isOpen,
  gastoId,
  onClose,
  onSuccess,
  editingSeriesMode = false,
  programacionId = null
}: EditarGastoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    concepto: '',
    fecha_emision: '',
    proveedor_nombre: '',
    proveedor_cif: '',
    base_imponible: '',
    tipo_iva: '21',
    tipo_irpf: '0',
    pagado: false,
    fecha_pago: '',
  });
  const [calculatedValues, setCalculatedValues] = useState({
    cuota_iva: 0,
    cuota_irpf: 0,
    total_factura: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
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

  // Existing file state
  const [hasExistingFile, setHasExistingFile] = useState(false);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileType, setExistingFileType] = useState<string | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

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
    async function loadExpense() {
      if (!gastoId) return;

      setLoadingData(true);
      setError('');

      try {
        const response = await expenses.get(gastoId);
        const expense = response.data;

        const loadedData = {
          concepto: expense.concepto || '',
          fecha_emision: expense.fecha_emision ? expense.fecha_emision.split('T')[0] : '',
          proveedor_nombre: expense.proveedor_nombre || '',
          proveedor_cif: expense.proveedor_cif || '',
          base_imponible: expense.base_imponible?.toString() ?? '',
          tipo_iva: expense.tipo_iva != null ? Math.floor(parseFloat(expense.tipo_iva)).toString() : '21',
          tipo_irpf: expense.tipo_irpf != null ? Math.floor(parseFloat(expense.tipo_irpf)).toString() : '0',
          pagado: expense.pagado || false,
          fecha_pago: expense.fecha_pago ? expense.fecha_pago.split('T')[0] : '',
        };

        setFormData(loadedData);
        calculateTotals(loadedData);

        // Check if expense has an attached file (only load if NOT editing series)
        // Files are specific to individual expenses, not series
        if (expense.archivo_url && !editingSeriesMode) {
          setHasExistingFile(true);
          setExistingFileName(expense.archivo_nombre || 'archivo');
          setExistingFileType(expense.archivo_tipo || 'application/octet-stream');

          // Load the existing file for preview
          await loadExistingFile(gastoId, expense.archivo_tipo);
        }

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
        setError(err.message || 'Error al cargar el gasto');
      } finally {
        setLoadingData(false);
      }
    }

    async function loadExistingFile(expenseId: string, fileType: string) {
      try {
        const token = localStorage.getItem('token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

        const response = await fetch(`${API_URL}/expenses/${expenseId}/file`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Error loading existing file');
          return;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setExistingFileUrl(blobUrl);

        // Set preview based on file type
        if (fileType === 'application/pdf') {
          setImagePreview(blobUrl);
          setPreviewType('pdf');
        } else if (fileType.startsWith('image/')) {
          setImagePreview(blobUrl);
          setPreviewType('image');
        }
      } catch (err) {
        console.error('Error loading existing file:', err);
      }
    }

    if (isOpen && gastoId) {
      loadExpense();
      setRemoveExistingFile(false); // Reset removal flag
    } else if (!isOpen) {
      // Reset state when modal is closed
      // Revoke blob URL to prevent memory leaks (only for PDFs)
      if (imagePreview && previewType === 'pdf') {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      setPreviewType(null);
      setUploadedFile(null);
      setOcrData(null);
      setOcrConfidence(null);
      setHasExistingFile(false);
      setExistingFileName(null);
      setExistingFileType(null);
      setRemoveExistingFile(false);
      setSuccess('');
      setWarnings([]);
      setError('');

      // Cleanup blob URL
      if (existingFileUrl) {
        URL.revokeObjectURL(existingFileUrl);
        setExistingFileUrl(null);
      }
    }

    // Cleanup blob URL on unmount
    return () => {
      if (existingFileUrl) {
        URL.revokeObjectURL(existingFileUrl);
      }
    };
  }, [isOpen, gastoId, editingSeriesMode, programacionId]);

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

    // If there's an existing file, clean up its blob URL
    if (existingFileUrl) {
      URL.revokeObjectURL(existingFileUrl);
      setExistingFileUrl(null);
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
        const newFormData = {
          ...formData,
          concepto: extracted.concepto || formData.concepto,
          fecha_emision: extracted.fecha_emision || formData.fecha_emision,
          proveedor_nombre: extracted.proveedor_nombre || formData.proveedor_nombre,
          proveedor_cif: extracted.proveedor_cif || formData.proveedor_cif,
          base_imponible: extracted.base_imponible?.toString() || formData.base_imponible,
          tipo_iva: extracted.tipo_iva?.toString() || formData.tipo_iva,
          tipo_irpf: extracted.tipo_irpf?.toString() || formData.tipo_irpf,
        };
        setFormData(newFormData);
        calculateTotals(newFormData);
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
    // Revoke blob URL to prevent memory leaks (only for PDFs or uploaded files)
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

    // If clearing an existing file, mark it for removal
    if (hasExistingFile && !uploadedFile) {
      setRemoveExistingFile(true);
    }

    // Clear existing file state
    setHasExistingFile(false);
    if (existingFileUrl) {
      URL.revokeObjectURL(existingFileUrl);
    }
    setExistingFileUrl(null);
    setExistingFileName(null);
    setExistingFileType(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name } = e.target;
    let value = e.target.value;

    // For base_imponible, normalize the input to handle locale differences
    if (name === 'base_imponible') {
      value = normalizeNumericInput(value);
    }

    const newFormData = { ...formData, [name]: value };
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
    if (!gastoId) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setWarnings([]);

    try {
      // If there's a new file uploaded but OCR hasn't been run, upload the file without extraction
      let fileData = ocrData;
      if (uploadedFile && !ocrData) {
        try {
          // Upload the file using the OCR endpoint, but we won't use the extracted data
          // We only need the file metadata (archivo_url, archivo_nombre, archivo_tipo)
          const response = await expenses.extractFromInvoice(uploadedFile);
          fileData = {
            archivo_url: response.data.archivo_url,
            archivo_nombre: response.data.archivo_nombre,
            archivo_tipo: response.data.archivo_tipo,
            // Don't include OCR data since user didn't click "Extraer datos"
          };
        } catch (err: any) {
          setError('Error al subir el archivo. Por favor, intenta de nuevo.');
          setLoading(false);
          return;
        }
      }

      const submitData: any = {
        ...formData,
        base_imponible: parseFloat(formData.base_imponible),
        tipo_iva: parseFloat(formData.tipo_iva),
        tipo_irpf: parseFloat(formData.tipo_irpf),
        pagado: formData.pagado,
      };

      // Only include fecha_pago if pagado is true
      if (formData.pagado && formData.fecha_pago) {
        submitData.fecha_pago = formData.fecha_pago;
      }

      // Add file/OCR data if available
      if (fileData) {
        // If OCR was explicitly run (ocrData exists), include all OCR data
        if (ocrData) {
          submitData.ocr_procesado = true;
          submitData.ocr_confianza = ocrData.confidence;
          submitData.ocr_datos_extraidos = ocrData.extracted;
        }
        // Always include file metadata
        submitData.archivo_url = fileData.archivo_url;
        submitData.archivo_nombre = fileData.archivo_nombre;
        submitData.archivo_tipo = fileData.archivo_tipo;
      } else if (removeExistingFile) {
        // User explicitly removed the existing file
        submitData.archivo_url = null;
        submitData.archivo_nombre = null;
        submitData.archivo_tipo = null;
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
            concepto: formData.concepto,
            proveedor_nombre: formData.proveedor_nombre,
            proveedor_cif: formData.proveedor_cif,
            base_imponible: parseFloat(formData.base_imponible),
            tipo_iva: parseFloat(formData.tipo_iva),
            tipo_irpf: parseFloat(formData.tipo_irpf),
          },
        };

        response = await programaciones.regenerate(programacionId, regenerateData);
        onSuccess();
        onClose();
        return;
      }

      // Check if this item was part of a series (editApplyToAll will be set)
      // If so, use updateWithSeries which handles removing from series when applyToAll is false
      const editApplyToAllValue = localStorage.getItem('editApplyToAll');
      localStorage.removeItem('editApplyToAll');

      if (editApplyToAllValue !== null || editingSeriesMode) {
        // Item was part of a series - use updateWithSeries
        // If applyToAll=false, backend will remove it from the series
        const applyToAll = editingSeriesMode || editApplyToAllValue === 'true';
        response = await expenses.updateWithSeries(gastoId, submitData, applyToAll);
      } else {
        // Regular item, not part of a series
        response = await expenses.update(gastoId, submitData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el gasto');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${imagePreview && !editingSeriesMode ? 'max-w-7xl' : 'max-w-2xl'} max-h-[90vh] overflow-hidden border border-gray-200 transition-all duration-300`}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <h2 className="text-lg font-bold text-slate-800">
            {editingSeriesMode ? 'Editar Serie de Gastos' : 'Editar Gasto'}
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
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loadingData ? (
            <div className="text-center py-12 px-5">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando gasto...</p>
            </div>
          ) : (
            <div className={`flex gap-6 p-6 ${imagePreview && !editingSeriesMode ? 'flex-row' : 'flex-col'}`}>
              {/* Left column: OCR Upload Panel - only shown when file is uploaded or exists, AND not editing series */}
              {imagePreview && !editingSeriesMode && (
                <div className="flex-shrink-0 w-[500px]">
                  <div className="bg-slate-50 rounded-lg p-4 sticky top-0 border border-slate-200">
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
                        title={hasExistingFile && !uploadedFile ? "Eliminar archivo existente" : "Eliminar archivo"}
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

                    {/* Only show extract button for newly uploaded files */}
                    {uploadedFile && (
                      <>
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
                      </>
                    )}

                    {/* Show update button for existing files */}
                    {hasExistingFile && !uploadedFile && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-slate-400 text-white text-xs py-2 rounded-md hover:bg-slate-500 transition-colors font-medium"
                        >
                          Actualizar archivo
                        </button>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          Puedes eliminarlo o reemplazarlo
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Right column: Expense Form */}
              <div className={`flex-1 ${imagePreview && !editingSeriesMode ? 'max-w-2xl' : ''}`}>
                {editingSeriesMode && (
                  <div className="bg-blue-50 text-blue-700 p-3 rounded-md mb-4 text-sm border border-blue-200">
                    Estas editando toda la serie. Los cambios se aplicaran a todos los gastos programados.
                  </div>
                )}

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
                  {/* Hidden file input - always present */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="invoice-upload-edit-modal"
                  />

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Upload button when no file uploaded - only show when NOT editing series */}
                    {!imagePreview && !editingSeriesMode && (
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Extraer datos de factura (Opcional)</label>
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
                            name="pagado"
                            value={formData.pagado ? 'true' : 'false'}
                            onChange={(e) => {
                              const isPagado = e.target.value === 'true';
                              const newFormData = {
                                ...formData,
                                pagado: isPagado,
                                fecha_pago: isPagado && !formData.fecha_pago
                                  ? new Date().toISOString().split('T')[0]
                                  : (!isPagado ? '' : formData.fecha_pago)
                              };
                              setFormData(newFormData);
                            }}
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

                  {/* Programar Section (forced ON when editing series) */}
                  {editingSeriesMode && (
                    <ProgramarSection
                      tipo="GASTO"
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
                      className="flex-1 text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !isFormValid()}
                      className="flex-1 text-sm bg-rose-400 text-white px-4 py-2 rounded-md hover:bg-rose-500 disabled:bg-slate-300 transition-colors font-medium"
                    >
                      {loading ? 'Actualizando...' : editingSeriesMode ? 'Actualizar Serie' : 'Actualizar Gasto'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

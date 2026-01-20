'use client';

import { useState, useRef } from 'react';
import { programaciones } from '@/lib/api';

export interface ContractFileState {
  file: File | null;
  preview: string | null;
  previewType: 'image' | 'pdf' | null;
}

export interface ExtractedContractData {
  parte_a_nombre?: string;
  parte_a_cif?: string;
  parte_b_nombre?: string;
  parte_b_cif?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  importe?: number;
  periodicidad?: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
  tipo_iva?: number;
  tipo_irpf?: number;
  concepto?: string;
  categoria?: string;
  condiciones_pago?: string;
  clausula_renovacion?: string;
  tipo_contrato?: string;
  // Extraction notes - explanations for approximations or decisions made by AI
  notas_extraccion?: string[];
}

interface ContractUploadSectionProps {
  tipo: 'INGRESO' | 'GASTO';
  enabled: boolean;
  onContractExtracted: (data: ExtractedContractData, documentInfo: {
    archivo_url: string;
    archivo_nombre: string;
    archivo_tipo: string;
    archivo_tamanio: number;
  }, confidence: number) => void;
  onContractRemoved: () => void;
  // Props for external preview mode (two-column layout)
  externalPreviewMode?: boolean;
  onFileStateChange?: (state: ContractFileState) => void;
  fileState?: ContractFileState;
  // Props for external control of extraction (used when parent renders the preview panel)
  onProcessingChange?: (processing: boolean) => void;
  onExtractedDataChange?: (data: ExtractedContractData | null, confidence: number | null) => void;
  externalExtractedData?: ExtractedContractData | null;
  externalConfidence?: number | null;
  externalProcessing?: boolean;
}

export default function ContractUploadSection({
  tipo,
  enabled,
  onContractExtracted,
  onContractRemoved,
  externalPreviewMode = false,
  onFileStateChange,
  fileState,
  onProcessingChange,
  onExtractedDataChange,
  externalExtractedData,
  externalConfidence,
  externalProcessing,
}: ContractUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Internal state (used when not in external preview mode)
  const [internalUploadedFile, setInternalUploadedFile] = useState<File | null>(null);
  const [internalPreview, setInternalPreview] = useState<string | null>(null);
  const [internalPreviewType, setInternalPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [error, setError] = useState('');
  const [internalExtractedData, setInternalExtractedData] = useState<ExtractedContractData | null>(null);
  const [internalConfidence, setInternalConfidence] = useState<number | null>(null);

  // Use external or internal state based on mode
  const uploadedFile = externalPreviewMode && fileState ? fileState.file : internalUploadedFile;
  const preview = externalPreviewMode && fileState ? fileState.preview : internalPreview;
  const previewType = externalPreviewMode && fileState ? fileState.previewType : internalPreviewType;
  const processing = externalPreviewMode && externalProcessing !== undefined ? externalProcessing : internalProcessing;
  const extractedData = externalPreviewMode && externalExtractedData !== undefined ? externalExtractedData : internalExtractedData;
  const confidence = externalPreviewMode && externalConfidence !== undefined ? externalConfidence : internalConfidence;

  // Helper to update processing state
  const setProcessing = (value: boolean) => {
    if (externalPreviewMode && onProcessingChange) {
      onProcessingChange(value);
    } else {
      setInternalProcessing(value);
    }
  };

  // Helper to update extracted data and confidence
  const setExtractedDataAndConfidence = (data: ExtractedContractData | null, conf: number | null) => {
    if (externalPreviewMode && onExtractedDataChange) {
      onExtractedDataChange(data, conf);
    } else {
      setInternalExtractedData(data);
      setInternalConfidence(conf);
    }
  };

  if (!enabled) return null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Solo se aceptan archivos JPG, JPEG, PNG o PDF');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('El archivo no puede superar 10MB');
      return;
    }

    setError('');
    setExtractedDataAndConfidence(null, null);

    // Create preview
    if (file.type === 'application/pdf') {
      const blobUrl = URL.createObjectURL(file);
      if (externalPreviewMode && onFileStateChange) {
        onFileStateChange({ file, preview: blobUrl, previewType: 'pdf' });
      } else {
        setInternalUploadedFile(file);
        setInternalPreview(blobUrl);
        setInternalPreviewType('pdf');
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        const previewUrl = reader.result as string;
        if (externalPreviewMode && onFileStateChange) {
          onFileStateChange({ file, preview: previewUrl, previewType: 'image' });
        } else {
          setInternalUploadedFile(file);
          setInternalPreview(previewUrl);
          setInternalPreviewType('image');
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleExtractData() {
    if (!uploadedFile) return;

    setProcessing(true);
    setError('');

    try {
      const response = await programaciones.extractFromContract(uploadedFile);

      if (response.success && response.data) {
        const { extracted, confidence: conf, archivo_url, archivo_nombre, archivo_tipo, archivo_tamanio } = response.data;

        setExtractedDataAndConfidence(extracted, conf);

        // Notify parent with extracted data
        onContractExtracted(extracted, {
          archivo_url,
          archivo_nombre,
          archivo_tipo,
          archivo_tamanio,
        }, conf);
      }
    } catch (err: any) {
      setError(err.message || 'Error al extraer datos del contrato');
    } finally {
      setProcessing(false);
    }
  }

  function handleClearFile() {
    if (preview && previewType === 'pdf') {
      URL.revokeObjectURL(preview);
    }
    if (externalPreviewMode && onFileStateChange) {
      onFileStateChange({ file: null, preview: null, previewType: null });
    } else {
      setInternalUploadedFile(null);
      setInternalPreview(null);
      setInternalPreviewType(null);
    }
    setExtractedDataAndConfidence(null, null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onContractRemoved();
  }

  // Get confidence color
  function getConfidenceColor(conf: number): string {
    if (conf >= 80) return 'bg-green-500';
    if (conf >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }

  const tipoLabel = tipo === 'INGRESO' ? 'ingreso' : 'gasto';

  // In external preview mode with a file uploaded, hide this section completely
  // (the parent renders the preview panel with all controls)
  if (externalPreviewMode && uploadedFile) {
    return null;
  }

  return (
    <div className="border-t border-slate-200 pt-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">Contrato (opcional)</h3>
        {uploadedFile && !externalPreviewMode && (
          <button
            type="button"
            onClick={handleClearFile}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Eliminar contrato
          </button>
        )}
      </div>

      {!uploadedFile ? (
        <div className="bg-slate-50 rounded-lg p-4 border border-dashed border-slate-300">
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-xs text-slate-600">
              Adjunta el contrato para extraer automaticamente los datos del {tipoLabel}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDF, JPG, PNG (max 10MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              id="contract-upload"
            />
            <label
              htmlFor="contract-upload"
              className="mt-3 inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              Seleccionar archivo
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          {/* File preview - only show in embedded mode (not external preview mode) */}
          {!externalPreviewMode && (
            <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden bg-white">
              {previewType === 'pdf' ? (
                <iframe
                  src={preview || ''}
                  className="w-full h-48"
                  title="Vista previa del contrato"
                />
              ) : (
                <img
                  src={preview || ''}
                  alt="Vista previa del contrato"
                  className="w-full h-48 object-contain"
                />
              )}
            </div>
          )}

          {/* File info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-slate-600 truncate max-w-[150px]">
                {uploadedFile.name}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {(uploadedFile.size / 1024).toFixed(1)} KB
            </span>
          </div>

          {/* Extract button */}
          {!extractedData && (
            <button
              type="button"
              onClick={handleExtractData}
              disabled={processing}
              className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
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

          {/* Confidence indicator */}
          {confidence !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600">Confianza de extraccion</span>
                <span className="text-xs font-medium text-slate-700">{confidence}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${getConfidenceColor(confidence)}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              {confidence < 80 && (
                <p className="text-xs text-amber-600 mt-1">
                  Se recomienda revisar los datos extraidos
                </p>
              )}
            </div>
          )}

          {/* Extraction notes - shows approximations and AI decisions */}
          {extractedData?.notas_extraccion && extractedData.notas_extraccion.length > 0 && (
            <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-start gap-1.5 text-blue-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <span className="text-xs font-medium block mb-1">Notas sobre la extraccion:</span>
                  <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
                    {extractedData.notas_extraccion.map((nota, index) => (
                      <li key={index}>{nota}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

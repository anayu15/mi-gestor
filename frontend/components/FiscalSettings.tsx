'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, dashboard, fiscal, TipoDocumento036 } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import { TRAMOS_COTIZACION_2026, obtenerTramoPorRendimientos, calcularCuotaPorBase, formatEuro } from '@/lib/cotizacion';

interface UserPreferences {
  // Existing model preferences
  mostrar_modelo_303: boolean;
  mostrar_modelo_130: boolean;
  mostrar_modelo_115: boolean;
  mostrar_modelo_180: boolean;
  mostrar_modelo_390: boolean;
  // New IVA models
  mostrar_modelo_349: boolean;
  mostrar_sii: boolean;
  // New IRPF models
  mostrar_modelo_131: boolean;
  mostrar_modelo_100: boolean;
  // New Retenciones models
  mostrar_modelo_111: boolean;
  mostrar_modelo_190: boolean;
  mostrar_modelo_123: boolean;
  // Declaraciones Informativas
  mostrar_modelo_347: boolean;
  // Registros Censales
  mostrar_vies_roi: boolean;
  mostrar_redeme: boolean;
  // Situation flags
  tiene_empleados: boolean;
  tiene_operaciones_ue: boolean;
  usa_modulos: boolean;
  // Other
  tiene_tarifa_plana_ss: boolean;
  base_cotizacion: number | null;
  timezone: string;
  idioma: string;
  // Fecha de alta en AEAT
  fecha_alta_aeat: string | null;
}

interface SectionState {
  iva: boolean;
  irpf: boolean;
  retenciones: boolean;
  informativas: boolean;
  registros: boolean;
  seguridadSocial: boolean;
}

interface Modelo036Analysis {
  id: number;
  document_id: number;
  archivo_nombre?: string;
  created_at: string;
  datos_extraidos: {
    nif?: string;
    nombre_razon_social?: string;
    fecha_alta_actividad?: string;
    epigrafe_iae?: string;
    regimen_iva?: string;
    regimen_irpf?: string;
  };
  recomendaciones: Record<string, { requerido: boolean; explicacion: string }>;
  confianza: number;
}

interface Modelo036Mismatch {
  ai_recomienda: boolean;
  usuario_activo: boolean;
  explicacion: string;
  mismatch: boolean;
}

interface AltaSSAnalysis {
  id: number;
  document_id: number;
  archivo_nombre?: string;
  created_at: string;
  datos_extraidos: {
    nif?: string;
    nombre_completo?: string;
    numero_afiliacion?: string;
    fecha_alta_reta?: string;
    fecha_efectos?: string;
    actividad_economica?: string;
    base_cotizacion_elegida?: number;
    tiene_tarifa_plana?: boolean;
    tipo_bonificacion?: string;
    fecha_inicio_bonificacion?: string;
    fecha_fin_bonificacion?: string;
    cuota_bonificada?: number;
  };
  recomendaciones: {
    tarifa_plana: { requerido: boolean; explicacion: string };
    base_cotizacion: { valor_recomendado: number | null; explicacion: string };
  };
  confianza: number;
}

type TabType = 'aeat' | 'seguridadSocial';

interface FiscalSettingsProps {
  onClose?: () => void;
  onPreferenceChange?: () => void | Promise<void>;
}

export default function FiscalSettings({ onClose, onPreferenceChange }: FiscalSettingsProps) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [rendimientoNetoMensual, setRendimientoNetoMensual] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedSections, setExpandedSections] = useState<SectionState>({
    iva: true,
    irpf: true,
    retenciones: true,
    informativas: true,
    registros: true,
    seguridadSocial: true,
  });
  const [activeTab, setActiveTab] = useState<TabType>('aeat');

  // Modelo 036 state
  const [modelo036Analysis, setModelo036Analysis] = useState<Modelo036Analysis | null>(null);
  const [modelo036Mismatches, setModelo036Mismatches] = useState<Record<string, Modelo036Mismatch>>({});
  const [uploading036, setUploading036] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modelo036History, setModelo036History] = useState<any[]>([]);
  const [selectedDocumentModal, setSelectedDocumentModal] = useState<{
    documentId: number;
    analysisId: number;
    fileName: string;
    analysis: any;
    pdfUrl?: string;
  } | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload type selection modal state
  const [showUploadTypeModal, setShowUploadTypeModal] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [selectedUploadType, setSelectedUploadType] = useState<TipoDocumento036>('ALTA');

  // Alta SS state
  const [altaSSAnalysis, setAltaSSAnalysis] = useState<AltaSSAnalysis | null>(null);
  const [uploadingAltaSS, setUploadingAltaSS] = useState(false);
  const altaSSFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPreferences();
    loadRendimientos();
    loadModelo036Analysis();
    loadAltaSSAnalysis();
  }, []);

  async function loadPreferences() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await auth.getMe();
      setPreferences({
        mostrar_modelo_303: response.data.mostrar_modelo_303 ?? true,
        mostrar_modelo_130: response.data.mostrar_modelo_130 ?? true,
        mostrar_modelo_115: response.data.mostrar_modelo_115 ?? false,
        mostrar_modelo_180: response.data.mostrar_modelo_180 ?? false,
        mostrar_modelo_390: response.data.mostrar_modelo_390 ?? false,
        mostrar_modelo_349: response.data.mostrar_modelo_349 ?? false,
        mostrar_sii: response.data.mostrar_sii ?? false,
        mostrar_modelo_131: response.data.mostrar_modelo_131 ?? false,
        mostrar_modelo_100: response.data.mostrar_modelo_100 ?? false,
        mostrar_modelo_111: response.data.mostrar_modelo_111 ?? false,
        mostrar_modelo_190: response.data.mostrar_modelo_190 ?? false,
        mostrar_modelo_123: response.data.mostrar_modelo_123 ?? false,
        mostrar_modelo_347: response.data.mostrar_modelo_347 ?? false,
        mostrar_vies_roi: response.data.mostrar_vies_roi ?? false,
        mostrar_redeme: response.data.mostrar_redeme ?? false,
        tiene_empleados: response.data.tiene_empleados ?? false,
        tiene_operaciones_ue: response.data.tiene_operaciones_ue ?? false,
        usa_modulos: response.data.usa_modulos ?? false,
        tiene_tarifa_plana_ss: response.data.tiene_tarifa_plana_ss ?? false,
        base_cotizacion: response.data.base_cotizacion ? parseFloat(response.data.base_cotizacion) : null,
        timezone: response.data.timezone,
        idioma: response.data.idioma,
        fecha_alta_aeat: response.data.fecha_alta_aeat ?? null,
      });
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticacion')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar las preferencias');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadRendimientos() {
    try {
      const currentYear = new Date().getFullYear();
      const response = await dashboard.summary(currentYear);
      const ingresos = response.data.ingresos_totales || 0;
      const gastos = Math.abs(response.data.gastos_totales || 0);
      const beneficioAnual = ingresos - gastos;
      const rendimientoMensual = beneficioAnual / 12;
      setRendimientoNetoMensual(rendimientoMensual);
    } catch (err) {
      console.error('Error al cargar rendimientos:', err);
    }
  }

  async function loadModelo036Analysis() {
    try {
      const response = await fiscal.getModelo036Analysis();
      if (response.data) {
        setModelo036Analysis(response.data);
        // Load mismatches
        const mismatchResponse = await fiscal.getModelo036Mismatches();
        if (mismatchResponse.data?.recommendations) {
          setModelo036Mismatches(mismatchResponse.data.recommendations);
        }
      }
      // Also load history
      await loadModelo036History();
    } catch (err) {
      // No analysis yet - that's ok
      console.log('No hay analisis de Modelo 036 previo');
    }
  }

  async function loadModelo036History() {
    try {
      const response = await fiscal.getModelo036History();
      if (response.data?.items) {
        setModelo036History(response.data.items);
      }
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  }

  async function handleUpload036(file: File, tipoDocumento: TipoDocumento036 = 'ALTA') {
    setUploading036(true);
    setError('');
    try {
      const response = await fiscal.uploadModelo036(file, tipoDocumento);
      const analysisData = {
        id: response.data.analysis_id,
        document_id: response.data.document_id,
        archivo_nombre: file.name,
        created_at: new Date().toISOString(),
        datos_extraidos: response.data.datos_extraidos,
        recomendaciones: response.data.recomendaciones,
        confianza: response.data.confianza,
      };
      setModelo036Analysis(analysisData);

      // Immediately add the new document to history (optimistic update for instant UI feedback)
      // This must happen right after upload success, before any other async operations
      const newHistoryItem = {
        id: response.data.analysis_id,
        document_id: response.data.document_id,
        tipo_documento: tipoDocumento,
        parent_analysis_id: response.data.parent_analysis_id,
        is_active: true,
        campos_modificados: response.data.campos_modificados,
        fecha_efectos: response.data.fecha_efectos,
        archivo_nombre: file.name,
        nif: response.data.datos_extraidos?.nif,
        nombre_razon_social: response.data.datos_extraidos?.nombre_razon_social,
        fecha_presentacion: response.data.datos_extraidos?.fecha_presentacion,
        fecha_alta_actividad: response.data.datos_extraidos?.fecha_alta_actividad,
        epigrafe_iae: response.data.datos_extraidos?.epigrafe_iae,
        regimen_iva: response.data.datos_extraidos?.regimen_iva,
        regimen_irpf: response.data.datos_extraidos?.regimen_irpf,
        confianza: response.data.confianza,
        created_at: new Date().toISOString(),
      };
      
      // For ALTA documents, mark previous ALTA documents as inactive in local state
      if (tipoDocumento === 'ALTA') {
        setModelo036History(prev => {
          const updated = prev.map(item => ({
            ...item,
            is_active: item.tipo_documento === 'MODIFICACION' ? item.is_active : false,
          }));
          return [newHistoryItem, ...updated];
        });
      } else {
        setModelo036History(prev => [newHistoryItem, ...prev]);
      }

      // Extract fecha_alta_actividad from the document (this is the registration date with Hacienda)
      const fechaAltaActividad = response.data.datos_extraidos?.fecha_alta_actividad;

      // Auto-apply AI recommendations to toggles
      if (preferences && response.data.recomendaciones) {
        const rec = response.data.recomendaciones;
        const updatedPrefs = { ...preferences };

        // Apply recommendations
        if (rec.modelo_303) updatedPrefs.mostrar_modelo_303 = rec.modelo_303.requerido;
        if (rec.modelo_390) updatedPrefs.mostrar_modelo_390 = rec.modelo_390.requerido;
        if (rec.modelo_349) updatedPrefs.mostrar_modelo_349 = rec.modelo_349.requerido;
        if (rec.sii) updatedPrefs.mostrar_sii = rec.sii.requerido;
        if (rec.modelo_115) updatedPrefs.mostrar_modelo_115 = rec.modelo_115.requerido;
        if (rec.modelo_180) updatedPrefs.mostrar_modelo_180 = rec.modelo_180.requerido;
        if (rec.modelo_111) updatedPrefs.mostrar_modelo_111 = rec.modelo_111.requerido;
        if (rec.modelo_190) updatedPrefs.mostrar_modelo_190 = rec.modelo_190.requerido;
        if (rec.vies_roi) updatedPrefs.mostrar_vies_roi = rec.vies_roi.requerido;

        // Handle 130/131 mutual exclusivity
        if (rec.modelo_130?.requerido && rec.modelo_131?.requerido === false) {
          updatedPrefs.mostrar_modelo_130 = true;
          updatedPrefs.mostrar_modelo_131 = false;
          updatedPrefs.usa_modulos = false;
        } else if (rec.modelo_131?.requerido && rec.modelo_130?.requerido === false) {
          updatedPrefs.mostrar_modelo_131 = true;
          updatedPrefs.mostrar_modelo_130 = false;
          updatedPrefs.usa_modulos = true;
        }

        // Auto-set fecha_alta_aeat from the extracted fecha_alta_actividad
        if (fechaAltaActividad) {
          updatedPrefs.fecha_alta_aeat = fechaAltaActividad;
        }

        // Update local state
        setPreferences(updatedPrefs);

        // Persist AI recommendations to the database (including fecha_alta_aeat if extracted)
        try {
          const prefsToSave: any = {
            mostrar_modelo_303: updatedPrefs.mostrar_modelo_303,
            mostrar_modelo_390: updatedPrefs.mostrar_modelo_390,
            mostrar_modelo_349: updatedPrefs.mostrar_modelo_349,
            mostrar_sii: updatedPrefs.mostrar_sii,
            mostrar_modelo_115: updatedPrefs.mostrar_modelo_115,
            mostrar_modelo_180: updatedPrefs.mostrar_modelo_180,
            mostrar_modelo_111: updatedPrefs.mostrar_modelo_111,
            mostrar_modelo_190: updatedPrefs.mostrar_modelo_190,
            mostrar_vies_roi: updatedPrefs.mostrar_vies_roi,
            mostrar_modelo_130: updatedPrefs.mostrar_modelo_130,
            mostrar_modelo_131: updatedPrefs.mostrar_modelo_131,
            usa_modulos: updatedPrefs.usa_modulos,
          };
          
          // Include fecha_alta_aeat if it was extracted from the document
          if (fechaAltaActividad) {
            prefsToSave.fecha_alta_aeat = fechaAltaActividad;
          }
          
          await auth.updatePreferences(prefsToSave);
          // Note: onPreferenceChange is called at the end of the function
        } catch (saveErr: any) {
          console.error('Error al guardar preferencias del 036:', saveErr);
          // Still show success for analysis, but note the save issue
          setSuccess('Modelo 036 analizado correctamente, pero hubo un error al guardar las preferencias.');
          return;
        }
      } else if (fechaAltaActividad) {
        // Even if there are no recommendations, we should still save the fecha_alta_aeat
        try {
          await auth.updatePreferences({ fecha_alta_aeat: fechaAltaActividad });
          if (preferences) {
            setPreferences({ ...preferences, fecha_alta_aeat: fechaAltaActividad });
          }
          // Note: onPreferenceChange is called at the end of the function
        } catch (saveErr: any) {
          console.error('Error al guardar fecha de alta:', saveErr);
        }
      }

      // Build success message based on document type
      if (tipoDocumento === 'MODIFICACION') {
        const camposModificados = response.data.campos_modificados?.length || 0;
        if (camposModificados > 0) {
          setSuccess(`Modificación del Modelo 036 analizada correctamente. Se han actualizado ${camposModificados} campos. Ambos documentos permanecen en vigor.`);
        } else {
          setSuccess('Modificación del Modelo 036 analizada correctamente. Ambos documentos permanecen en vigor.');
        }
      } else if (fechaAltaActividad) {
        const fechaFormateada = new Date(fechaAltaActividad).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        setSuccess(`Modelo 036 analizado correctamente. Fecha de alta en Hacienda configurada automáticamente: ${fechaFormateada}`);
      } else {
        setSuccess('Modelo 036 analizado correctamente. Configuración actualizada y guardada.');
      }

      // Reload preferences from server to ensure we have the persisted values
      // The backend now auto-applies AI recommendations, so this ensures frontend is in sync
      await loadPreferences();
      
      // Reload mismatches and also refresh history from server for consistency
      const mismatchResponse = await fiscal.getModelo036Mismatches();
      if (mismatchResponse.data?.recommendations) {
        setModelo036Mismatches(mismatchResponse.data.recommendations);
      }
      await loadModelo036History();
      
      // ALWAYS notify parent that preferences changed at the end of successful upload
      // This ensures the parent page (calendario) refreshes and shows updated data
      // Await the callback to ensure parent is fully refreshed before user can interact
      if (onPreferenceChange) {
        await onPreferenceChange();
      }
    } catch (err: any) {
      setError(err.message || 'Error al analizar el Modelo 036');
    } finally {
      setUploading036(false);
    }
  }

  async function handleDelete036() {
    if (!confirm('¿Estas seguro de que deseas eliminar el documento Modelo 036 y su analisis?')) {
      return;
    }

    try {
      await fiscal.deleteModelo036Analysis();
      setModelo036Analysis(null);
      setModelo036Mismatches({});
      setModelo036History([]);
      setSuccess('Documento eliminado correctamente');
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el documento');
    }
  }

  async function handleDelete036ById(analysisId: number, e?: React.MouseEvent) {
    // Prevent opening the document modal when clicking delete
    if (e) {
      e.stopPropagation();
    }

    if (!confirm('¿Estas seguro de que deseas eliminar este documento Modelo 036 y su analisis?')) {
      return;
    }

    try {
      await fiscal.deleteModelo036AnalysisById(analysisId);
      
      // Update local state
      const updatedHistory = modelo036History.filter(item => item.id !== analysisId);
      setModelo036History(updatedHistory);
      
      // If we deleted the current analysis, clear it
      if (modelo036Analysis?.id === analysisId) {
        setModelo036Analysis(null);
        setModelo036Mismatches({});
      }
      
      setSuccess('Documento eliminado correctamente');
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el documento');
    }
  }

  async function openDocumentModal(historyItem: any) {
    setLoadingDocument(true);
    try {
      // Load full analysis for this item
      const response = await fiscal.getModelo036AnalysisById(historyItem.id);
      if (response.data) {
        // Fetch document as blob
        const token = localStorage.getItem('token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
        const docResponse = await fetch(`${API_URL}/documents/view/document/${historyItem.document_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let pdfUrl = '';
        if (docResponse.ok) {
          const blob = await docResponse.blob();
          pdfUrl = URL.createObjectURL(blob);
        }

        setSelectedDocumentModal({
          documentId: historyItem.document_id,
          analysisId: historyItem.id,
          fileName: historyItem.archivo_nombre || `Modelo 036 #${historyItem.id}`,
          analysis: response.data,
          pdfUrl,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el analisis');
    } finally {
      setLoadingDocument(false);
    }
  }

  // Cleanup blob URL when modal closes
  function closeDocumentModal() {
    if (selectedDocumentModal?.pdfUrl) {
      URL.revokeObjectURL(selectedDocumentModal.pdfUrl);
    }
    setSelectedDocumentModal(null);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // If there's already an existing document, show the type selection modal
      if (modelo036History.length > 0) {
        setPendingUploadFile(file);
        setSelectedUploadType('ALTA'); // Default to ALTA
        setShowUploadTypeModal(true);
      } else {
        // First upload, directly upload as ALTA
        handleUpload036(file, 'ALTA');
      }
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleUploadTypeConfirm() {
    if (pendingUploadFile) {
      handleUpload036(pendingUploadFile, selectedUploadType);
      setPendingUploadFile(null);
      setShowUploadTypeModal(false);
    }
  }

  function handleUploadTypeCancel() {
    setPendingUploadFile(null);
    setShowUploadTypeModal(false);
  }

  function getMismatchWarning(modelKey: string): string | null {
    const mismatch = modelo036Mismatches[modelKey];
    if (!mismatch || !mismatch.mismatch) return null;

    if (mismatch.ai_recomienda && !mismatch.usuario_activo) {
      return `Segun tu Modelo 036, deberias activar este modelo`;
    } else if (!mismatch.ai_recomienda && mismatch.usuario_activo) {
      return `Segun tu Modelo 036, no necesitas este modelo`;
    }
    return null;
  }

  function getExplanation(modelKey: string): string | null {
    if (!modelo036Analysis?.recomendaciones) return null;
    const rec = modelo036Analysis.recomendaciones[modelKey];
    return rec?.explicacion || null;
  }

  function isRecommended(modelKey: string): boolean | null {
    if (!modelo036Analysis?.recomendaciones) return null;
    const rec = modelo036Analysis.recomendaciones[modelKey];
    return rec?.requerido ?? null;
  }

  // Info icon with tooltip component
  function InfoTooltip({ modelKey }: { modelKey: string }) {
    const explanation = getExplanation(modelKey);
    const recommended = isRecommended(modelKey);

    if (!explanation) return null;

    // Green for recommended, gray for not recommended
    const iconColor = recommended ? 'text-green-500 hover:text-green-600' : 'text-slate-400 hover:text-slate-500';

    return (
      <div className="relative group inline-block">
        <svg
          className={`w-4 h-4 cursor-help ${iconColor}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="absolute z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg">
          <div className="flex items-start gap-1">
            {recommended ? (
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{explanation}</span>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-8 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ALTA SS FUNCTIONS
  // ============================================================================

  async function loadAltaSSAnalysis() {
    try {
      const response = await fiscal.getAltaSSAnalysis();
      if (response.data) {
        setAltaSSAnalysis(response.data);
      }
    } catch (err) {
      console.error('Error al cargar análisis Alta SS:', err);
    }
  }

  async function handleUploadAltaSS(file: File) {
    setUploadingAltaSS(true);
    setError('');
    try {
      const response = await fiscal.uploadAltaSS(file);
      const datos = response.data.datos_extraidos;
      const rec = response.data.recomendaciones;
      
      const analysisData = {
        id: response.data.analysis_id,
        document_id: response.data.document_id,
        archivo_nombre: file.name,
        created_at: new Date().toISOString(),
        datos_extraidos: datos,
        recomendaciones: rec,
        confianza: response.data.confianza,
      };
      setAltaSSAnalysis(analysisData);

      // Auto-apply extracted data and AI recommendations to user preferences
      if (preferences) {
        const updatedPrefs = { ...preferences };
        let hasChanges = false;

        // Apply tarifa plana: use extracted data first, then recommendation
        if (datos?.tiene_tarifa_plana !== undefined && datos?.tiene_tarifa_plana !== null) {
          updatedPrefs.tiene_tarifa_plana_ss = datos.tiene_tarifa_plana;
          hasChanges = true;
          console.log('📋 Aplicando tarifa plana desde datos extraídos:', datos.tiene_tarifa_plana);
        } else if (rec?.tarifa_plana?.requerido !== undefined) {
          updatedPrefs.tiene_tarifa_plana_ss = rec.tarifa_plana.requerido;
          hasChanges = true;
          console.log('📋 Aplicando tarifa plana desde recomendación:', rec.tarifa_plana.requerido);
        }

        // Apply base de cotización: use extracted data first, then recommendation
        if (datos?.base_cotizacion_elegida && datos.base_cotizacion_elegida > 0) {
          updatedPrefs.base_cotizacion = datos.base_cotizacion_elegida;
          hasChanges = true;
          console.log('📋 Aplicando base cotización desde datos extraídos:', datos.base_cotizacion_elegida);
        } else if (rec?.base_cotizacion?.valor_recomendado && rec.base_cotizacion.valor_recomendado > 0) {
          updatedPrefs.base_cotizacion = rec.base_cotizacion.valor_recomendado;
          hasChanges = true;
          console.log('📋 Aplicando base cotización desde recomendación:', rec.base_cotizacion.valor_recomendado);
        }

        if (hasChanges) {
          // Update local state immediately
          setPreferences(updatedPrefs);

          // Persist to the database
          try {
            console.log('💾 Guardando preferencias SS:', {
              tiene_tarifa_plana_ss: updatedPrefs.tiene_tarifa_plana_ss,
              base_cotizacion: updatedPrefs.base_cotizacion,
            });
            
            // Only send the specific preference fields that need to be updated
            // Do NOT spread all preferences as it includes non-preference fields (id, email, etc.)
            await auth.updatePreferences({
              tiene_tarifa_plana_ss: updatedPrefs.tiene_tarifa_plana_ss,
              base_cotizacion: updatedPrefs.base_cotizacion,
            });
            
            onPreferenceChange?.();
            setSuccess('Alta SS analizado correctamente. Configuración actualizada y guardada.');
          } catch (saveErr: any) {
            console.error('Error al guardar preferencias Alta SS:', saveErr);
            setError('Alta SS analizado correctamente, pero hubo un error al guardar las preferencias: ' + saveErr.message);
          }
        } else {
          setSuccess('Alta SS analizado correctamente. No se detectaron cambios en la configuración.');
        }
      } else {
        setSuccess('Alta SS analizado correctamente.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al analizar el documento de Alta SS');
    } finally {
      setUploadingAltaSS(false);
    }
  }

  async function handleDeleteAltaSS() {
    if (!confirm('¿Estás seguro de que deseas eliminar el documento de Alta SS y su análisis?')) {
      return;
    }

    try {
      await fiscal.deleteAltaSSAnalysis();
      setAltaSSAnalysis(null);
      setSuccess('Documento eliminado correctamente');
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el documento');
    }
  }

  function toggleSection(section: keyof SectionState) {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  async function togglePreference(key: keyof UserPreferences) {
    if (!preferences || saving) return;

    let updatedPrefs: UserPreferences;

    // Handle mutual exclusivity for 130/131
    if (key === 'mostrar_modelo_130' && !preferences.mostrar_modelo_130) {
      updatedPrefs = {
        ...preferences,
        mostrar_modelo_130: true,
        mostrar_modelo_131: false,
        usa_modulos: false,
      };
    } else if (key === 'mostrar_modelo_131' && !preferences.mostrar_modelo_131) {
      updatedPrefs = {
        ...preferences,
        mostrar_modelo_131: true,
        mostrar_modelo_130: false,
        usa_modulos: true,
      };
    } else {
      updatedPrefs = {
        ...preferences,
        [key]: !preferences[key],
      };
    }

    // Update local state immediately
    setPreferences(updatedPrefs);

    // Auto-save - only send the changed preference(s)
    setSaving(true);
    try {
      const updatePayload: Partial<UserPreferences> = { [key]: updatedPrefs[key] };

      // Handle 130/131 mutual exclusivity
      if (key === 'mostrar_modelo_130' || key === 'mostrar_modelo_131') {
        updatePayload.mostrar_modelo_130 = updatedPrefs.mostrar_modelo_130;
        updatePayload.mostrar_modelo_131 = updatedPrefs.mostrar_modelo_131;
        updatePayload.usa_modulos = updatedPrefs.usa_modulos;
      }

      await auth.updatePreferences(updatePayload);
      
      // Notify parent to refresh the fiscal table
      onPreferenceChange?.();
    } catch (err: any) {
      // Revert on error
      setPreferences(preferences);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // Toggle component
  function Toggle({ enabled, onToggle, disabled = false }: { enabled: boolean; onToggle: () => void | Promise<void>; disabled?: boolean }) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        disabled={disabled || saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-slate-700' : 'bg-gray-300'
        } ${disabled || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  }

  // Model card component
  function ModelCard({
    title,
    badge,
    badgeColor = 'slate',
    description,
    enabled,
    onToggle,
    disabled = false,
    warning = '',
    info = '',
  }: {
    title: string;
    badge: string;
    badgeColor?: 'slate' | 'blue' | 'green' | 'amber' | 'purple';
    description: string;
    enabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
    warning?: string;
    info?: string;
  }) {
    const badgeColors = {
      slate: 'bg-slate-200 text-slate-700',
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      amber: 'bg-amber-100 text-amber-700',
      purple: 'bg-purple-100 text-purple-700',
    };

    return (
      <div className={`flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors ${disabled ? 'opacity-60' : ''}`}>
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            <span className={`ml-2 px-2 py-0.5 ${badgeColors[badgeColor]} text-xs font-medium rounded`}>
              {badge}
            </span>
          </div>
          <p className="text-xs text-gray-600">{description}</p>
          {warning && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {warning}
            </p>
          )}
          {info && (
            <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {info}
            </p>
          )}
        </div>
        <div className="ml-3">
          <Toggle enabled={enabled} onToggle={onToggle} disabled={disabled} />
        </div>
      </div>
    );
  }

  // Section header component
  function SectionHeader({
    title,
    icon,
    expanded,
    onToggle,
    count,
  }: {
    title: string;
    icon: React.ReactNode;
    expanded: boolean;
    onToggle: () => void;
    count: number;
  }) {
    return (
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="px-2 py-0.5 bg-slate-300 text-slate-700 text-xs font-medium rounded">
            {count}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuracion fiscal...</p>
        </div>
      </div>
    );
  }

  const hasAnyModelEnabled = preferences && (
    preferences.mostrar_modelo_303 || preferences.mostrar_modelo_130 ||
    preferences.mostrar_modelo_115 || preferences.mostrar_modelo_180 ||
    preferences.mostrar_modelo_390 || preferences.mostrar_modelo_349 ||
    preferences.mostrar_modelo_131 || preferences.mostrar_modelo_100 ||
    preferences.mostrar_modelo_111 || preferences.mostrar_modelo_190 ||
    preferences.mostrar_modelo_123 || preferences.mostrar_modelo_347 ||
    preferences.mostrar_sii || preferences.mostrar_vies_roi ||
    preferences.mostrar_redeme
  );

  return (
    <>
      {error && (
        <Toast message={error} type="error" onClose={() => setError('')} />
      )}

      {success && (
        <Toast message={success} type="success" onClose={() => setSuccess('')} />
      )}


      {/* Warning if all disabled */}
      {!hasAnyModelEnabled && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-900 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span><strong>Aviso:</strong> Has desactivado todos los modelos fiscales.</span>
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-4 flex bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('aeat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'aeat'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Agencia Tributaria
        </button>
        <button
          onClick={() => setActiveTab('seguridadSocial')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'seguridadSocial'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Seguridad Social
        </button>
      </div>

      {/* AEAT Tab Content */}
      {activeTab === 'aeat' && (
        <>
          {/* Fecha de Alta en Hacienda */}
          <div className="mb-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-bold text-amber-900">Fecha de Alta en Hacienda</span>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-600 mb-3">
                Indica la fecha en la que te diste de alta como autónomo en la Agencia Tributaria. 
                Las obligaciones fiscales anteriores a esta fecha serán eliminadas de tu calendario (no solo ocultas).
                <strong className="text-amber-700"> Es obligatorio configurar esta fecha para ver el calendario fiscal.</strong>
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={preferences?.fecha_alta_aeat ? preferences.fecha_alta_aeat.split('T')[0] : ''}
                  onChange={async (e) => {
                    const newDate = e.target.value || null;
                    try {
                      setSaving(true);
                      await auth.updatePreferences({ fecha_alta_aeat: newDate });
                      setPreferences(prev => prev ? { ...prev, fecha_alta_aeat: newDate } : null);
                      setSuccess('Fecha de alta actualizada');
                      if (onPreferenceChange) onPreferenceChange();
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err: any) {
                      setError(err.message || 'Error al actualizar la fecha');
                      setTimeout(() => setError(''), 3000);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                {preferences?.fecha_alta_aeat && (
                  <button
                    onClick={async () => {
                      try {
                        setSaving(true);
                        await auth.updatePreferences({ fecha_alta_aeat: null });
                        setPreferences(prev => prev ? { ...prev, fecha_alta_aeat: null } : null);
                        setSuccess('Fecha de alta eliminada');
                        if (onPreferenceChange) onPreferenceChange();
                        setTimeout(() => setSuccess(''), 3000);
                      } catch (err: any) {
                        setError(err.message || 'Error al eliminar la fecha');
                        setTimeout(() => setError(''), 3000);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline"
                    disabled={saving}
                  >
                    Eliminar fecha
                  </button>
                )}
              </div>
              {preferences?.fecha_alta_aeat && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block">
                  <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Las obligaciones anteriores al {new Date(preferences.fecha_alta_aeat).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} están eliminadas del calendario
                </p>
              )}
            </div>
          </div>

          {/* Modelo 036 Documents Table */}
          <div className="mb-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Table Header */}
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-bold text-blue-900">Modelo 036 - Alta en Hacienda</span>
                <span className="text-xs font-medium text-blue-500 ml-1 px-2 py-0.5 bg-blue-100 rounded-full">
                  {modelo036History.length} {modelo036History.length === 1 ? 'documento' : 'documentos'}
                </span>
              </div>
              <button
                onClick={() => !uploading036 && fileInputRef.current?.click()}
                disabled={uploading036}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                {uploading036 ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Subir documento</span>
                  </>
                )}
              </button>
            </div>

            {/* Empty state */}
            {modelo036History.length === 0 && (
              <div
                className={`p-8 text-center transition-colors cursor-pointer ${
                  uploading036 ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => !uploading036 && fileInputRef.current?.click()}
              >
                {uploading036 ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">Analizando documento...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">Sube tu Modelo 036 para configurar automaticamente tus obligaciones</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG o PNG - Haz clic para seleccionar</p>
                  </>
                )}
              </div>
            )}

            {/* Documents Table */}
            {modelo036History.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Documento
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IAE
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {modelo036History.map((item) => {
                      // Determine document status
                      const isModificacion = item.tipo_documento === 'MODIFICACION';
                      const isActive = item.is_active !== false;
                      
                      return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 transition-colors ${isActive && !isModificacion ? 'bg-green-50/50' : isModificacion && isActive ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {isModificacion ? (
                              <svg className="w-5 h-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ) : (
                              <svg className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                {item.archivo_nombre || `Modelo 036 #${item.id}`}
                              </span>
                              {isModificacion && item.campos_modificados?.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  Modifica: {item.campos_modificados.slice(0, 2).join(', ')}{item.campos_modificados.length > 2 ? '...' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isModificacion ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Modificación
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                              Alta
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">
                            {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {isModificacion && item.fecha_efectos && (
                            <span className="block text-xs text-blue-600">
                              Efectos: {new Date(item.fecha_efectos).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.epigrafe_iae ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                              {item.epigrafe_iae}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{isModificacion ? 'Sin cambio' : '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isActive ? (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              isModificacion ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              En vigor
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openDocumentModal(item)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Ver documento"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDelete036ById(item.id, e)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar documento"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AEAT Models Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modelo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frecuencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descripcion
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      Info
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {/* IVA Category Header */}
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={5} className="px-4 py-2 text-left font-bold text-blue-900 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        IVA
                        <span className="text-xs font-medium text-blue-500 ml-1 px-2 py-0.5 bg-blue-100 rounded-full">4 modelos</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 303</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      IVA Trimestral. IVA repercutido y soportado.
                      {getMismatchWarning('modelo_303') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_303')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_303" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_303 ?? false} onToggle={() => togglePreference('mostrar_modelo_303')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 390</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Anual</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Resumen Anual IVA. Consolida los 303.
                      {getMismatchWarning('modelo_390') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_390')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_390" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_390 ?? false} onToggle={() => togglePreference('mostrar_modelo_390')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 349</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Operaciones UE.
                      <span className="block text-blue-600 mt-0.5">Requiere alta en ROI</span>
                      {getMismatchWarning('modelo_349') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_349')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_349" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_349 ?? false} onToggle={() => togglePreference('mostrar_modelo_349')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">SII</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-medium rounded">Info</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Suministro Inmediato de Informacion.
                      <span className="block text-blue-600 mt-0.5">Voluntario para autonomos</span>
                      {getMismatchWarning('sii') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('sii')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="sii" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_sii ?? false} onToggle={() => togglePreference('mostrar_sii')} />
                    </td>
                  </tr>

                  {/* IRPF Category Header */}
                  <tr className="bg-green-50 border-t-2 border-green-200">
                    <td colSpan={5} className="px-4 py-2 text-left font-bold text-green-900 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        IRPF
                        <span className="text-xs font-medium text-green-500 ml-1 px-2 py-0.5 bg-green-100 rounded-full">3 modelos</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 130</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Estimacion Directa. 20% del rendimiento neto.
                      {preferences?.mostrar_modelo_131 && <span className="block text-amber-600 mt-0.5">Deshabilitado (131 activo)</span>}
                      {getMismatchWarning('modelo_130') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_130')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_130" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_130 ?? false} onToggle={() => togglePreference('mostrar_modelo_130')} disabled={preferences?.mostrar_modelo_131} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 131</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Modulos. Estimacion objetiva.
                      {preferences?.mostrar_modelo_130 && <span className="block text-amber-600 mt-0.5">Deshabilitado (130 activo)</span>}
                      {getMismatchWarning('modelo_131') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_131')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_131" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_131 ?? false} onToggle={() => togglePreference('mostrar_modelo_131')} disabled={preferences?.mostrar_modelo_130} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 100</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Anual</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      RENTA. Declaracion anual del IRPF.
                      <span className="block text-blue-600 mt-0.5">Abril - Junio del ano siguiente</span>
                    </td>
                    <td className="px-4 py-3 text-center"></td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_100 ?? false} onToggle={() => togglePreference('mostrar_modelo_100')} />
                    </td>
                  </tr>

                  {/* Retenciones Category Header */}
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td colSpan={5} className="px-4 py-2 text-left font-bold text-amber-900 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Retenciones
                        <span className="text-xs font-medium text-amber-500 ml-1 px-2 py-0.5 bg-amber-100 rounded-full">5 modelos</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 111</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Trabajadores/Profesionales.
                      {getMismatchWarning('modelo_111') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_111')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_111" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_111 ?? false} onToggle={() => togglePreference('mostrar_modelo_111')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 190</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Anual</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Resumen Anual del 111.
                      {getMismatchWarning('modelo_190') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_190')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_190" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_190 ?? false} onToggle={() => togglePreference('mostrar_modelo_190')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 115</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Retenciones Alquileres (19%).
                      {getMismatchWarning('modelo_115') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_115')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_115" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_115 ?? false} onToggle={() => togglePreference('mostrar_modelo_115')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 180</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Anual</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Resumen Anual Alquileres.
                      {getMismatchWarning('modelo_180') && (
                        <span className="flex items-center gap-1 text-amber-600 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {getMismatchWarning('modelo_180')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="modelo_180" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_180 ?? false} onToggle={() => togglePreference('mostrar_modelo_180')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 123</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">Trimestral</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Capital Mobiliario.
                      <span className="block text-blue-600 mt-0.5">La mayoria no lo necesitan</span>
                    </td>
                    <td className="px-4 py-3 text-center"></td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_123 ?? false} onToggle={() => togglePreference('mostrar_modelo_123')} />
                    </td>
                  </tr>

                  {/* Informativas Category Header */}
                  <tr className="bg-purple-50 border-t-2 border-purple-200">
                    <td colSpan={5} className="px-4 py-2 text-left font-bold text-purple-900 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Informativas
                        <span className="text-xs font-medium text-purple-500 ml-1 px-2 py-0.5 bg-purple-100 rounded-full">1 modelo</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Modelo 347</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Anual</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Operaciones con Terceros ({'>'}3.005,06 EUR).
                      <span className="block text-blue-600 mt-0.5">Se genera automaticamente</span>
                    </td>
                    <td className="px-4 py-3 text-center"></td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_modelo_347 ?? false} onToggle={() => togglePreference('mostrar_modelo_347')} />
                    </td>
                  </tr>

                  {/* Registros Censales Category Header */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={5} className="px-4 py-2 text-left font-bold text-slate-900 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Registros Censales
                        <span className="text-xs font-medium text-slate-500 ml-1 px-2 py-0.5 bg-slate-200 rounded-full">2 registros</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">VIES / ROI</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-medium rounded">Info</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Operadores Intracomunitarios.
                      <span className="block text-blue-600 mt-0.5">Para operar sin IVA con la UE</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InfoTooltip modelKey="vies_roi" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_vies_roi ?? false} onToggle={() => togglePreference('mostrar_vies_roi')} />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">REDEME</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-medium rounded">Info</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      Devolucion Mensual IVA.
                      <span className="block text-blue-600 mt-0.5">Util para exportadores</span>
                    </td>
                    <td className="px-4 py-3 text-center"></td>
                    <td className="px-4 py-3 text-center">
                      <Toggle enabled={preferences?.mostrar_redeme ?? false} onToggle={() => togglePreference('mostrar_redeme')} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Seguridad Social Tab Content */}
      {activeTab === 'seguridadSocial' && (
      <>
      {/* Alta SS Document Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Alta en el RETA</h3>
              <p className="text-xs text-gray-600">Sube tu documento de alta para configurar automáticamente</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {!altaSSAnalysis ? (
            // Upload area when no document exists
            <div className="border-2 border-dashed border-red-200 rounded-lg p-6 text-center hover:border-red-400 transition-colors">
              <input
                type="file"
                ref={altaSSFileInputRef}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAltaSS(file);
                }}
              />
              
              {uploadingAltaSS ? (
                <div className="flex flex-col items-center py-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mb-3"></div>
                  <p className="text-sm text-gray-600">Analizando documento con IA...</p>
                  <p className="text-xs text-gray-500 mt-1">Esto puede tardar unos segundos</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto h-12 w-12 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    Sube tu documento de <strong>Alta en el RETA</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF, JPG o PNG (máx. 10MB)</p>
                  <button
                    onClick={() => altaSSFileInputRef.current?.click()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Seleccionar archivo
                  </button>
                </>
              )}
            </div>
          ) : (
            // Show analysis when document exists
            <div className="space-y-4">
              {/* Document header */}
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">Documento analizado</p>
                    <p className="text-xs text-green-600">
                      Confianza: {altaSSAnalysis.confianza}% • {new Date(altaSSAnalysis.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDeleteAltaSS}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Eliminar documento"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Extracted data */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Datos extraídos</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {altaSSAnalysis.datos_extraidos.nombre_completo && (
                    <div>
                      <span className="text-gray-500">Nombre:</span>
                      <span className="ml-1 font-medium text-gray-900">{altaSSAnalysis.datos_extraidos.nombre_completo}</span>
                    </div>
                  )}
                  {altaSSAnalysis.datos_extraidos.nif && (
                    <div>
                      <span className="text-gray-500">NIF:</span>
                      <span className="ml-1 font-medium text-gray-900">{altaSSAnalysis.datos_extraidos.nif}</span>
                    </div>
                  )}
                  {altaSSAnalysis.datos_extraidos.fecha_alta_reta && (
                    <div>
                      <span className="text-gray-500">Fecha alta:</span>
                      <span className="ml-1 font-medium text-gray-900">
                        {new Date(altaSSAnalysis.datos_extraidos.fecha_alta_reta).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                  {altaSSAnalysis.datos_extraidos.numero_afiliacion && (
                    <div>
                      <span className="text-gray-500">NAF:</span>
                      <span className="ml-1 font-medium text-gray-900">{altaSSAnalysis.datos_extraidos.numero_afiliacion}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations applied */}
              <div className="bg-red-50 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide">Configuración aplicada</h4>
                <div className="space-y-2">
                  {altaSSAnalysis.recomendaciones.tarifa_plana && (
                    <div className="flex items-start gap-2 text-xs">
                      {altaSSAnalysis.recomendaciones.tarifa_plana.requerido ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <div>
                        <span className="font-medium text-gray-900">Tarifa Plana</span>
                        <p className="text-gray-600">{altaSSAnalysis.recomendaciones.tarifa_plana.explicacion}</p>
                      </div>
                    </div>
                  )}
                  {altaSSAnalysis.recomendaciones.base_cotizacion && (
                    <div className="flex items-start gap-2 text-xs">
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="font-medium text-gray-900">
                          Base de cotización: {altaSSAnalysis.recomendaciones.base_cotizacion.valor_recomendado 
                            ? formatEuro(altaSSAnalysis.recomendaciones.base_cotizacion.valor_recomendado) 
                            : 'No especificada'}
                        </span>
                        <p className="text-gray-600">{altaSSAnalysis.recomendaciones.base_cotizacion.explicacion}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload new document button */}
              <div className="pt-2 border-t border-gray-200">
                <input
                  type="file"
                  ref={altaSSFileInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadAltaSS(file);
                  }}
                />
                <button
                  onClick={() => altaSSFileInputRef.current?.click()}
                  disabled={uploadingAltaSS}
                  className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploadingAltaSS ? 'Analizando...' : 'Subir nuevo documento'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 6: Seguridad Social */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <SectionHeader
          title="Configuración de Cotización"
          icon={
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          expanded={expandedSections.seguridadSocial}
          onToggle={() => toggleSection('seguridadSocial')}
          count={1}
        />
        {expandedSections.seguridadSocial && (
          <div className="p-3 space-y-3">
            {/* Tarifa Plana */}
            <div className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="text-sm font-semibold text-gray-900">Tarifa Plana (88,56 EUR/mes)</span>
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                    12 meses
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Bonificacion para nuevos autonomos: 80 EUR + MEI (8,56 EUR).
                </p>
              </div>
              <div className="ml-3">
                <Toggle
                  enabled={preferences?.tiene_tarifa_plana_ss ?? false}
                  onToggle={() => togglePreference('tiene_tarifa_plana_ss')}
                />
              </div>
            </div>

            {/* Base de Cotizacion Selector */}
            {rendimientoNetoMensual >= 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Base de Cotizacion</h3>
                {(() => {
                  const tieneTarifaPlana = preferences?.tiene_tarifa_plana_ss || false;
                  const tramo = obtenerTramoPorRendimientos(rendimientoNetoMensual);

                  const baseMinimaDefecto = 950.98;
                  const baseActual = preferences?.base_cotizacion || baseMinimaDefecto;

                  let cuotaActual: number;

                  if (tieneTarifaPlana) {
                    const tarifaBonificada = 80;
                    const mei = baseActual * 0.009;
                    cuotaActual = tarifaBonificada + mei;
                  } else {
                    cuotaActual = calcularCuotaPorBase(baseActual);
                  }

                  return (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      {!tieneTarifaPlana && (
                        <div className="mb-3 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-700">Rendimiento neto mensual:</span>
                            <span className="font-bold text-gray-900">{formatEuro(rendimientoNetoMensual)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">Tramo aplicable:</span>
                            <span className="font-bold text-slate-700">Tramo {tramo.tramo}</span>
                          </div>
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Base de cotizacion:
                        </label>
                        <input
                          type="range"
                          min={baseMinimaDefecto}
                          max={5101.20}
                          step={10}
                          value={baseActual}
                          onChange={(e) => {
                            const newBase = parseFloat(e.target.value);
                            setPreferences(prev => prev ? { ...prev, base_cotizacion: newBase } : null);
                          }}
                          onMouseUp={async (e) => {
                            const newBase = parseFloat((e.target as HTMLInputElement).value);
                            if (preferences) {
                              setSaving(true);
                              try {
                                await auth.updatePreferences({ ...preferences, base_cotizacion: newBase });
                                onPreferenceChange?.();
                              } catch (err: any) {
                                setError(err.message || 'Error al guardar');
                              } finally {
                                setSaving(false);
                              }
                            }
                          }}
                          onTouchEnd={async (e) => {
                            const newBase = parseFloat((e.target as HTMLInputElement).value);
                            if (preferences) {
                              setSaving(true);
                              try {
                                await auth.updatePreferences({ ...preferences, base_cotizacion: newBase });
                                onPreferenceChange?.();
                              } catch (err: any) {
                                setError(err.message || 'Error al guardar');
                              } finally {
                                setSaving(false);
                              }
                            }
                          }}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
                        />
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{formatEuro(baseMinimaDefecto)}</span>
                          <span>{formatEuro(5101.20)}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-700">Base elegida:</span>
                          <span className="text-sm font-bold text-slate-700">{formatEuro(baseActual)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-700">Cuota mensual:</span>
                          <span className="text-sm font-bold text-gray-900">{formatEuro(cuotaActual)}</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (preferences) {
                            setPreferences(prev => prev ? { ...prev, base_cotizacion: null } : null);
                            setSaving(true);
                            try {
                              await auth.updatePreferences({ ...preferences, base_cotizacion: null });
                              onPreferenceChange?.();
                            } catch (err: any) {
                              setError(err.message || 'Error al guardar');
                            } finally {
                              setSaving(false);
                            }
                          }
                        }}
                        className="mt-2 text-xs text-slate-600 hover:text-slate-800 underline"
                      >
                        Usar base minima ({formatEuro(baseMinimaDefecto)})
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Loading overlay when opening document */}
      {loadingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600 text-sm">Cargando documento...</p>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal - Split View */}
      {selectedDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[95vh] mx-4 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <h3 className="text-white font-semibold text-sm">{selectedDocumentModal.fileName}</h3>
                  <p className="text-blue-100 text-xs">Modelo 036 - Declaracion Censal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
                      const response = await fetch(`${API_URL}/documents/download/document/${selectedDocumentModal.documentId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!response.ok) throw new Error('Error al descargar');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = selectedDocumentModal.fileName;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (err: any) {
                      setError('Error al descargar el documento');
                    }
                  }}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Descargar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    const analysisId = selectedDocumentModal.analysisId;
                    closeDocumentModal();
                    await handleDelete036ById(analysisId);
                  }}
                  className="p-2 text-white/80 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={closeDocumentModal}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content - Split View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side - Document Viewer */}
              <div className="w-1/2 bg-gray-100 border-r border-gray-200 flex flex-col">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600">Documento</span>
                </div>
                <div className="flex-1 p-2">
                  {selectedDocumentModal.pdfUrl ? (
                    <iframe
                      src={selectedDocumentModal.pdfUrl}
                      className="w-full h-full rounded border border-gray-300 bg-white"
                      title="Modelo 036"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded border border-gray-300">
                      <p className="text-gray-500 text-sm">No se pudo cargar el documento</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - AI Analysis */}
              <div className="w-1/2 flex flex-col overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Analisis AI</span>
                  {selectedDocumentModal.analysis?.confianza && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      selectedDocumentModal.analysis.confianza >= 70 ? 'bg-green-100 text-green-700' :
                      selectedDocumentModal.analysis.confianza >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedDocumentModal.analysis.confianza}% confianza
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedDocumentModal.analysis?.datos_extraidos && (
                    <>
                      {/* Extracted Data */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datos Extraidos</h4>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {selectedDocumentModal.analysis.datos_extraidos.nif && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">NIF</span>
                              <span className="font-medium text-gray-900">{selectedDocumentModal.analysis.datos_extraidos.nif}</span>
                            </div>
                          )}
                          {selectedDocumentModal.analysis.datos_extraidos.nombre_razon_social && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Nombre</span>
                              <span className="font-medium text-gray-900 text-right max-w-[200px] truncate">{selectedDocumentModal.analysis.datos_extraidos.nombre_razon_social}</span>
                            </div>
                          )}
                          {selectedDocumentModal.analysis.datos_extraidos.fecha_alta_actividad && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Fecha Alta</span>
                              <span className="font-medium text-gray-900">{new Date(selectedDocumentModal.analysis.datos_extraidos.fecha_alta_actividad).toLocaleDateString('es-ES')}</span>
                            </div>
                          )}
                          {selectedDocumentModal.analysis.datos_extraidos.epigrafe_iae && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Epigrafe IAE</span>
                              <span className="font-medium text-gray-900">{selectedDocumentModal.analysis.datos_extraidos.epigrafe_iae}</span>
                            </div>
                          )}
                          {selectedDocumentModal.analysis.datos_extraidos.regimen_iva && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Regimen IVA</span>
                              <span className="font-medium text-gray-900">{selectedDocumentModal.analysis.datos_extraidos.regimen_iva}</span>
                            </div>
                          )}
                          {selectedDocumentModal.analysis.datos_extraidos.regimen_irpf && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Regimen IRPF</span>
                              <span className="font-medium text-gray-900">{selectedDocumentModal.analysis.datos_extraidos.regimen_irpf}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recomendaciones de Modelos</h4>
                        <div className="space-y-2">
                          {selectedDocumentModal.analysis.recomendaciones && Object.entries(selectedDocumentModal.analysis.recomendaciones).map(([key, rec]: [string, any]) => (
                            <div key={key} className={`p-2 rounded-lg border ${rec.requerido ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">
                                  {key === 'vies_roi' ? 'VIES/ROI' : key === 'sii' ? 'SII' : `Modelo ${key.replace('modelo_', '')}`}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${rec.requerido ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                  {rec.requerido ? 'Recomendado' : 'No necesario'}
                                </span>
                              </div>
                              {rec.explicacion && (
                                <p className="text-xs text-gray-600 mt-1">{rec.explicacion}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Type Selection Modal */}
      {showUploadTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-lg font-semibold text-white">Tipo de Documento</h3>
              <p className="text-blue-100 text-sm mt-1">¿Qué tipo de Modelo 036 estás subiendo?</p>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-3">
                {/* ALTA option */}
                <label 
                  className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedUploadType === 'ALTA' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="uploadType"
                    value="ALTA"
                    checked={selectedUploadType === 'ALTA'}
                    onChange={() => setSelectedUploadType('ALTA')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Nuevo documento completo</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Reemplaza</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Este es un nuevo Modelo 036 completo que <strong>reemplaza</strong> el documento anterior. 
                      El documento previo quedará inactivo.
                    </p>
                  </div>
                </label>

                {/* MODIFICACION option */}
                <label 
                  className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedUploadType === 'MODIFICACION' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="uploadType"
                    value="MODIFICACION"
                    checked={selectedUploadType === 'MODIFICACION'}
                    onChange={() => setSelectedUploadType('MODIFICACION')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Modificación parcial</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Complementa</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Este documento solo modifica algunos datos del Modelo 036 original. 
                      <strong> Ambos documentos permanecen en vigor</strong> simultáneamente.
                    </p>
                  </div>
                </label>
              </div>

              {/* File info */}
              {pendingUploadFile && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">{pendingUploadFile.name}</span>
                    <span className="text-gray-400">({(pendingUploadFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={handleUploadTypeCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadTypeConfirm}
                disabled={uploading036}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploading036 ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Subir y Analizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-slate-800 mb-1">Informacion</h3>
        <ul className="text-xs text-slate-700 space-y-0.5">
          <li><strong>Modelos:</strong> Los desactivados no apareceran en navegacion ni calendario</li>
          <li><strong>130/131:</strong> Mutuamente excluyentes segun regimen fiscal</li>
          <li><strong>111:</strong> Solo si tienes empleados o contratas profesionales</li>
          <li><strong>115:</strong> Solo si alquilas local (retencion 19%)</li>
        </ul>
      </div>
    </>
  );
}

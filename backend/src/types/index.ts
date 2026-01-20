import { Request } from 'express';

// User types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  nombre_completo: string;
  nif: string;
  regimen_fiscal: string;
  fecha_alta_autonomo: Date;
  epigrafe_iae?: string;
  es_trade: boolean;
  porcentaje_dependencia: number;
  tiene_local_alquilado: boolean;
  tipo_iva_predeterminado: number;
  tipo_irpf_actual: number;
  tipo_irpf_estimado: number;
  timezone: string;
  idioma: string;
  mostrar_modelo_303: boolean;
  mostrar_modelo_130: boolean;
  mostrar_modelo_115: boolean;
  tiene_tarifa_plana_ss: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserPayload {
  id: string;
  email: string;
  nombre_completo: string;
  es_trade: boolean;
}

// Extend Express Request with user
export interface AuthRequest extends Request {
  user?: UserPayload;
}

// Client types
export interface Client {
  id: string;
  user_id: string;
  razon_social: string;
  cif: string;
  direccion?: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  email?: string;
  telefono?: string;
  persona_contacto?: string;
  es_cliente_principal: boolean;
  porcentaje_facturacion?: number;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

// Asset types
export interface Asset {
  id: string;
  user_id: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  fecha_adquisicion: Date;
  importe_adquisicion: number;
  iva_soportado?: number;
  vida_util_anos: number;
  porcentaje_amortizacion_anual: number;
  amortizacion_acumulada: number;
  numero_factura?: string;
  proveedor?: string;
  activo: boolean;
  fecha_baja?: Date;
  motivo_baja?: string;
  created_at: Date;
  updated_at: Date;
}

// Expense types
export interface Expense {
  id: string;
  user_id: string;
  concepto: string;
  descripcion?: string;
  categoria: string;
  fecha_emision: Date;
  numero_factura?: string;
  proveedor_nombre: string;
  proveedor_cif?: string;
  base_imponible: number;
  tipo_iva: number;
  cuota_iva?: number;
  tipo_irpf: number;
  cuota_irpf?: number;
  total_factura: number;
  porcentaje_deducible: number;
  es_deducible: boolean;
  motivo_no_deducible?: string;
  es_gasto_independencia: boolean;
  nivel_riesgo: 'BAJO' | 'MEDIO' | 'ALTO';
  notas_riesgo?: string;
  ocr_procesado: boolean;
  ocr_confianza?: number;
  ocr_texto_completo?: string;
  ocr_datos_extraidos?: any;
  ocr_requiere_revision: boolean;
  archivo_url?: string;
  archivo_nombre?: string;
  archivo_tipo?: string;
  estado: 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO';
  pagado: boolean;
  fecha_pago?: Date;
  created_at: Date;
  updated_at: Date;
}

// Invoice types
export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  numero_factura: string;
  serie: string;
  fecha_emision: Date;
  fecha_vencimiento?: Date;
  periodo_facturacion_inicio?: Date;
  periodo_facturacion_fin?: Date;
  concepto: string;
  descripcion_detallada?: string;
  base_imponible: number;
  tipo_iva: number;
  cuota_iva: number;
  tipo_irpf: number;
  cuota_irpf: number;
  total_factura: number;
  estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'CANCELADA';
  pagada: boolean;
  fecha_pago?: Date;
  pdf_url?: string;
  pdf_generado: boolean;
  enviada_cliente: boolean;
  fecha_envio?: Date;
  created_at: Date;
  updated_at: Date;
}

// Tax Calculation types
export interface TaxCalculation {
  id: string;
  user_id: string;
  trimestre: number;
  ano: number;
  modelo: string;
  iva_repercutido: number;
  iva_soportado: number;
  iva_resultado?: number;
  ingresos_totales: number;
  gastos_deducibles: number;
  rendimiento_neto?: number;
  retencion_practicada: number;
  pago_fraccionado?: number;
  retenciones_profesionales: number;
  calculado_automaticamente: boolean;
  presentado_aeat: boolean;
  fecha_presentacion?: Date;
  justificante_url?: string;
  notas?: string;
  created_at: Date;
  updated_at: Date;
}

// Compliance Alert types
export interface ComplianceAlert {
  id: string;
  user_id: string;
  tipo: string;
  severidad: 'INFO' | 'WARNING' | 'CRITICAL';
  titulo: string;
  descripcion: string;
  recomendacion?: string;
  periodo_mes?: number;
  periodo_ano?: number;
  related_expense_id?: string;
  related_invoice_id?: string;
  leida: boolean;
  resuelta: boolean;
  fecha_resolucion?: Date;
  created_at: Date;
  updated_at: Date;
}

// Fiscal Event types
export interface FiscalEvent {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  fecha_limite: Date;
  fecha_recordatorio?: Date;
  trimestre?: number;
  mes?: number;
  ano: number;
  completado: boolean;
  fecha_completado?: Date;
  notificacion_enviada: boolean;
  created_at: Date;
  updated_at: Date;
}

// Bank Account types
export interface BankAccount {
  id: string;
  user_id: string;
  banco: string;
  iban: string;
  alias?: string;
  saldo_actual: number;
  fecha_ultimo_balance: Date;
  cuenta_principal: boolean;
  activa: boolean;
  created_at: Date;
  updated_at: Date;
}

// Cash Flow Snapshot types
export interface CashFlowSnapshot {
  id: string;
  user_id: string;
  fecha_snapshot: Date;
  saldo_bancario_total: number;
  iva_pendiente_pagar: number;
  irpf_brecha: number;
  seguridad_social_pendiente: number;
  balance_real: number;
  ingresos_acumulados_ano: number;
  gastos_acumulados_ano: number;
  beneficio_neto_estimado?: number;
  created_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: any;
  info?: string[];
  warnings?: string[];
  alerts?: any[];
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// OCR types
export interface ExtractedInvoiceData {
  proveedor_nombre?: string;
  proveedor_cif?: string;
  numero_factura?: string;
  fecha_emision?: string;
  concepto?: string;
  categoria?: string;
  base_imponible?: number;
  tipo_iva?: number;
  cuota_iva?: number;
  tipo_irpf?: number;
  cuota_irpf?: number;
  total_factura?: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  data: ExtractedInvoiceData;
  requiresReview: boolean;
}

// Contract OCR types
export interface ExtractedContractData {
  // Parties
  parte_a_nombre?: string;
  parte_a_cif?: string;
  parte_b_nombre?: string;
  parte_b_cif?: string;

  // Contract dates
  fecha_inicio?: string;
  fecha_fin?: string;

  // Financial details
  importe?: number;
  periodicidad?: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
  tipo_iva?: number;
  tipo_irpf?: number;

  // Content
  concepto?: string;
  categoria?: string;

  // Payment terms
  condiciones_pago?: string;
  clausula_renovacion?: string;

  // Contract type (helps determine if user is provider or client)
  tipo_contrato?: 'SERVICIOS' | 'ALQUILER' | 'SUMINISTROS' | 'OTRO';

  // Extraction notes - explanations for approximations or decisions made by AI
  notas_extraccion?: string[];
}

export interface ContractOCRResult {
  text: string;
  confidence: number;
  data: ExtractedContractData;
  requiresReview: boolean;
}

// ============================================================================
// Document types (Repositorio de Contratos y Documentos)
// ============================================================================

export type DocumentCategoria =
  // New categories for Alta workflow
  | 'ALTA_HACIENDA'
  | 'ALTA_SEGURIDAD_SOCIAL'
  | 'CONTRATO_TRADE'
  | 'APROBACION_SEPE'
  | 'CONTRATO_ALQUILER'
  | 'CONTRATO_SUMINISTROS'
  | 'CONTRATO_CLIENTE'
  | 'DOCUMENTO_IDENTIDAD'
  | 'CERTIFICADO_DIGITAL'
  // Legacy categories (for backwards compatibility)
  | 'CONTRATO_VIVIENDA'
  | 'DOCUMENTO_BANCARIO'
  | 'OTRO';

export type DocumentoEstado = 'ACTIVO' | 'ARCHIVADO' | 'ELIMINADO';

// Document type codes
export type DocumentTypeCode =
  | 'MODELO_036'
  | 'MODELO_TA0521'
  | 'CONTRATO_TRADE'
  | 'APROBACION_SEPE'
  | 'CONTRATO_ALQUILER'
  | 'CONTRATO_SUMINISTROS'
  | 'CONTRATO_CLIENTE'
  | 'DOCUMENTO_IDENTIDAD'
  | 'CERTIFICADO_DIGITAL'
  | 'OTRO';

// AI Suggestion types
export type SuggestionType = 'UPLOAD_DOCUMENT' | 'CREATE_EXPENSE' | 'CREATE_INVOICE' | 'DATA_CORRECTION';
export type SuggestionPriority = 'ALTA' | 'MEDIA' | 'BAJA';
export type SuggestionStatus = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'MODIFICADA';

export interface Document {
  id: string;
  user_id: string;

  // Metadatos
  nombre: string;
  descripcion?: string;
  categoria: DocumentCategoria;
  tipo_documento?: string;

  // Archivo
  archivo_nombre_original: string;
  archivo_nombre_storage: string;
  archivo_ruta: string;
  archivo_tipo_mime: string;
  archivo_tamanio_bytes: number;
  archivo_hash_sha256?: string;

  // Fechas
  fecha_subida: Date;
  fecha_documento?: Date;
  fecha_vencimiento?: Date;
  fecha_recordatorio?: Date;

  // Versiones
  version: number;
  documento_padre_id?: string;
  es_version_actual: boolean;

  // Estado
  estado: DocumentoEstado;
  visible: boolean;

  // Extras
  notas?: string;
  etiquetas?: string[];

  // AI Analysis fields (new)
  document_type_id?: number;
  ai_analizado?: boolean;
  ai_fecha_analisis?: Date;
  ai_datos_extraidos?: Record<string, unknown>;
  ai_confianza?: number;
  ai_tipo_detectado?: DocumentTypeCode;
  vinculado_programacion_id?: string;

  // Auditoría
  created_at: Date;
  updated_at: Date;
}

// Document Type from catalog
export interface DocumentType {
  id: number;
  codigo: DocumentTypeCode;
  nombre: string;
  descripcion?: string;
  es_obligatorio: boolean;
  triggers_documentos?: string[];
  campos_esperados?: Record<string, string>;
  palabras_clave?: string[];
  activo: boolean;
  orden: number;
  created_at: Date;
}

// AI Document Suggestion
export interface AIDocumentSuggestion {
  id: number;
  user_id: number;
  document_id: number;
  tipo_sugerencia: SuggestionType;
  titulo: string;
  descripcion: string;
  prioridad: SuggestionPriority;
  documento_sugerido_tipo?: DocumentTypeCode;
  programacion_tipo?: 'INGRESO' | 'GASTO';
  datos_programacion?: {
    tipo: 'INGRESO' | 'GASTO';
    periodicidad: string;
    tipo_dia: string;
    datos_base: Record<string, unknown>;
  };
  campo_corregir?: string;
  valor_actual?: string;
  valor_sugerido?: string;
  estado: SuggestionStatus;
  fecha_decision?: Date;
  notas_usuario?: string;
  programacion_creada_id?: string;
  documento_creado_id?: number;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  document_nombre?: string;
  document_categoria?: DocumentCategoria;
}

// Alta de Autónomo Progress
export interface AltaAutonomoProgress {
  id: number;
  user_id: number;
  modelo_036_uploaded: boolean;
  modelo_036_document_id?: number;
  modelo_ta0521_uploaded: boolean;
  modelo_ta0521_document_id?: number;
  es_trade: boolean;
  contrato_trade_uploaded: boolean;
  contrato_trade_document_id?: number;
  aprobacion_sepe_uploaded: boolean;
  aprobacion_sepe_document_id?: number;
  tiene_local: boolean;
  contrato_alquiler_uploaded: boolean;
  contrato_alquiler_document_id?: number;
  alta_completa: boolean;
  fecha_alta_completa?: Date;
  documentos_obligatorios_completados: number;
  documentos_opcionales_completados: number;
  sugerencias_pendientes: number;
  created_at: Date;
  updated_at: Date;
}

// Alta Progress with checklist
export interface AltaProgressChecklist {
  codigo: DocumentTypeCode;
  nombre: string;
  obligatorio: boolean;
  completado: boolean;
  document_id?: number;
  document_nombre?: string;
}

export interface AltaProgressResponse extends AltaAutonomoProgress {
  checklist: AltaProgressChecklist[];
  porcentaje: number;
  total_requeridos: number;
  total_completados: number;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;

  // Archivo
  archivo_nombre_storage: string;
  archivo_ruta: string;
  archivo_tamanio_bytes: number;
  archivo_hash_sha256?: string;

  // Metadatos
  nombre: string;
  descripcion?: string;
  fecha_documento?: Date;

  // Auditoría
  creado_por_user_id: string;
  motivo_cambio?: string;
  created_at: Date;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  user_id: string;

  // Token
  token: string;

  // Control de acceso
  fecha_creacion: Date;
  fecha_expiracion: Date;
  activo: boolean;
  requiere_password: boolean;
  password_hash?: string;

  // Limitaciones
  max_accesos?: number;
  accesos_realizados: number;

  // Metadatos
  nombre_destinatario?: string;
  email_destinatario?: string;
  notas?: string;

  // Auditoría
  ultimo_acceso?: Date;
  created_at: Date;
}

export interface DocumentAccessLog {
  id: string;
  document_share_id: string;

  // Información del acceso
  ip_address?: string;
  user_agent?: string;
  accion: 'VIEW' | 'DOWNLOAD' | 'FAILED_PASSWORD' | 'EXPIRED';
  exitoso: boolean;
  mensaje_error?: string;

  // Auditoría
  fecha_acceso: Date;
}

// DTOs para peticiones
export interface CreateDocumentDTO {
  nombre: string;
  descripcion?: string;
  categoria: DocumentCategoria;
  tipo_documento?: string;
  fecha_documento?: string; // ISO date string
  fecha_vencimiento?: string; // ISO date string
  notas?: string;
  etiquetas?: string[];
}

export interface UpdateDocumentDTO {
  nombre?: string;
  descripcion?: string;
  categoria?: DocumentCategoria;
  tipo_documento?: string;
  fecha_documento?: string;
  fecha_vencimiento?: string;
  notas?: string;
  etiquetas?: string[];
  estado?: DocumentoEstado;
}

export interface CreateShareDTO {
  duracion_horas?: number; // Default: 72 horas
  max_accesos?: number;
  requiere_password?: boolean;
  password?: string;
  nombre_destinatario?: string;
  email_destinatario?: string;
  notas?: string;
}

export interface CreateVersionDTO {
  motivo_cambio?: string;
  descripcion?: string;
  fecha_documento?: string;
}

// Respuestas extendidas
export interface DocumentWithVersions extends Document {
  versiones: DocumentVersion[];
  version_count: number;
}

export interface DocumentListFilters {
  categoria?: DocumentCategoria;
  estado?: DocumentoEstado;
  fecha_desde?: string;
  fecha_hasta?: string;
  search?: string; // Búsqueda en nombre, descripción, etiquetas
  vencimiento_proximo?: boolean; // Solo documentos con vencimiento en próximos 30 días
  page?: number;
  limit?: number;
  sort?: 'fecha_subida' | 'fecha_vencimiento' | 'nombre';
  order?: 'asc' | 'desc';
}

export interface DocumentStats {
  total: number;
  por_categoria: Record<DocumentCategoria, number>;
  por_vencer: number; // Vencen en próximos 30 días
  vencidos: number;
  activos: number;
  archivados: number;
}

export interface ShareVerifyPasswordDTO {
  password: string;
}

// ============================================================================
// Recurring Invoice Template types
// ============================================================================

export type FrecuenciaFactura = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | 'PERSONALIZADO';

export type TipoDiaGeneracion =
  | 'DIA_ESPECIFICO'        // Specific day of month (1-31)
  | 'PRIMER_DIA_NATURAL'    // First day of month (1st)
  | 'PRIMER_DIA_LECTIVO'    // First business day (Mon-Fri)
  | 'ULTIMO_DIA_NATURAL'    // Last day of month (28-31)
  | 'ULTIMO_DIA_LECTIVO';   // Last business day (Mon-Fri)

export interface RecurringInvoiceTemplate {
  id: string;
  user_id: string;

  // Template identification
  nombre_plantilla: string;
  descripcion?: string;

  // Invoice data (same fields as invoices table)
  cliente_id: string;
  serie: string;
  concepto: string;
  descripcion_detallada?: string;
  base_imponible: number;
  tipo_iva: number;
  tipo_irpf: number;

  // Dates configuration
  dias_vencimiento: number;
  incluir_periodo_facturacion: boolean;
  duracion_periodo_dias: number;

  // Recurrence settings
  frecuencia: FrecuenciaFactura;
  tipo_dia_generacion: TipoDiaGeneracion;
  dia_generacion: number;  // Only used when tipo_dia_generacion = 'DIA_ESPECIFICO'
  intervalo_dias?: number;

  // Scheduling
  proxima_generacion: Date;
  ultima_generacion?: Date;
  fecha_inicio: Date;
  fecha_fin?: Date;

  // Status
  activo: boolean;
  pausado: boolean;
  motivo_pausa?: string;

  // Automatic actions
  generar_pdf_automatico: boolean;
  enviar_email_automatico: boolean;

  // Audit & stats
  total_facturas_generadas: number;
  ultima_factura_generada_id?: string;

  created_at: Date;
  updated_at: Date;
}

export interface RecurringInvoiceHistory {
  id: string;
  template_id: string;
  invoice_id?: string;

  // Generation details
  fecha_generacion: Date;
  fecha_programada: Date;
  exitoso: boolean;

  // Error tracking
  error_mensaje?: string;
  error_stack?: string;

  // Generated invoice details (for audit trail even if invoice deleted)
  numero_factura?: string;
  total_factura?: number;

  created_at: Date;
}

// DTOs for recurring invoice templates
export interface CreateRecurringTemplateDTO {
  nombre_plantilla: string;
  descripcion?: string;
  cliente_id: string;
  serie?: string;
  concepto: string;
  descripcion_detallada?: string;
  base_imponible: number;
  tipo_iva?: number;
  tipo_irpf?: number;
  dias_vencimiento?: number;
  incluir_periodo_facturacion?: boolean;
  duracion_periodo_dias?: number;
  frecuencia: FrecuenciaFactura;
  tipo_dia_generacion?: TipoDiaGeneracion;
  dia_generacion?: number;
  intervalo_dias?: number;
  fecha_inicio: string; // ISO date string
  fecha_fin?: string; // ISO date string
  generar_pdf_automatico?: boolean;
  enviar_email_automatico?: boolean;
}

export interface UpdateRecurringTemplateDTO {
  nombre_plantilla?: string;
  descripcion?: string;
  cliente_id?: string;
  serie?: string;
  concepto?: string;
  descripcion_detallada?: string;
  base_imponible?: number;
  tipo_iva?: number;
  tipo_irpf?: number;
  dias_vencimiento?: number;
  incluir_periodo_facturacion?: boolean;
  duracion_periodo_dias?: number;
  frecuencia?: FrecuenciaFactura;
  tipo_dia_generacion?: TipoDiaGeneracion;
  dia_generacion?: number;
  intervalo_dias?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  generar_pdf_automatico?: boolean;
  enviar_email_automatico?: boolean;
}

export interface PauseTemplateDTO {
  motivo_pausa?: string;
}

export interface GenerateInvoiceFromTemplateDTO {
  fecha_emision_override?: string; // Optional date override for manual generation
}

// Extended Invoice with recurring fields
export interface InvoiceWithRecurring extends Invoice {
  template_id?: string;
  es_recurrente: boolean;
}

// Response types for recurring templates
export interface RecurringTemplateWithClient extends RecurringInvoiceTemplate {
  cliente: {
    id: string;
    razon_social: string;
    cif: string;
    activo: boolean;
  };
}

export interface RecurringInvoiceGenerationResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    templateId: string;
    error: string;
  }>;
}

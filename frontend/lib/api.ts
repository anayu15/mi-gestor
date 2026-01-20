const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function api(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Error en la petición');
  }

  return data;
}

// Authentication
export const auth = {
  register: (data: any) => api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => api('/auth/me'),
  updatePreferences: (data: any) => api('/auth/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
};

// Settings
export const settings = {
  getCompany: () => api('/settings/company'),
  updateCompany: (data: any) => api('/settings/company', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  checkPDFReadiness: () => api('/settings/company/pdf-readiness'),

  // Upload company logo (multipart/form-data)
  uploadLogo: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_URL}/settings/company/logo`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al subir logo');
    }
    return data;
  },
};

// Billing Configurations (Datos de Facturación)
export const billingConfigs = {
  list: () => api('/billing-configs'),
  get: (id: string) => api(`/billing-configs/${id}`),
  getActive: () => api('/billing-configs/active'),
  create: (data: any) => api('/billing-configs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api(`/billing-configs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/billing-configs/${id}`, { method: 'DELETE' }),
  activate: (id: string) => api(`/billing-configs/${id}/activate`, { method: 'POST' }),
  setPrincipal: (id: string) => api(`/billing-configs/${id}/set-principal`, { method: 'POST' }),

  // Upload logo for a specific billing config
  uploadLogo: async (id: string, file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_URL}/billing-configs/${id}/logo`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al subir logo');
    }
    return data;
  },
};

// Clients
export const clients = {
  list: (params?: any) => api(`/clients${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id: string) => api(`/clients/${id}`),
  create: (data: any) => api('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/clients/${id}`, { method: 'DELETE' }),
};

// Expenses
export const expenses = {
  list: (params?: any) => api(`/expenses${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id: string) => api(`/expenses/${id}`),
  create: (data: any) => api('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/expenses/${id}`, { method: 'DELETE' }),
  checkIndependence: (year: number, month: number) => api(`/expenses/independence-check/${year}/${month}`),
  markPaid: (id: string, data: any) => api(`/expenses/${id}/mark-paid`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Scheduled operations
  createScheduled: (data: any) => api('/expenses/create-scheduled', { method: 'POST', body: JSON.stringify(data) }),
  extendYear: (year: number) => api(`/expenses/extend-year/${year}`, { method: 'POST' }),
  deleteByYear: (year: number) => api(`/expenses/by-year/${year}`, { method: 'DELETE' }),
  getProgramacion: (id: string) => api(`/expenses/${id}/programacion`),
  updateWithSeries: (id: string, data: any, applyToAll: boolean) => api(`/expenses/${id}/with-series`, {
    method: 'PATCH',
    body: JSON.stringify({ ...data, apply_to_all: applyToAll })
  }),
  deleteWithSeries: (id: string, deleteAll: boolean) => api(`/expenses/${id}/with-series?deleteAll=${deleteAll}`, { method: 'DELETE' }),

  // Extract invoice data from uploaded image
  extractFromInvoice: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('invoice', file);

    const response = await fetch(`${API_URL}/expenses/extract-from-invoice`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al extraer datos de la factura');
    }
    return data;
  },
};

// Invoices
export const invoices = {
  list: (params?: { limit?: number }) => {
    const queryString = params?.limit ? `?limit=${params.limit}` : '';
    return api(`/invoices${queryString}`);
  },
  get: (id: string) => api(`/invoices/${id}`),
  nextNumber: (year?: number) => api(`/invoices/next-number${year ? '?year=' + year : ''}`),
  generate: (data: any) => api('/invoices/generate', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/invoices/${id}`, { method: 'DELETE' }),
  markPaid: (id: string, data: any) => api(`/invoices/${id}/mark-paid`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Scheduled operations
  generateScheduled: (data: any) => api('/invoices/generate-scheduled', { method: 'POST', body: JSON.stringify(data) }),
  extendYear: (year: number) => api(`/invoices/extend-year/${year}`, { method: 'POST' }),
  deleteByYear: (year: number) => api(`/invoices/by-year/${year}`, { method: 'DELETE' }),
  getProgramacion: (id: string) => api(`/invoices/${id}/programacion`),
  updateWithSeries: (id: string, data: any, applyToAll: boolean) => api(`/invoices/${id}/with-series`, {
    method: 'PATCH',
    body: JSON.stringify({ ...data, apply_to_all: applyToAll })
  }),
  deleteWithSeries: (id: string, deleteAll: boolean) => api(`/invoices/${id}/with-series?deleteAll=${deleteAll}`, { method: 'DELETE' }),

  // PDF operations
  downloadPDF: async (id: string, invoiceNumber: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/invoices/${id}/pdf`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || 'Error al descargar PDF');
    }

    // Create download link
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factura_${invoiceNumber.replace(/[\/\\]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  regeneratePDF: (id: string) => api(`/invoices/${id}/regenerate-pdf`, { method: 'POST' }),
};

// Programaciones (scheduled records)
export const programaciones = {
  list: (params?: any) => api(`/programaciones${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id: string) => api(`/programaciones/${id}`),
  preview: (data: any) => api('/programaciones/preview', { method: 'POST', body: JSON.stringify(data) }),
  getLinkedCount: (id: string) => api(`/programaciones/${id}/count`),
  update: (id: string, data: any) => api(`/programaciones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string, deleteRecords: boolean = false) => api(`/programaciones/${id}?deleteRecords=${deleteRecords}`, { method: 'DELETE' }),

  // Get contract attached to a programacion
  getContrato: (id: string) => api(`/programaciones/${id}/contrato`),

  // Regenerate series with new periodicity
  regenerate: (id: string, data: any) => api(`/programaciones/${id}/regenerate`, { method: 'POST', body: JSON.stringify(data) }),

  // Extract data from contract file for programacion
  extractFromContract: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('contract', file);

    const response = await fetch(`${API_URL}/programaciones/extract-from-contract`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al extraer datos del contrato');
    }
    return data;
  },
};

// Recurring Invoice Templates (deprecated - use programaciones)
export const recurringTemplates = {
  list: (params?: any) => api(`/recurring-templates${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id: string) => api(`/recurring-templates/${id}`),
  create: (data: any) => api('/recurring-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api(`/recurring-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/recurring-templates/${id}`, { method: 'DELETE' }),
  activate: (id: string) => api(`/recurring-templates/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) => api(`/recurring-templates/${id}/deactivate`, { method: 'POST' }),
  pause: (id: string, motivo?: string) => api(`/recurring-templates/${id}/pause`, {
    method: 'POST',
    body: JSON.stringify({ motivo_pausa: motivo })
  }),
  resume: (id: string) => api(`/recurring-templates/${id}/resume`, { method: 'POST' }),
  generateNow: (id: string, fechaOverride?: string) => api(`/recurring-templates/${id}/generate-now`, {
    method: 'POST',
    body: JSON.stringify({ fecha_emision_override: fechaOverride })
  }),
  history: (id: string) => api(`/recurring-templates/${id}/history`),
  previewNext: (id: string) => api(`/recurring-templates/${id}/preview-next`),
  fromInvoice: (invoiceId: string, data: any) => api(`/recurring-templates/from-invoice/${invoiceId}`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
};

// Dashboard
export const dashboard = {
  summary: (year: number) => api(`/dashboard/summary?year=${year}`),
  chart: (year: number) => api(`/dashboard/charts/ingresos-gastos?year=${year}`),
  fiscalCalendar: (year: number) => api(`/dashboard/fiscal-calendar?year=${year}`),
  modeloData: (modelo: string, trimestre?: number, year?: number) => {
    let path = `/dashboard/modelo-data/${modelo}`;
    if (trimestre !== undefined && trimestre !== null) {
      path += `/${trimestre}`;
    }
    if (year !== undefined && year !== null) {
      path += trimestre !== undefined ? `/${year}` : `//${year}`;
    }
    return api(path);
  },
};

// Tax
export const tax = {
  // Existing models
  modelo303: (year: number, trimestre: number) => api(`/tax/modelo-303/${year}/${trimestre}`),
  modelo130: (year: number, trimestre: number) => api(`/tax/modelo-130/${year}/${trimestre}`),
  modelo115: (year: number, trimestre: number) => api(`/tax/modelo-115/${year}/${trimestre}`),
  modelo180: (year: number) => api(`/tax/modelo-180/${year}`),
  modelo390: (year: number) => api(`/tax/modelo-390/${year}`),
  summary: (year: number) => api(`/tax/summary/${year}`),
  // New IVA models
  modelo349: (year: number, trimestre: number) => api(`/tax/modelo-349/${year}/${trimestre}`),
  // New IRPF models
  modelo131: (year: number, trimestre: number) => api(`/tax/modelo-131/${year}/${trimestre}`),
  // New Retenciones models
  modelo111: (year: number, trimestre: number) => api(`/tax/modelo-111/${year}/${trimestre}`),
  modelo190: (year: number) => api(`/tax/modelo-190/${year}`),
  modelo123: (year: number, trimestre: number) => api(`/tax/modelo-123/${year}/${trimestre}`),
  // Declaraciones Informativas
  modelo347: (year: number) => api(`/tax/modelo-347/${year}`),
  // Informational status endpoints
  siiStatus: () => api('/tax/sii/status'),
  viesStatus: () => api('/tax/vies-roi/status'),
  redemeStatus: () => api('/tax/redeme/status'),
};

// Document type for Modelo 036 uploads
export type TipoDocumento036 = 'ALTA' | 'MODIFICACION';

// Fiscal - Modelo 036 Analysis
export const fiscal = {
  /**
   * Upload and analyze Modelo 036 document
   * @param file The PDF/image file to upload
   * @param tipoDocumento Type of document:
   *   - ALTA: Complete new registration, invalidates previous documents
   *   - MODIFICACION: Partial modification, both documents remain valid
   */
  uploadModelo036: async (file: File, tipoDocumento: TipoDocumento036 = 'ALTA') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_URL}/fiscal/modelo-036/upload?tipo_documento=${tipoDocumento}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al analizar Modelo 036');
    }
    return data;
  },

  // Get current user's most recent 036 analysis
  getModelo036Analysis: () => api('/fiscal/modelo-036/analysis'),

  // Get specific analysis by ID
  getModelo036AnalysisById: (id: number) => api(`/fiscal/modelo-036/analysis/${id}`),

  // Get all 036 uploads history
  getModelo036History: () => api('/fiscal/modelo-036/history'),

  // Get mismatches between AI recommendations and user preferences
  getModelo036Mismatches: () => api('/fiscal/modelo-036/mismatches'),

  // Delete current 036 analysis
  deleteModelo036Analysis: () => api('/fiscal/modelo-036/analysis', { method: 'DELETE' }),

  // Delete specific 036 analysis by ID
  deleteModelo036AnalysisById: (id: number) => api(`/fiscal/modelo-036/analysis/${id}`, { method: 'DELETE' }),

  // ============================================================================
  // ALTA SS (RETA) ANALYSIS
  // ============================================================================

  // Upload and analyze Alta SS (RETA) document
  uploadAltaSS: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/fiscal/alta-ss/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al analizar documento de Alta SS');
    }
    return data;
  },

  // Get current user's most recent Alta SS analysis
  getAltaSSAnalysis: () => api('/fiscal/alta-ss/analysis'),

  // Get all Alta SS uploads history
  getAltaSSHistory: () => api('/fiscal/alta-ss/history'),

  // Delete current Alta SS analysis
  deleteAltaSSAnalysis: () => api('/fiscal/alta-ss/analysis', { method: 'DELETE' }),

  // Delete specific Alta SS analysis by ID
  deleteAltaSSAnalysisById: (id: number) => api(`/fiscal/alta-ss/analysis/${id}`, { method: 'DELETE' }),

  // ============================================================================
  // FISCAL OBLIGATION DOCUMENTS
  // ============================================================================

  // Upload document for a fiscal obligation (modelo)
  uploadObligationDocument: async (modelo: string, file: File, ano: number, trimestre?: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    let url = `${API_URL}/fiscal/obligations/${modelo}/upload?ano=${ano}`;
    if (trimestre !== undefined && trimestre !== null) {
      url += `&trimestre=${trimestre}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al subir documento');
    }
    return data;
  },

  // Get fiscal obligation document metadata
  getObligationDocument: (modelo: string, ano: number, trimestre?: number) => {
    let url = `/fiscal/obligations/${modelo}/document?ano=${ano}`;
    if (trimestre !== undefined && trimestre !== null) {
      url += `&trimestre=${trimestre}`;
    }
    return api(url);
  },

  // Get all fiscal obligation documents for a year
  getObligationDocumentsByYear: (ano: number) => api(`/fiscal/obligations/year/${ano}`),

  // Delete fiscal obligation document
  deleteObligationDocument: (modelo: string, ano: number, trimestre?: number) => {
    let url = `/fiscal/obligations/${modelo}/document?ano=${ano}`;
    if (trimestre !== undefined && trimestre !== null) {
      url += `&trimestre=${trimestre}`;
    }
    return api(url, { method: 'DELETE' });
  },
};

// Cashflow
export const cashflow = {
  daily: (start: string, end: string) => api(`/cashflow/daily?start=${start}&end=${end}`),
};

// Documents (special handling for file uploads)
export const documents = {
  // ============================================================================
  // UNIFIED DOCUMENTS (aggregated from all sources)
  // ============================================================================

  // List unified documents (expenses + invoices + standalone)
  listUnified: (params?: { year?: number; tipo?: string; etiqueta?: string; estado_ingreso?: string }) =>
    api(`/documents/unified${params ? '?' + new URLSearchParams(params as any) : ''}`),

  // Get view URL for any document source
  getViewUrl: (sourceType: string, id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return `${API_URL}/documents/view/${sourceType}/${id}${token ? `?token=${token}` : ''}`;
  },

  // Download from any document source
  downloadUnified: async (sourceType: string, id: string, filename: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/documents/download/${sourceType}/${id}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al descargar documento');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Delete document from any source (expense, document, programacion)
  // Note: invoice PDFs cannot be deleted separately
  deleteUnified: (sourceType: string, id: string) => api(`/documents/unified/${sourceType}/${id}`, {
    method: 'DELETE'
  }),

  // ============================================================================
  // STANDALONE DOCUMENTS (direct management)
  // ============================================================================

  // List standalone documents with filters
  list: (params?: any) => api(`/documents${params ? '?' + new URLSearchParams(params) : ''}`),

  // Get single document with versions
  get: (id: string) => api(`/documents/${id}`),

  // Upload new standalone document (multipart/form-data)
  upload: async (formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al subir documento');
    }
    return data;
  },

  // Update document metadata
  update: (id: string, data: any) => api(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Delete document
  delete: (id: string, hard: boolean = false) => api(`/documents/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE'
  }),

  // Download standalone document
  download: async (id: string, filename: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/documents/${id}/download`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al descargar documento');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Upload new version
  uploadVersion: async (id: string, formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/documents/${id}/versions`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al subir versión');
    }
    return data;
  },

  // Get versions history
  versions: (id: string) => api(`/documents/${id}/versions`),

  // Create share link
  createShare: (id: string, data: any) => api(`/documents/${id}/share`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // List shares for document
  listShares: (id: string) => api(`/documents/${id}/shares`),

  // Revoke share
  revokeShare: (shareId: string) => api(`/shares/${shareId}`, { method: 'DELETE' }),
};

// ============================================================================
// Chat API
// ============================================================================
export const chat = {
  send: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    api('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, includeContext: true })
    }),
  suggestions: () => api('/chat/suggestions'),
};

// ============================================================================
// Shared documents (public access)
// ============================================================================
export const shared = {
  // Access shared document
  get: (token: string, password?: string) =>
    api(`/shared/${token}${password ? '?password=' + encodeURIComponent(password) : ''}`, {
      headers: {} // No auth header for public access
    }),

  // Download shared document
  download: async (token: string, filename: string, password?: string) => {
    const url = `${API_URL}/shared/${token}?download=true${password ? '&password=' + encodeURIComponent(password) : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || 'Error al descargar documento');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};

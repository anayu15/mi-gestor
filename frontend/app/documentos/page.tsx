'use client';

import { Fragment, useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { documents } from '@/lib/api';
import { formatDayMonth } from '@/lib/utils';
import Navigation from '@/components/Navigation';
import PDFViewerModal from '@/components/PDFViewerModal';
import FileViewerModal from '@/components/FileViewerModal';

interface UnifiedDocument {
  source_type: 'expense' | 'invoice' | 'document' | 'programacion';
  source_id: string;
  doc_id: number | null;
  user_id: number;
  nombre: string;
  categoria: 'FACTURA_GASTO' | 'FACTURA_INGRESO' | 'CONTRATO' | 'OTRO';
  nombre_archivo: string;
  ruta: string;
  tipo_mime: string;
  tamanio: number;
  fecha_documento: string;
  created_at: string;
  gasto_id: number | null;
  factura_id: number | null;
  estado_ingreso: string | null;
  etiquetas: string[] | null;
}

interface DocumentStats {
  total: number;
  fiscal: number;
  hacienda: number;
  ss: number;
  facturas: number;
  gastos: number;
  ingresos: number;
  contratos: number;
}

// Etiquetas for filtering - organized by category
const ETIQUETAS = [
  { value: 'todos', label: 'Todos', color: 'slate' },
  { value: 'Fiscal', label: 'Fiscal', color: 'purple' },
  { value: 'Hacienda', label: 'Hacienda', color: 'amber' },
  { value: 'SS', label: 'Seg. Social', color: 'red' },
  { value: 'Facturas', label: 'Facturas', color: 'blue' },
  { value: 'Gasto', label: 'Gastos', color: 'rose' },
  { value: 'Ingreso', label: 'Ingresos', color: 'emerald' },
  { value: 'Contrato', label: 'Contratos', color: 'indigo' },
];

const ESTADOS_INGRESO = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'PAGADA', label: 'Solo cobrados' },
];

// Main page component wrapped in Suspense for useSearchParams
export default function DocumentosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando documentos...</p>
          </div>
        </main>
      </div>
    }>
      <DocumentosContent />
    </Suspense>
  );
}

// localStorage keys for persisting filters
const STORAGE_KEYS = {
  year: 'documentos_filter_year',
  etiqueta: 'documentos_filter_etiqueta',
  estadoIngreso: 'documentos_filter_estado_ingreso',
};

function DocumentosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize state from localStorage first, then URL params, then defaults
  // This ensures filters persist when navigating between tabs
  const getInitialYear = () => {
    // URL params take priority if present (for direct links/bookmarks)
    const yearParam = searchParams.get('year');
    if (yearParam) return parseInt(yearParam);
    
    // Then check localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.year);
      if (stored) return parseInt(stored);
    }
    
    return new Date().getFullYear();
  };
  
  const getInitialEtiqueta = () => {
    const etiquetaParam = searchParams.get('etiqueta');
    if (etiquetaParam) return etiquetaParam;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.etiqueta);
      if (stored) return stored;
    }
    
    return 'todos';
  };
  
  const getInitialEstadoIngreso = () => {
    const estadoParam = searchParams.get('estado_ingreso');
    if (estadoParam) return estadoParam;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.estadoIngreso);
      if (stored) return stored;
    }
    
    return 'todos';
  };

  const [documentos, setDocumentos] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(getInitialYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [stats, setStats] = useState<DocumentStats>({ total: 0, fiscal: 0, hacienda: 0, ss: 0, facturas: 0, gastos: 0, ingresos: 0, contratos: 0 });
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [etiquetaFilter, setEtiquetaFilter] = useState(getInitialEtiqueta);
  const [estadoIngresoFilter, setEstadoIngresoFilter] = useState(getInitialEstadoIngreso);

  // Modal states
  const [viewingPdf, setViewingPdf] = useState<{ sourceType: string; id: string; nombre: string } | null>(null);
  const [viewingFile, setViewingFile] = useState<{ sourceType: string; id: string; nombre: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<UnifiedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update URL when filters change (without reloading the page)
  const updateUrlParams = useCallback((year: number, etiqueta: string, estadoIngreso: string) => {
    const params = new URLSearchParams();
    
    // Only add non-default values to keep URL clean
    if (year !== new Date().getFullYear()) {
      params.set('year', year.toString());
    }
    if (etiqueta !== 'todos') {
      params.set('etiqueta', etiqueta);
    }
    if (estadoIngreso !== 'todos') {
      params.set('estado_ingreso', estadoIngreso);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `/documentos?${queryString}` : '/documentos';
    
    // Use replace to avoid adding to browser history on every filter change
    router.replace(newUrl, { scroll: false });
  }, [router]);

  // Update URL and localStorage when filters change
  useEffect(() => {
    updateUrlParams(selectedYear, etiquetaFilter, estadoIngresoFilter);
    
    // Persist to localStorage for cross-tab navigation
    localStorage.setItem(STORAGE_KEYS.year, selectedYear.toString());
    localStorage.setItem(STORAGE_KEYS.etiqueta, etiquetaFilter);
    localStorage.setItem(STORAGE_KEYS.estadoIngreso, estadoIngresoFilter);
  }, [selectedYear, etiquetaFilter, estadoIngresoFilter, updateUrlParams]);

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, [selectedYear, etiquetaFilter, estadoIngresoFilter]);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError('');

      const params: { year: number; etiqueta?: string; estado_ingreso?: string } = { year: selectedYear };
      if (etiquetaFilter !== 'todos') {
        params.etiqueta = etiquetaFilter;
      }
      // Apply estado_ingreso filter when viewing ingresos or all types
      if (estadoIngresoFilter !== 'todos' && (etiquetaFilter === 'todos' || etiquetaFilter === 'Ingreso')) {
        params.estado_ingreso = estadoIngresoFilter;
      }

      const response = await documents.listUnified(params);

      setDocumentos(response.data || []);
      setStats(response.meta?.stats || { total: 0, fiscal: 0, hacienda: 0, ss: 0, facturas: 0, gastos: 0, ingresos: 0, contratos: 0 });
      setAvailableYears(response.meta?.available_years || [new Date().getFullYear()]);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message || 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isYearDropdownOpen && !target.closest('[data-year-dropdown]')) {
        setIsYearDropdownOpen(false);
      }
      if (showFilters && !target.closest('[data-filter-container]')) {
        setShowFilters(false);
      }
    };

    if (isYearDropdownOpen || showFilters) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isYearDropdownOpen, showFilters]);

  // Month grouping helpers
  const getMonthKey = (doc: UnifiedDocument): string => {
    const date = doc.fecha_documento || doc.created_at;
    if (!date) return 'sin-fecha';
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return 'sin-fecha';
    const month = parsedDate.getUTCMonth();
    const year = parsedDate.getUTCFullYear();
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  const getMonthName = (monthKey: string): string => {
    if (monthKey === 'sin-fecha') return 'Sin fecha';
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month), 1);
    const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + year;
  };

  // Group documents by month
  const documentsByMonth = documentos.reduce((acc, doc) => {
    const monthKey = getMonthKey(doc);
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(doc);
    return acc;
  }, {} as Record<string, UnifiedDocument[]>);

  // Sort documents within each month by date (most recent first)
  Object.keys(documentsByMonth).forEach((monthKey) => {
    documentsByMonth[monthKey].sort((a, b) => {
      const dateA = new Date(a.fecha_documento || a.created_at).getTime();
      const dateB = new Date(b.fecha_documento || b.created_at).getTime();
      return dateB - dateA;
    });
  });

  // Sort months (most recent first)
  const sortedMonths = Object.keys(documentsByMonth).sort((a, b) => b.localeCompare(a));

  // Check if month is past
  const isMonthPast = (monthKey: string): boolean => {
    if (monthKey === 'sin-fecha') return true;
    const today = new Date();
    const [year, month] = monthKey.split('-').map(Number);
    return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  };

  // Initialize collapsed months
  useEffect(() => {
    const pastMonths = sortedMonths.filter(isMonthPast);
    setCollapsedMonths(new Set(pastMonths));
  }, [selectedYear, sortedMonths.join(',')]);

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const collapseAllMonths = () => setCollapsedMonths(new Set(sortedMonths));
  const expandAllMonths = () => setCollapsedMonths(new Set());

  // Get category badge style
  const getCategoryStyle = (categoria: string) => {
    switch (categoria) {
      case 'FACTURA_GASTO':
        return 'bg-red-100 text-red-800';
      case 'FACTURA_INGRESO':
        return 'bg-green-100 text-green-800';
      case 'CONTRATO':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (categoria: string) => {
    switch (categoria) {
      case 'FACTURA_GASTO':
        return 'Gasto';
      case 'FACTURA_INGRESO':
        return 'Ingreso';
      case 'CONTRATO':
        return 'Contrato';
      default:
        return 'Otro';
    }
  };

  // Get tag badge style based on tag name
  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'Fiscal':
        return 'bg-purple-100 text-purple-800';
      case 'Hacienda':
        return 'bg-amber-100 text-amber-800';
      case 'SS':
        return 'bg-red-100 text-red-800';
      case 'Facturas':
        return 'bg-blue-100 text-blue-800';
      case 'Gasto':
        return 'bg-rose-100 text-rose-800';
      case 'Ingreso':
        return 'bg-emerald-100 text-emerald-800';
      case 'Contrato':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Get source label
  const getSourceLabel = (doc: UnifiedDocument) => {
    switch (doc.source_type) {
      case 'expense':
        return `Gasto #${doc.source_id}`;
      case 'invoice':
        return doc.nombre.replace('Factura ', '');
      case 'document':
        return 'Manual';
      default:
        return '';
    }
  };

  // Get invoice state badge style
  const getEstadoIngresoStyle = (estado: string | null) => {
    switch (estado) {
      case 'PAGADA':
        return 'bg-emerald-100 text-emerald-700';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-700';
      case 'VENCIDA':
        return 'bg-red-100 text-red-700';
      case 'CANCELADA':
        return 'bg-slate-100 text-slate-500';
      default:
        return '';
    }
  };

  const getEstadoIngresoLabel = (estado: string | null) => {
    switch (estado) {
      case 'PAGADA':
        return 'Cobrado';
      case 'PENDIENTE':
        return 'Pendiente';
      case 'VENCIDA':
        return 'Vencida';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return '';
    }
  };

  // Handle view action
  const handleView = (doc: UnifiedDocument) => {
    const isPdf = doc.tipo_mime === 'application/pdf' || doc.nombre_archivo?.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setViewingPdf({ sourceType: doc.source_type, id: doc.source_id, nombre: doc.nombre });
    } else {
      setViewingFile({ sourceType: doc.source_type, id: doc.source_id, nombre: doc.nombre });
    }
  };

  // Handle download action
  const handleDownload = async (doc: UnifiedDocument) => {
    try {
      await documents.downloadUnified(doc.source_type, doc.source_id, doc.nombre_archivo || doc.nombre);
    } catch (err: any) {
      console.error('Error downloading:', err);
      alert('Error al descargar el documento');
    }
  };

  // Handle delete action
  const handleDelete = async () => {
    if (!deletingDoc) return;
    
    try {
      setIsDeleting(true);
      await documents.deleteUnified(deletingDoc.source_type, deletingDoc.source_id);
      setDeletingDoc(null);
      // Reload documents to reflect the change
      loadDocuments();
    } catch (err: any) {
      console.error('Error deleting:', err);
      alert(err.message || 'Error al eliminar el documento');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if document can be deleted
  const canDelete = (doc: UnifiedDocument) => {
    // Invoice PDFs cannot be deleted separately
    return doc.source_type !== 'invoice';
  };

  // Get delete confirmation message based on source type
  const getDeleteMessage = (doc: UnifiedDocument) => {
    switch (doc.source_type) {
      case 'expense':
        return 'Se eliminará el documento adjunto de este gasto. El gasto en sí no se eliminará.';
      case 'programacion':
        return 'Se eliminará el contrato adjunto de esta programación. La programación en sí no se eliminará.';
      case 'document':
        return 'El documento será eliminado.';
      default:
        return 'El documento será eliminado.';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Bar - matches Facturas/Fiscal style */}
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              {/* Year selector custom dropdown */}
              <div className="flex items-center">
                <div className="relative" data-year-dropdown>
                  <button
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                    className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white hover:border-slate-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all cursor-pointer min-w-[110px] flex items-center justify-between"
                  >
                    <span>{selectedYear}</span>
                    <svg
                      className={`h-5 w-5 text-gray-500 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {isYearDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full min-w-[140px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="py-1">
                        {availableYears.slice().reverse().map((year) => (
                          <button
                            key={year}
                            onClick={() => {
                              setSelectedYear(year);
                              setIsYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-all ${
                              year === selectedYear
                                ? 'bg-slate-100 text-slate-900 border-l-3 border-slate-600'
                                : year === new Date().getFullYear()
                                  ? 'bg-blue-50/50 text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                                  : 'text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                            }`}
                          >
                            {year}
                            {year === new Date().getFullYear() && (
                              <span className="ml-1 text-xs text-blue-600">(actual)</span>
                            )}
                            {year === selectedYear && (
                              <svg className="inline-block w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Control Icons Group */}
              <div className="flex items-center gap-1 ml-6">
              {/* Filter dropdown */}
              <div className="relative" data-filter-container>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center ${showFilters ? 'bg-slate-100' : ''}`}
                  title="Filtrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {/* Active filter indicator */}
                  {(etiquetaFilter !== 'todos' || estadoIngresoFilter !== 'todos') && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                  )}
                </button>

                {showFilters && (
                  <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 z-50 min-w-[220px] overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Filtrar por etiqueta</h3>
                    </div>

                    <div className="p-2.5 space-y-3">
                      {/* Etiqueta filter */}
                      <div>
                        <div className="space-y-1">
                          {ETIQUETAS.map(({ value, label }) => (
                            <label
                              key={value}
                              className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                etiquetaFilter === value
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <input
                                type="radio"
                                name="etiqueta"
                                value={value}
                                checked={etiquetaFilter === value}
                                onChange={(e) => setEtiquetaFilter(e.target.value)}
                                className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                              />
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagStyle(value === 'todos' ? 'slate' : value)}`}>
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Estado ingreso filter - shown when viewing ingresos or all */}
                      {(etiquetaFilter === 'todos' || etiquetaFilter === 'Ingreso' || etiquetaFilter === 'Facturas') && (
                        <>
                          <div className="border-t border-slate-200"></div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-1.5">Estado de ingresos</label>
                            <div className="space-y-1">
                              {ESTADOS_INGRESO.map(({ value, label }) => (
                                <label
                                  key={value}
                                  className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                    estadoIngresoFilter === value
                                      ? 'bg-blue-50 border border-blue-200'
                                      : 'hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="estado_ingreso"
                                    value={value}
                                    checked={estadoIngresoFilter === value}
                                    onChange={(e) => setEstadoIngresoFilter(e.target.value)}
                                    className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                                  />
                                  <span className={`text-xs font-medium ${estadoIngresoFilter === value ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-300 mx-1"></div>

              {/* Expand/Collapse buttons */}
              <button
                onClick={expandAllMonths}
                className="p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center"
                title="Expandir todos los meses"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l3 3 3-3" />
                </svg>
              </button>
              <button
                onClick={collapseAllMonths}
                className="p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center"
                title="Colapsar todos los meses"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 16l3-3 3 3" />
                </svg>
              </button>
              </div>
            </div>

            {/* Right: empty for now (could add upload button) */}
            <div />
          </div>
        </div>

        {/* Stats Cards - organized by tag categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {/* Total Card */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:shadow-md transition-shadow"
               onClick={() => setEtiquetaFilter('todos')}>
            <div className="text-[10px] font-medium text-slate-600 uppercase tracking-wide mb-0.5">Total</div>
            <div className="text-lg font-bold text-slate-700">{stats.total}</div>
          </div>

          {/* Fiscal Card */}
          <div className={`bg-gradient-to-br from-purple-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'Fiscal' ? 'border-purple-400 ring-2 ring-purple-200' : 'border-purple-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'Fiscal' ? 'todos' : 'Fiscal')}>
            <div className="text-[10px] font-medium text-purple-700 uppercase tracking-wide mb-0.5">Fiscal</div>
            <div className="text-lg font-bold text-purple-700">{stats.fiscal}</div>
          </div>

          {/* Hacienda Card */}
          <div className={`bg-gradient-to-br from-amber-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'Hacienda' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'Hacienda' ? 'todos' : 'Hacienda')}>
            <div className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-0.5">Hacienda</div>
            <div className="text-lg font-bold text-amber-700">{stats.hacienda}</div>
          </div>

          {/* SS Card */}
          <div className={`bg-gradient-to-br from-red-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'SS' ? 'border-red-400 ring-2 ring-red-200' : 'border-red-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'SS' ? 'todos' : 'SS')}>
            <div className="text-[10px] font-medium text-red-700 uppercase tracking-wide mb-0.5">Seg. Social</div>
            <div className="text-lg font-bold text-red-700">{stats.ss}</div>
          </div>

          {/* Gastos Card */}
          <div className={`bg-gradient-to-br from-rose-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'Gasto' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-rose-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'Gasto' ? 'todos' : 'Gasto')}>
            <div className="text-[10px] font-medium text-rose-700 uppercase tracking-wide mb-0.5">Gastos</div>
            <div className="text-lg font-bold text-rose-700">{stats.gastos}</div>
          </div>

          {/* Ingresos Card */}
          <div className={`bg-gradient-to-br from-emerald-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'Ingreso' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'Ingreso' ? 'todos' : 'Ingreso')}>
            <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide mb-0.5">Ingresos</div>
            <div className="text-lg font-bold text-emerald-700">{stats.ingresos}</div>
          </div>

          {/* Contratos Card */}
          <div className={`bg-gradient-to-br from-indigo-50 to-white rounded-lg border px-3 py-2.5 cursor-pointer hover:shadow-md transition-all ${etiquetaFilter === 'Contrato' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-indigo-100'}`}
               onClick={() => setEtiquetaFilter(etiquetaFilter === 'Contrato' ? 'todos' : 'Contrato')}>
            <div className="text-[10px] font-medium text-indigo-700 uppercase tracking-wide mb-0.5">Contratos</div>
            <div className="text-lg font-bold text-indigo-700">{stats.contratos}</div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Cargando documentos...</p>
          </div>
        ) : documentos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-600">No hay documentos para {selectedYear}</p>
            <p className="text-sm text-slate-500 mt-1">Los documentos apareceran aqui cuando crees gastos o ingresos</p>
          </div>
        ) : (
          /* Documents Table */
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Origen</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedMonths.map((monthKey) => (
                    <Fragment key={monthKey}>
                      {/* Month header */}
                      <tr
                        className="bg-blue-50 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => toggleMonthCollapse(monthKey)}
                      >
                        <td colSpan={5} className="px-4 py-2 text-left font-bold text-blue-900">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 transition-transform ${collapsedMonths.has(monthKey) ? '' : 'rotate-90'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {getMonthName(monthKey)}
                              {collapsedMonths.has(monthKey) && (
                                <span className="text-xs font-medium text-blue-500 ml-2 px-2 py-0.5 bg-blue-100 rounded-full">
                                  {documentsByMonth[monthKey].length} {documentsByMonth[monthKey].length === 1 ? 'documento' : 'documentos'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Documents for this month */}
                      {!collapsedMonths.has(monthKey) && documentsByMonth[monthKey].map((doc, idx) => (
                        <tr key={`${doc.source_type}-${doc.source_id}-${idx}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Show etiquetas (tags) if available */}
                              {doc.etiquetas && doc.etiquetas.length > 0 ? (
                                doc.etiquetas.map((tag, tagIdx) => (
                                  <span 
                                    key={tagIdx} 
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagStyle(tag)}`}
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                /* Fallback to category if no tags */
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(doc.categoria)}`}>
                                  {getCategoryLabel(doc.categoria)}
                                </span>
                              )}
                              {/* Show invoice state badge for ingresos */}
                              {doc.categoria === 'FACTURA_INGRESO' && doc.estado_ingreso && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoIngresoStyle(doc.estado_ingreso)}`}>
                                  {getEstadoIngresoLabel(doc.estado_ingreso)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {doc.fecha_documento ? formatDayMonth(doc.fecha_documento) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900 truncate max-w-xs" title={doc.nombre}>
                              {doc.nombre}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-xs" title={doc.nombre_archivo}>
                              {doc.nombre_archivo}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {getSourceLabel(doc)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* View button */}
                              <button
                                onClick={() => handleView(doc)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Ver documento"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              {/* Download/Export button */}
                              <button
                                onClick={() => handleDownload(doc)}
                                className="p-1.5 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Exportar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0-12l-4 4m4-4l4 4" />
                                </svg>
                              </button>
                              {/* Delete button */}
                              {canDelete(doc) && (
                                <button
                                  onClick={() => setDeletingDoc(doc)}
                                  className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Eliminar documento"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <PDFViewerModal
          invoiceId={viewingPdf.sourceType === 'invoice' ? viewingPdf.id : undefined}
          expenseId={viewingPdf.sourceType === 'expense' ? viewingPdf.id : undefined}
          documentId={viewingPdf.sourceType === 'document' ? viewingPdf.id : undefined}
          programacionId={viewingPdf.sourceType === 'programacion' ? viewingPdf.id : undefined}
          title={viewingPdf.nombre}
          onClose={() => setViewingPdf(null)}
        />
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewerModal
          expenseId={viewingFile.sourceType === 'expense' ? viewingFile.id : undefined}
          documentId={viewingFile.sourceType === 'document' ? viewingFile.id : undefined}
          programacionId={viewingFile.sourceType === 'programacion' ? viewingFile.id : undefined}
          title={viewingFile.nombre}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Eliminar documento</h3>
            </div>
            
            <div className="px-6 py-4">
              <p className="text-slate-700 mb-2">
                ¿Estás seguro de que quieres eliminar este documento?
              </p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-3">
                <span className="font-medium">{deletingDoc.nombre}</span>
                {deletingDoc.nombre_archivo && deletingDoc.nombre_archivo !== deletingDoc.nombre && (
                  <span className="text-slate-500 block text-xs mt-1">{deletingDoc.nombre_archivo}</span>
                )}
              </p>
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                {getDeleteMessage(deletingDoc)}
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

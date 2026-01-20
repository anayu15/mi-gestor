'use client';

import { useEffect, useState, Fragment, useCallback, useRef } from 'react';
import { dashboard, auth, fiscal } from '@/lib/api';
import { formatEuro, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ModeloModal from '@/components/ModeloModal';
import Toast from '@/components/Toast';
import FiscalSettings from '@/components/FiscalSettings';
import FiscalDocumentModal from '@/components/FiscalDocumentModal';
import Link from 'next/link';

export default function CalendarioFiscalPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [fiscalCalendar, setFiscalCalendar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState({
    mostrar_modelo_303: true,
    mostrar_modelo_130: true,
    mostrar_modelo_115: false,
    mostrar_modelo_180: false,
    mostrar_modelo_390: false,
    mostrar_modelo_100: false,
    tiene_tarifa_plana_ss: false,
    base_cotizacion: null as number | null,
    fecha_alta_aeat: null as string | null,
  });
  const [selectedModelo, setSelectedModelo] = useState<{ modelo: string; trimestre?: number; year?: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    estado: 'todos' as 'todos' | 'pendiente' | 'urgente' | 'vencido',
    tipo: 'todos' as 'todos' | 'ss' | 'trimestral' | 'anual',
  });

  // Fiscal document state
  const [obligationDocuments, setObligationDocuments] = useState<Record<string, any>>({});
  const [uploadingObligation, setUploadingObligation] = useState<{ modelo: string; trimestre?: number; ano: number; nombre: string } | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ modelo: string; trimestre?: number; ano: number; nombre: string } | null>(null);
  const [documentSuccess, setDocumentSuccess] = useState<string | null>(null);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const formatDayMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  // Generate available years for dropdown
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Helper to filter obligations based on user preferences and dropdown filters
  const filterObligations = (obligations: any[]) => {
    return obligations.filter((obligacion: any) => {
      // User preference filters (modelos visibility)
      if (!userPrefs.mostrar_modelo_130 && obligacion.modelo === '130') return false;
      if (!userPrefs.mostrar_modelo_303 && obligacion.modelo === '303') return false;
      if (!userPrefs.mostrar_modelo_115 && obligacion.modelo === '115') return false;
      if (!userPrefs.mostrar_modelo_180 && obligacion.modelo === '180') return false;
      if (!userPrefs.mostrar_modelo_390 && obligacion.modelo === '390') return false;
      if (!userPrefs.mostrar_modelo_100 && (obligacion.modelo === '100' || obligacion.modelo === 'RENTA')) return false;

      // Dropdown filter: Estado
      if (filters.estado !== 'todos') {
        const fechaLimite = new Date(obligacion.fecha_limite);
        const hoy = new Date();
        const diasRestantes = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        const esVencido = diasRestantes < 0;
        const esUrgente = diasRestantes <= 30 && diasRestantes >= 0;

        if (filters.estado === 'vencido' && !esVencido) return false;
        if (filters.estado === 'urgente' && !esUrgente) return false;
        if (filters.estado === 'pendiente' && esVencido) return false;
      }

      // Dropdown filter: Tipo de obligación
      if (filters.tipo !== 'todos') {
        const esSS = obligacion.tipo === 'SEGURIDAD_SOCIAL';
        const esAnual = obligacion.es_anual || obligacion.modelo === 'RENTA' || obligacion.modelo === '390' || obligacion.modelo === '180';
        const esTrimestral = !esSS && !esAnual && obligacion.trimestre !== null && obligacion.trimestre !== undefined;

        if (filters.tipo === 'ss' && !esSS) return false;
        if (filters.tipo === 'anual' && !esAnual) return false;
        if (filters.tipo === 'trimestral' && !esTrimestral) return false;
      }

      return true;
    });
  };

  // Get sorted months for expand/collapse all
  const getSortedMonths = () => {
    if (!fiscalCalendar?.calendario) return [];
    const filteredObligations = filterObligations(fiscalCalendar.calendario);
    const monthKeys = new Set<string>();
    filteredObligations.forEach((obligacion: any) => {
      const fecha = new Date(obligacion.fecha_limite);
      const month = fecha.getMonth();
      const year = fecha.getFullYear();
      monthKeys.add(`${year}-${String(month).padStart(2, '0')}`);
    });
    return Array.from(monthKeys).sort();
  };

  const expandAllMonths = () => {
    setCollapsedMonths(new Set());
  };

  const collapseAllMonths = () => {
    const allMonths = getSortedMonths();
    setCollapsedMonths(new Set(allMonths));
  };

  // Close year dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#year-dropdown-fiscal')) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (showFilters && !target.closest('[data-filter-container]')) {
        setShowFilters(false);
      }
    }

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilters]);

  const loadCalendar = useCallback(async (year: number, showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [calendarResponse, userResponse] = await Promise.all([
        dashboard.fiscalCalendar(year),
        auth.getMe(),
      ]);

      setFiscalCalendar(calendarResponse.data);
      setUserPrefs({
        mostrar_modelo_303: userResponse.data.mostrar_modelo_303 ?? true,
        mostrar_modelo_130: userResponse.data.mostrar_modelo_130 ?? true,
        mostrar_modelo_115: userResponse.data.mostrar_modelo_115 ?? false,
        mostrar_modelo_180: userResponse.data.mostrar_modelo_180 ?? false,
        mostrar_modelo_390: userResponse.data.mostrar_modelo_390 ?? false,
        mostrar_modelo_100: userResponse.data.mostrar_modelo_100 ?? false,
        tiene_tarifa_plana_ss: userResponse.data.tiene_tarifa_plana_ss ?? false,
        base_cotizacion: userResponse.data.base_cotizacion ? parseFloat(userResponse.data.base_cotizacion) : null,
        fecha_alta_aeat: userResponse.data.fecha_alta_aeat ?? null,
      });
      setLoading(false);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el calendario fiscal');
        setLoading(false);
      }
    }
  }, [router]);

  // Handle preference changes from FiscalSettings - refresh data directly
  // Returns a promise so the caller can await the refresh completion
  const handlePreferenceChange = useCallback(async () => {
    await loadCalendar(selectedYear, false);
  }, [loadCalendar, selectedYear]);

  // Load fiscal obligation documents for the selected year
  const loadObligationDocuments = useCallback(async (year: number) => {
    try {
      const response = await fiscal.getObligationDocumentsByYear(year);
      if (response.data) {
        // Build a map keyed by modelo-trimestre-ano
        const docsMap: Record<string, any> = {};
        response.data.forEach((doc: any) => {
          const key = `${doc.modelo}-${doc.trimestre || 'null'}-${doc.ano}`;
          docsMap[key] = doc;
        });
        setObligationDocuments(docsMap);
      }
    } catch (err) {
      console.error('Error loading obligation documents:', err);
    }
  }, []);

  // Get document key for an obligation
  const getDocumentKey = (modelo: string, trimestre: number | null | undefined, ano: number) => {
    return `${modelo}-${trimestre || 'null'}-${ano}`;
  };

  // Check if an obligation has a document
  const hasDocument = (modelo: string, trimestre: number | null | undefined, ano: number) => {
    const key = getDocumentKey(modelo, trimestre, ano);
    return !!obligationDocuments[key];
  };

  // Handle document upload success
  const handleDocumentUploadSuccess = useCallback(() => {
    setDocumentSuccess('Documento subido correctamente');
    setUploadingObligation(null);
    loadObligationDocuments(selectedYear);
  }, [selectedYear, loadObligationDocuments]);

  // Handle document delete success
  const handleDocumentDeleteSuccess = useCallback(() => {
    setDocumentSuccess('Documento eliminado correctamente');
    setViewingDocument(null);
    loadObligationDocuments(selectedYear);
  }, [selectedYear, loadObligationDocuments]);

  // Initial load and year changes - show loading spinner
  useEffect(() => {
    loadCalendar(selectedYear, true);
    loadObligationDocuments(selectedYear);
  }, [selectedYear, loadCalendar, loadObligationDocuments]);

  // Preference changes - refresh silently without spinner
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadCalendar(selectedYear, false);
    }
  }, [refreshTrigger, selectedYear, loadCalendar]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {error && (
        <Toast message={error} type="error" onClose={() => setError('')} />
      )}

      {documentSuccess && (
        <Toast message={documentSuccess} type="success" onClose={() => setDocumentSuccess(null)} />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando calendario fiscal...</p>
          </div>
        )}

        {/* Control Panel - matches Facturas style */}
        {!loading && (
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              {/* Year selector custom dropdown */}
              <div className="flex items-center">
                <div className="relative" id="year-dropdown-fiscal">
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
                                : year === currentYear
                                  ? 'bg-blue-50/50 text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                                  : 'text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                            }`}
                          >
                            {year}
                            {year === currentYear && (
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
              <div className="flex items-center gap-1 ml-3">
                {/* Filter button */}
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
                    {(filters.estado !== 'todos' || filters.tipo !== 'todos') && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                    )}
                  </button>

                  {/* Filter dropdown */}
                  {showFilters && (
                    <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 z-50 min-w-[220px] overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Filtros</h3>
                      </div>

                      <div className="p-2.5 space-y-3">
                        {/* Estado filter */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1.5">Estado</label>
                          <div className="space-y-1">
                            {[
                              { value: 'todos', label: 'Todos' },
                              { value: 'pendiente', label: 'Pendientes' },
                              { value: 'urgente', label: 'Urgentes (≤30 días)' },
                              { value: 'vencido', label: 'Vencidos' },
                            ].map(({ value, label }) => (
                              <label key={value} className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                filters.estado === value
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}>
                                <input
                                  type="radio"
                                  name="estado"
                                  value={value}
                                  checked={filters.estado === value}
                                  onChange={(e) => setFilters({ ...filters, estado: e.target.value as any })}
                                  className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                                />
                                <span className={`text-xs font-medium ${
                                  filters.estado === value ? 'text-blue-700' : 'text-slate-700'
                                }`}>
                                  {label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-200"></div>

                        {/* Tipo filter */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1.5">Tipo de obligación</label>
                          <div className="space-y-1">
                            {[
                              { value: 'todos', label: 'Todos' },
                              { value: 'ss', label: 'Seguridad Social' },
                              { value: 'trimestral', label: 'Trimestrales' },
                              { value: 'anual', label: 'Anuales' },
                            ].map(({ value, label }) => (
                              <label key={value} className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                filters.tipo === value
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}>
                                <input
                                  type="radio"
                                  name="tipo"
                                  value={value}
                                  checked={filters.tipo === value}
                                  onChange={(e) => setFilters({ ...filters, tipo: e.target.value as any })}
                                  className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                                />
                                <span className={`text-xs font-medium ${
                                  filters.tipo === value ? 'text-blue-700' : 'text-slate-700'
                                }`}>
                                  {label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-slate-300 mx-1"></div>

                {/* Collapse/Expand All buttons */}
                <button
                  onClick={expandAllMonths}
                  className="p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Expandir todos los meses"
                  disabled={getSortedMonths().length === 0}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l3 3 3-3" />
                  </svg>
                </button>
                <button
                  onClick={collapseAllMonths}
                  className="p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Colapsar todos los meses"
                  disabled={getSortedMonths().length === 0}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 16l3-3 3 3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md transition-colors flex items-center justify-center ${
                  showSettings
                    ? 'bg-slate-200 text-slate-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Configuracion fiscal"
              >
                <svg className={`w-5 h-5 transition-transform ${showSettings ? 'animate-spin-slow' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Settings Panel */}
        {!loading && showSettings && (
          <FiscalSettings onClose={() => setShowSettings(false)} onPreferenceChange={handlePreferenceChange} />
        )}

        {/* Configuration Required - No alta date set */}
        {!loading && !showSettings && !userPrefs.fecha_alta_aeat && (
          <div className="bg-white rounded-lg shadow-sm border border-amber-200 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">Configuración requerida</h3>
                  <p className="text-sm text-amber-700">Debes configurar tu fecha de alta en Hacienda para ver el calendario fiscal</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Para mostrar correctamente tus obligaciones fiscales, necesitamos saber cuándo te diste de alta como autónomo en la Agencia Tributaria (AEAT).
                Las obligaciones anteriores a esta fecha serán <strong>eliminadas</strong> del calendario, ya que no te corresponden.
              </p>
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configurar fecha de alta
              </button>
            </div>
          </div>
        )}

        {/* Summary Cards - one per tax type */}
        {!loading && !showSettings && fiscalCalendar && userPrefs.fecha_alta_aeat && (
          <div className="flex gap-4 mb-6">
            {/* Seguridad Social Card */}
            <div className="flex-1 bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 px-4 py-3">
              <div className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1">SS {selectedYear}</div>
              <div className="text-xl font-bold text-purple-700">{formatEuro(fiscalCalendar.resumen_anual.seguridad_social_anual)}</div>
            </div>

            {/* IVA Card */}
            {userPrefs.mostrar_modelo_303 && (
              <div className="flex-1 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 px-4 py-3">
                <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">IVA {selectedYear}</div>
                <div className="text-xl font-bold text-blue-700">{formatEuro(fiscalCalendar.resumen_anual.total_iva_estimado)}</div>
              </div>
            )}

            {/* IRPF Fraccionado Card (Modelo 130) */}
            {userPrefs.mostrar_modelo_130 && (
              <div className="flex-1 bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 px-4 py-3">
                <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">IRPF 130 {selectedYear}</div>
                <div className="text-xl font-bold text-green-700">{formatEuro(fiscalCalendar.resumen_anual.total_irpf_fraccionado)}</div>
              </div>
            )}

            {/* Retenciones Alquiler Card */}
            {userPrefs.mostrar_modelo_115 && (
              <div className="flex-1 bg-gradient-to-br from-orange-50 to-white rounded-lg border border-orange-100 px-4 py-3">
                <div className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">Retenc. {selectedYear}</div>
                <div className="text-xl font-bold text-orange-700">{formatEuro(fiscalCalendar.resumen_anual.total_retenciones_alquiler_115)}</div>
              </div>
            )}

            {/* Renta Card (Modelo 100) */}
            {userPrefs.mostrar_modelo_100 && (
              <div className="flex-1 bg-gradient-to-br from-emerald-50 to-white rounded-lg border border-emerald-100 px-4 py-3">
                <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Renta {selectedYear}</div>
                <div className="text-xl font-bold text-emerald-700">{formatEuro(fiscalCalendar.resumen_anual.irpf_brecha_estimada)}</div>
              </div>
            )}

            {/* Total Obligaciones Card */}
            <div className="flex-1 bg-gradient-to-br from-red-50 to-white rounded-lg border border-red-100 px-4 py-3">
              <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Total {selectedYear}</div>
              <div className="text-xl font-bold text-red-700">{formatEuro(
                fiscalCalendar.resumen_anual.seguridad_social_anual +
                (userPrefs.mostrar_modelo_303 ? fiscalCalendar.resumen_anual.total_iva_estimado : 0) +
                (userPrefs.mostrar_modelo_130 ? fiscalCalendar.resumen_anual.total_irpf_fraccionado : 0) +
                (userPrefs.mostrar_modelo_115 ? fiscalCalendar.resumen_anual.total_retenciones_alquiler_115 : 0) +
                (userPrefs.mostrar_modelo_100 ? fiscalCalendar.resumen_anual.irpf_brecha_estimada : 0)
              )}</div>
            </div>
          </div>
        )}

        {/* Obligations Table */}
        {!loading && !showSettings && fiscalCalendar && userPrefs.fecha_alta_aeat && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            {fiscalCalendar.calendario.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay obligaciones fiscales para el año {selectedYear}
              </div>
            ) : filterObligations(fiscalCalendar.calendario).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <p>No hay obligaciones que coincidan con los filtros seleccionados</p>
                <button
                  onClick={() => setFilters({ estado: 'todos', tipo: 'todos' })}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modelo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>Fecha</div>
                      <div>Limite</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {(() => {
                    // Filter obligations using the helper function
                    const filteredObligations = filterObligations(fiscalCalendar.calendario);

                    // Group by month and year
                    const groupedByMonth: Record<string, any[]> = {};
                    filteredObligations.forEach((obligacion: any) => {
                      const fecha = new Date(obligacion.fecha_limite);
                      const month = fecha.getMonth();
                      const year = fecha.getFullYear();
                      const key = `${year}-${String(month).padStart(2, '0')}`;
                      if (!groupedByMonth[key]) {
                        groupedByMonth[key] = [];
                      }
                      groupedByMonth[key].push(obligacion);
                    });

                    const sortedMonths = Object.keys(groupedByMonth).sort();

                    return sortedMonths.map((monthKey) => {
                      const [year, month] = monthKey.split('-').map(Number);
                      const obligations = groupedByMonth[monthKey];
                      const monthTotal = obligations.reduce((sum: number, o: any) => sum + (o.importe_estimado || 0), 0);

                      return (
                        <Fragment key={monthKey}>
                          {/* Month header row - clickable to collapse/expand */}
                          <tr
                            className="bg-blue-50 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => toggleMonthCollapse(monthKey)}
                          >
                            <td colSpan={7} className="px-4 py-1.5 text-left font-bold text-blue-900 text-base">
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
                                  {monthNames[month]} {year}
                                  {collapsedMonths.has(monthKey) && (
                                    <span className="text-xs font-medium text-blue-500 ml-2 px-2 py-0.5 bg-blue-100 rounded-full">
                                      {obligations.length} {obligations.length === 1 ? 'obligacion' : 'obligaciones'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs font-medium">
                                  <span className="text-red-600">Total: {formatEuro(monthTotal)}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Obligations for this month - only show if not collapsed */}
                          {!collapsedMonths.has(monthKey) && obligations.map((obligacion: any, index: number) => {
                            const fechaLimite = new Date(obligacion.fecha_limite);
                            const hoy = new Date();
                            const diasRestantes = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                            const esUrgente = diasRestantes <= 30 && diasRestantes > 0 && obligacion.tipo !== 'SEGURIDAD_SOCIAL';
                            const esVencido = diasRestantes < 0;

                            // Determine type badge style
                            let typeBadgeClass = '';
                            let typeLabel = '';
                            if (obligacion.tipo === 'SEGURIDAD_SOCIAL') {
                              typeBadgeClass = 'bg-slate-100 text-slate-700';
                              typeLabel = 'SS';
                            } else if (obligacion.es_anual || obligacion.modelo === 'RENTA' || obligacion.modelo === '390' || obligacion.modelo === '180') {
                              typeBadgeClass = 'bg-purple-100 text-purple-700';
                              typeLabel = 'Anual';
                            } else if (obligacion.trimestre !== null && obligacion.trimestre !== undefined) {
                              typeBadgeClass = 'bg-blue-100 text-blue-700';
                              typeLabel = `T${obligacion.trimestre}`;
                            } else {
                              typeBadgeClass = 'bg-gray-100 text-gray-700';
                              typeLabel = 'Otro';
                            }

                            // Row background based on status
                            let rowClass = 'hover:bg-gray-50 border-t border-gray-200';
                            if (esVencido) {
                              rowClass = 'bg-gray-50 hover:bg-gray-100 border-t border-gray-200';
                            } else if (esUrgente) {
                              rowClass = 'bg-amber-50 hover:bg-amber-100 border-t border-amber-200';
                            }

                            return (
                              <tr key={`${monthKey}-${index}`} className={rowClass}>
                                {/* Tipo */}
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full ${typeBadgeClass}`}>
                                    {typeLabel}
                                  </span>
                                </td>
                                {/* Modelo */}
                                <td className="px-4 py-3 text-center">
                                  <span className="font-mono text-sm font-bold text-gray-700">
                                    {obligacion.modelo}
                                  </span>
                                </td>
                                {/* Concepto */}
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  <div className="font-medium">{obligacion.nombre}</div>
                                  {obligacion.descripcion && (
                                    <div className="text-xs text-gray-500">{obligacion.descripcion}</div>
                                  )}
                                </td>
                                {/* Fecha Limite */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {formatDayMonth(obligacion.fecha_limite)}
                                </td>
                                {/* Estado */}
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  {esVencido ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                      Vencido
                                    </span>
                                  ) : esUrgente ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                      {diasRestantes}d
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      {diasRestantes}d
                                    </span>
                                  )}
                                </td>
                                {/* Importe */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-right">
                                  {obligacion.modelo === 'RENTA' ? (
                                    <span className={obligacion.importe_estimado < 0 ? 'text-red-600' : obligacion.importe_estimado > 0 ? 'text-green-600' : 'text-gray-900'}>
                                      {formatEuro(obligacion.importe_estimado)}
                                    </span>
                                  ) : (
                                    <span className={obligacion.importe_estimado === 0 ? 'text-gray-900' : 'text-red-600'}>
                                      {formatEuro(obligacion.importe_estimado)}
                                    </span>
                                  )}
                                </td>
                                {/* Acciones */}
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                                  <div className="flex items-center justify-center gap-1">
                                    {/* Document view/upload icon - only for AEAT models (not SEG-SOCIAL) */}
                                    {obligacion.tipo !== 'SEGURIDAD_SOCIAL' && (
                                      hasDocument(obligacion.modelo, obligacion.trimestre, obligacion.año) ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingDocument({
                                              modelo: obligacion.modelo,
                                              trimestre: obligacion.trimestre,
                                              ano: obligacion.año,
                                              nombre: obligacion.nombre,
                                            });
                                          }}
                                          className="text-green-600 hover:text-green-900 inline-flex items-center p-1"
                                          title="Ver documento adjunto"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setUploadingObligation({
                                              modelo: obligacion.modelo,
                                              trimestre: obligacion.trimestre,
                                              ano: obligacion.año,
                                              nombre: obligacion.nombre,
                                            });
                                          }}
                                          className="text-gray-400 hover:text-green-600 inline-flex items-center p-1"
                                          title="Adjuntar documento AEAT"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                      )
                                    )}
                                    {/* View detail button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedModelo({
                                          modelo: obligacion.modelo,
                                          trimestre: obligacion.trimestre,
                                          year: obligacion.año,
                                        });
                                      }}
                                      className="text-blue-600 hover:text-blue-900 inline-flex items-center p-1"
                                      title="Ver detalle"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-3 flex flex-wrap gap-3 text-xs border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">SS</span>
                <span className="text-gray-600">Seguridad Social</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">T1-T4</span>
                <span className="text-gray-600">Trimestral</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Anual</span>
                <span className="text-gray-600">Declaraciones anuales</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Xd</span>
                <span className="text-gray-600">Proxima (&lt; 30 dias)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Vencido</span>
                <span className="text-gray-600">Plazo pasado</span>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* Additional Info */}
        {!loading && !showSettings && userPrefs.fecha_alta_aeat && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-sm text-slate-700 flex items-start gap-2">
            <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Nota:</strong> Los importes son estimaciones basadas en tus ingresos y gastos actuales.
              Las cantidades finales pueden variar. La Seguridad Social incluye 12 mensualidades{userPrefs.tiene_tarifa_plana_ss ? (() => {
                const base = userPrefs.base_cotizacion || 950.98;
                const mei = base * 0.009;
                const total = 80 + mei;
                return ` de ${total.toFixed(2)}€ cada una (tarifa plana: 80€ + ${mei.toFixed(2)}€ MEI sobre base ${base}€)`;
              })() : ' variables segun ingresos'}.
              Todos los pagos se muestran en negativo (-€).
            </span>
          </div>
        </div>
        )}
      </main>

      {/* Modal */}
      {selectedModelo && (
        <ModeloModal
          modelo={selectedModelo.modelo}
          trimestre={selectedModelo.trimestre}
          year={selectedModelo.year || currentYear}
          onClose={() => setSelectedModelo(null)}
        />
      )}

      {/* Fiscal Document Upload Modal */}
      {uploadingObligation && (
        <FiscalDocumentModal
          mode="upload"
          modelo={uploadingObligation.modelo}
          trimestre={uploadingObligation.trimestre}
          ano={uploadingObligation.ano}
          title={uploadingObligation.nombre}
          onClose={() => setUploadingObligation(null)}
          onUploadSuccess={handleDocumentUploadSuccess}
        />
      )}

      {/* Fiscal Document View Modal */}
      {viewingDocument && (
        <FiscalDocumentModal
          mode="view"
          modelo={viewingDocument.modelo}
          trimestre={viewingDocument.trimestre}
          ano={viewingDocument.ano}
          title={viewingDocument.nombre}
          onClose={() => setViewingDocument(null)}
          onDeleteSuccess={handleDocumentDeleteSuccess}
        />
      )}
    </div>
  );
}

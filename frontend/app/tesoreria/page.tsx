'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { cashflow } from '@/lib/api';
import { formatEuro, formatDate, formatDayMonth } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast from '@/components/Toast';

interface Transaction {
  tipo: string;
  subtipo?: string;
  concepto: string;
  importe: number;
  estado?: string;
  pagada?: boolean;
  pagado?: boolean;
}

interface DailyFlow {
  fecha: string;
  ingresos: number;
  ingresos_reales: number;
  ingresos_potenciales: number;
  gastos: number;
  gastos_reales: number;
  gastos_potenciales: number;
  fiscal: number;
  movimiento: number;
  movimiento_real: number;
  movimiento_potencial: number;
  saldo: number;
  saldo_real: number;
  transacciones: Transaction[];
}

interface CashFlowData {
  periodo: {
    inicio: string;
    fin: string;
  };
  saldo_inicial: number;
  flujo_diario: DailyFlow[];
}

// Helper function to safely parse dates
function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // Handle YYYY-MM-DD format explicitly to avoid timezone issues
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return isNaN(date.getTime()) ? null : date;
  }
  
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Helper function to get month label from date string
function getMonthLabel(dateStr: string): string {
  const date = safeParseDate(dateStr);
  if (!date) return 'Fecha desconocida';
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
}

// Helper function to get month key (YYYY-MM) from date string
function getMonthKey(dateStr: string): string {
  const date = safeParseDate(dateStr);
  if (!date) return '0000-00';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper function to get month name from key
function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
}

// Helper function to get default dates (current month) - used for SSR-safe initialization
function getDefaultDates() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0]
  };
}

export default function TesoreriaPage() {
  const router = useRouter();
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Initialize with default dates (current month) - stable for SSR
  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load dates from localStorage after hydration
  useEffect(() => {
    const savedStartDate = localStorage.getItem('tesoreria_startDate');
    const savedEndDate = localStorage.getItem('tesoreria_endDate');

    if (savedStartDate && savedEndDate) {
      setStartDate(savedStartDate);
      setEndDate(savedEndDate);
    }
    setIsHydrated(true);
  }, []);

  // Load cash flow data after dates are hydrated
  useEffect(() => {
    if (isHydrated) {
      loadCashFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  async function loadCashFlow() {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await cashflow.daily(startDate, endDate);
      setData(response.data);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el flujo de caja');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCashFlowWithDates(start: string, end: string) {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await cashflow.daily(start, end);
      setData(response.data);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar el flujo de caja');
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleDay(fecha: string) {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(fecha)) {
      newExpanded.delete(fecha);
    } else {
      newExpanded.add(fecha);
    }
    setExpandedDays(newExpanded);
  }

  function toggleMonthCollapse(monthKey: string) {
    const newCollapsed = new Set(collapsedMonths);
    if (newCollapsed.has(monthKey)) {
      newCollapsed.delete(monthKey);
    } else {
      newCollapsed.add(monthKey);
    }
    setCollapsedMonths(newCollapsed);
  }

  function updateDates(start: string, end: string, autoLoad: boolean = true) {
    setStartDate(start);
    setEndDate(end);

    // Save to localStorage
    localStorage.setItem('tesoreria_startDate', start);
    localStorage.setItem('tesoreria_endDate', end);

    // Optionally load data with new dates
    if (autoLoad) {
      loadCashFlowWithDates(start, end);
    }
  }

  function setRangePreset(preset: string) {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'mes-actual':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'mes-siguiente':
        start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        break;
      case 'trimestre':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'año':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    updateDates(startStr, endStr, true);
    setIsDateDropdownOpen(false);
  }

  function expandAllMonths() {
    setCollapsedMonths(new Set());
  }

  function collapseAllMonths() {
    if (data) {
      const months = new Set<string>();
      data.flujo_diario
        .filter(day => day.transacciones.length > 0)
        .forEach(day => {
          months.add(getMonthKey(day.fecha));
        });
      setCollapsedMonths(months);
    }
  }

  // Filter days with transactions and group by month
  const daysWithTransactions = data?.flujo_diario.filter(d => d.transacciones.length > 0) || [];
  
  const daysByMonth: Record<string, DailyFlow[]> = {};
  daysWithTransactions.forEach(day => {
    const monthKey = getMonthKey(day.fecha);
    if (!daysByMonth[monthKey]) {
      daysByMonth[monthKey] = [];
    }
    daysByMonth[monthKey].push(day);
  });

  const sortedMonths = Object.keys(daysByMonth).sort();

  // Calculate totals
  const totalIngresos = daysWithTransactions.reduce((sum, d) => sum + d.ingresos, 0);
  const totalGastos = daysWithTransactions.reduce((sum, d) => sum + d.gastos, 0);
  const totalFiscal = daysWithTransactions.reduce((sum, d) => sum + d.fiscal, 0);
  const saldoFinal = data?.flujo_diario[data.flujo_diario.length - 1]?.saldo || 0;

  // Get current date label for the selector
  const getDateRangeLabel = () => {
    // Return a stable placeholder until hydrated to avoid hydration mismatch
    if (!isHydrated) return 'Cargando...';
    
    const start = safeParseDate(startDate);
    const end = safeParseDate(endDate);
    if (!start || !end) return 'Seleccionar período';
    
    const startMonth = start.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    const endMonth = end.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    
    if (startMonth === endMonth) return startMonth;
    return `${startMonth} - ${endMonth}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {error && (
        <Toast message={error} type="error" onClose={() => setError('')} />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando flujo de caja...</p>
          </div>
        )}

        {/* Date Range Selector and Controls */}
        {!loading && (
          <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
            <div className="flex justify-between items-center px-5 py-3">
              <div className="flex items-center gap-3">
                {/* Date range selector dropdown */}
                <div className="relative" id="date-dropdown">
                  <button
                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                    className="appearance-none pl-3 pr-9 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white hover:border-slate-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all cursor-pointer min-w-[180px] flex items-center justify-between"
                  >
                    <span>{getDateRangeLabel()}</span>
                    <svg
                      className={`h-5 w-5 text-gray-500 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {isDateDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Período rápido</h3>
                      </div>
                      <div className="py-1">
                        {[
                          { key: 'mes-actual', label: 'Mes actual' },
                          { key: 'mes-siguiente', label: 'Mes siguiente' },
                          { key: 'trimestre', label: 'Trimestre actual' },
                          { key: 'año', label: 'Año completo' },
                        ].map((preset) => (
                          <button
                            key={preset.key}
                            onClick={() => setRangePreset(preset.key)}
                            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border-l-3 border-transparent hover:border-slate-400 transition-all"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-slate-200"></div>
                      <div className="p-3 space-y-3">
                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Rango personalizado</div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-600 mb-1">Desde</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-slate-600 mb-1">Hasta</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            updateDates(startDate, endDate, true);
                            setIsDateDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 bg-slate-700 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Control Icons Group */}
                <div className="flex items-center gap-1 ml-6">
                  {/* Divider */}
                  <div className="h-5 w-px bg-slate-300 mx-1"></div>

                  {/* Collapse/Expand All buttons */}
                  <button
                    onClick={expandAllMonths}
                    className="p-2 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Expandir todos los meses"
                    disabled={sortedMonths.length === 0}
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
                    disabled={sortedMonths.length === 0}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 16l3-3 3 3" />
                    </svg>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && data && daysWithTransactions.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Ingresos</div>
                  <div className="text-xl font-bold text-green-700">+{formatEuro(totalIngresos)}</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-white rounded-lg border border-red-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Gastos</div>
                  <div className="text-xl font-bold text-red-700">-{formatEuro(totalGastos)}</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-white rounded-lg border border-orange-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">Fiscal</div>
                  <div className="text-xl font-bold text-orange-700">-{formatEuro(totalFiscal)}</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className={`rounded-lg border px-4 py-3 ${
              saldoFinal >= 0
                ? 'bg-gradient-to-br from-blue-50 to-white border-blue-100'
                : 'bg-gradient-to-br from-red-50 to-white border-red-200'
            }`}>
              <div>
                <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                  saldoFinal >= 0 ? 'text-blue-700' : 'text-red-700'
                }`}>Saldo</div>
                <div className={`text-xl font-bold ${saldoFinal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {saldoFinal >= 0 ? '+' : ''}{formatEuro(saldoFinal)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && data && daysWithTransactions.length === 0 && (
          <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sin actividad en este período
            </h3>
            <p className="text-gray-600">
              No hay ingresos, gastos ni obligaciones fiscales programadas para las fechas seleccionadas.
            </p>
          </div>
        )}

        {/* Cash Flow Table */}
        {!loading && data && daysWithTransactions.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>Ingresos</div>
                      <div className="text-[10px] font-normal text-gray-400 mt-0.5">(Real / Pend.)</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>Gastos</div>
                      <div className="text-[10px] font-normal text-gray-400 mt-0.5">(Real / Pend.)</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fiscal
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Movimiento
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedMonths.map((monthKey) => {
                    const monthDays = daysByMonth[monthKey];
                    const monthIngresos = monthDays.reduce((sum, d) => sum + d.ingresos, 0);
                    const monthGastos = monthDays.reduce((sum, d) => sum + d.gastos, 0);
                    const monthFiscal = monthDays.reduce((sum, d) => sum + d.fiscal, 0);
                    const monthMovimiento = monthDays.reduce((sum, d) => sum + d.movimiento, 0);
                    const lastDaySaldo = monthDays[monthDays.length - 1]?.saldo || 0;

                    return (
                      <Fragment key={monthKey}>
                        {/* Month header - clickable to collapse/expand */}
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
                                {getMonthName(monthKey)}
                                {collapsedMonths.has(monthKey) && (
                                  <span className="text-xs font-medium text-blue-500 ml-2 px-2 py-0.5 bg-blue-100 rounded-full">
                                    {monthDays.length} {monthDays.length === 1 ? 'Día' : 'Días'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs font-medium">
                                <span className="text-green-700">+{formatEuro(monthIngresos)}</span>
                                <span className="text-red-600">-{formatEuro(monthGastos)}</span>
                                {monthFiscal > 0 && (
                                  <span className="text-orange-600">-{formatEuro(monthFiscal)}</span>
                                )}
                                <span className={monthMovimiento >= 0 ? 'text-blue-700' : 'text-orange-700'}>
                                  = {monthMovimiento >= 0 ? '+' : ''}{formatEuro(monthMovimiento)}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Days for this month - only show if not collapsed */}
                        {!collapsedMonths.has(monthKey) && monthDays.map((day) => {
                          const isExpanded = expandedDays.has(day.fecha);
                          const hasTransactions = day.transacciones.length > 0;
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isToday = day.fecha === todayStr;
                          const isPast = day.fecha < todayStr;

                          return (
                            <Fragment key={day.fecha}>
                              <tr
                                className={`${hasTransactions ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                                  isToday ? 'bg-blue-50 border-l-4 border-blue-500' :
                                  isPast ? 'opacity-75' : ''
                                } border-t border-gray-200`}
                                onClick={() => hasTransactions && toggleDay(day.fecha)}
                              >
                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                                  isPast ? 'text-gray-500' : 'text-gray-900'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {isPast && (
                                      <span className="text-gray-400" title="Fecha pasada">✓</span>
                                    )}
                                    {formatDate(day.fecha)}
                                    {isToday && (
                                      <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded font-semibold">
                                        HOY
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  {day.ingresos > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-green-700 font-semibold">
                                        +{formatEuro(day.ingresos_reales)}
                                      </span>
                                      {day.ingresos_potenciales > 0 && (
                                        <span className="text-green-400 text-xs">
                                          +{formatEuro(day.ingresos_potenciales)}
                                        </span>
                                      )}
                                    </div>
                                  ) : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  {day.gastos > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-red-700 font-semibold">
                                        -{formatEuro(day.gastos_reales)}
                                      </span>
                                      {day.gastos_potenciales > 0 && (
                                        <span className="text-red-400 text-xs">
                                          -{formatEuro(day.gastos_potenciales)}
                                        </span>
                                      )}
                                    </div>
                                  ) : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  {day.fiscal > 0 ? (
                                    <span className="text-orange-600 font-semibold">-{formatEuro(day.fiscal)}</span>
                                  ) : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  <span className={`font-medium ${
                                    day.movimiento > 0 ? 'text-green-600' :
                                    day.movimiento < 0 ? 'text-red-600' :
                                    'text-gray-500'
                                  }`}>
                                    {day.movimiento !== 0 ? (day.movimiento > 0 ? '+' : '') + formatEuro(day.movimiento) : '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  <span className={`font-bold ${
                                    day.saldo > 0 ? 'text-blue-600' :
                                    day.saldo < 0 ? 'text-red-600' :
                                    'text-gray-500'
                                  }`}>
                                    {formatEuro(day.saldo)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                  {hasTransactions && (
                                    <span className="text-gray-400">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded transactions */}
                              {isExpanded && hasTransactions && (
                                <tr>
                                  <td colSpan={7} className="px-6 py-4 bg-gray-50">
                                    <div className="space-y-2">
                                      {day.transacciones.map((trans, idx) => (
                                        <div
                                          key={idx}
                                          className="flex justify-between items-center p-3 bg-white rounded border"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${
                                              trans.tipo === 'ingreso' ? 'bg-green-500' :
                                              trans.tipo === 'gasto' ? 'bg-red-500' :
                                              'bg-orange-500'
                                            }`}></span>
                                            <span className="text-sm font-medium text-gray-900">
                                              {trans.concepto}
                                            </span>
                                            {trans.subtipo && (
                                              <span className={`text-xs px-2 py-1 rounded font-medium ${
                                                trans.subtipo === 'real' ? 'bg-blue-100 text-blue-800' :
                                                trans.subtipo === 'potencial' ? 'bg-gray-100 text-gray-600' :
                                                'bg-gray-100 text-gray-800'
                                              }`}>
                                                {trans.subtipo === 'real' ? (trans.tipo === 'ingreso' ? '✓ Cobrado' : '✓ Pagado') : '⏱ Pendiente'}
                                              </span>
                                            )}
                                          </div>
                                          <span className={`text-sm font-semibold ${
                                            trans.importe > 0 ? 'text-green-600' :
                                            trans.importe < 0 ? 'text-red-600' :
                                            'text-gray-500'
                                          }`}>
                                            {trans.importe > 0 ? '+' : ''}{formatEuro(trans.importe)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {data.flujo_diario.filter(d => d.transacciones.length > 0).length > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Saldo real (solo pagos efectuados)</span>
                    <span className={`text-lg font-bold ${
                      data.flujo_diario[data.flujo_diario.length - 1].saldo_real > 0 ? 'text-blue-600' :
                      data.flujo_diario[data.flujo_diario.length - 1].saldo_real < 0 ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {formatEuro(data.flujo_diario[data.flujo_diario.length - 1].saldo_real)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                    <span className="text-sm font-medium text-gray-700">Saldo proyectado (incluye pendientes)</span>
                    <span className={`text-xl font-bold ${
                      data.flujo_diario[data.flujo_diario.length - 1].saldo > 0 ? 'text-blue-600' :
                      data.flujo_diario[data.flujo_diario.length - 1].saldo < 0 ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {formatEuro(data.flujo_diario[data.flujo_diario.length - 1].saldo)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { Fragment, useEffect, useState } from 'react';
import { invoices, expenses, programaciones, clients, billingConfigs } from '@/lib/api';
import { formatEuro, formatDayMonth, formatDateShort } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import PDFViewerModal from '@/components/PDFViewerModal';
import FileViewerModal from '@/components/FileViewerModal';
import ContractViewerModal from '@/components/ContractViewerModal';
import StatusToggle from '@/components/StatusToggle';
import NuevoGastoModal from '@/components/NuevoGastoModal';
import NuevaFacturaModal from '@/components/NuevaFacturaModal';
import EditarGastoModal from '@/components/EditarGastoModal';
import EditarFacturaModal from '@/components/EditarFacturaModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import ConfirmBulkActionModal from '@/components/ConfirmBulkActionModal';
import NuevoClienteModal from '@/components/NuevoClienteModal';
import EditarClienteModal from '@/components/EditarClienteModal';
import NuevaDatosFacturacionModal from '@/components/NuevaDatosFacturacionModal';
import EditarDatosFacturacionModal from '@/components/EditarDatosFacturacionModal';
import Toast from '@/components/Toast';

interface Programacion {
  id: string;
  tipo: 'INGRESO' | 'GASTO';
  nombre?: string;
  periodicidad: string;
  tipo_dia: string;
  dia_especifico?: number;
  fecha_inicio: string;
  fecha_fin?: string;
  datos_base: {
    concepto?: string;
    base_imponible?: number;
    proveedor_nombre?: string;
    cliente_id?: string;
  };
  total_generados: number;
  ultimo_ano_generado?: number;
  frecuencia_label?: string;
  frecuencia_descripcion?: string;
  total_ingresos?: number;
  total_gastos?: number;
  // Contract fields
  contrato_document_id?: string;
  contrato_datos_extraidos?: Record<string, unknown>;
  contrato_confianza?: number;
}

interface Factura {
  id: number;
  tipo: 'ingreso' | 'gasto';
  numero_factura?: string;
  fecha_emision: string;
  concepto: string;
  base_imponible: number;
  cuota_iva: number;
  cuota_irpf?: number;
  total_factura: number;
  estado?: string;
  pagada?: boolean;  // Para ingresos
  pagado?: boolean;  // Para gastos
  fecha_cobro?: string;
  fecha_pago?: string;
  cliente?: {
    razon_social: string;
    cif: string;
  };
  proveedor?: string;
  categoria?: string;
  es_deducible?: boolean;
  pdf_url?: string;
  pdf_generado?: boolean;
  es_recurrente?: boolean;
  archivo_url?: string;
  programacion_id?: string;
}

interface Client {
  id: string;
  razon_social: string;
  cif: string;
  email: string;
  telefono?: string;
  direccion: string;
  ciudad?: string;
  codigo_postal?: string;
  provincia?: string;
  es_cliente_principal: boolean;
  activo: boolean;
}

interface BillingConfig {
  id: string;
  razon_social: string;
  nif: string;
  direccion?: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  email_facturacion?: string;
  iban?: string;
  logo_url?: string;
  notas_factura?: string;
  activo: boolean;
  created_at: string;
}

// Helper function to get initials from a name/razon_social
function getInitials(name: string): string {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word: take first two characters
    return words[0].substring(0, 2).toUpperCase();
  }
  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Generate a consistent background color based on the name
function getInitialsColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function FacturasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pdfModalInvoiceId, setPdfModalInvoiceId] = useState<string | null>(null);
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [isFacturaModalOpen, setIsFacturaModalOpen] = useState(false);
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  const [editingFacturaId, setEditingFacturaId] = useState<string | null>(null);
  const [editingSeriesMode, setEditingSeriesMode] = useState(false); // true when editing entire series
  const [editingProgramacionId, setEditingProgramacionId] = useState<string | null>(null); // programacion_id when editing series
  const [editingFromSettings, setEditingFromSettings] = useState(false); // true when edit was initiated from settings panel
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [viewingFileExpense, setViewingFileExpense] = useState<{ id: string; concepto: string } | null>(null);
  const [viewingContract, setViewingContract] = useState<{ programacionId: string; nombre: string } | null>(null);
  const [deletingFactura, setDeletingFactura] = useState<Factura | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [extendableYears, setExtendableYears] = useState<number[]>([]);
  const [isExtending, setIsExtending] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);
  const [isDeletingYear, setIsDeletingYear] = useState(false);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const [programacionesList, setProgramacionesList] = useState<Programacion[]>([]);
  const [programacionToDelete, setProgramacionToDelete] = useState<Programacion | null>(null);
  const [isDeletingProgramacion, setIsDeletingProgramacion] = useState(false);
  const [editingNombreId, setEditingNombreId] = useState<string | null>(null);
  const [editingNombreValue, setEditingNombreValue] = useState<string>('');
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [showInactiveClients, setShowInactiveClients] = useState(false);

  // Billing configs state
  const [billingConfigsList, setBillingConfigsList] = useState<BillingConfig[]>([]);
  const [loadingBillingConfigs, setLoadingBillingConfigs] = useState(false);
  const [isNewBillingConfigModalOpen, setIsNewBillingConfigModalOpen] = useState(false);
  const [showInactiveBillingConfigs, setShowInactiveBillingConfigs] = useState(false);
  const [editingBillingConfigId, setEditingBillingConfigId] = useState<string | null>(null);
  const [deletingBillingConfig, setDeletingBillingConfig] = useState<BillingConfig | null>(null);
  const [isDeletingBillingConfig, setIsDeletingBillingConfig] = useState(false);
  const [showNoBillingConfigWarning, setShowNoBillingConfigWarning] = useState(false);

  // Bulk action modal state
  const [bulkActionModal, setBulkActionModal] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
    factura: Factura | null;
    seriesCount: number;
  }>({ isOpen: false, action: 'delete', factura: null, seriesCount: 0 });
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    tipo: 'todos' as 'todos' | 'ingreso' | 'gasto',
    estado: 'todos' as 'todos' | 'pagada' | 'pendiente',
  });

  // Quick file upload modal state for expenses
  const [uploadingExpense, setUploadingExpense] = useState<{ id: string; concepto: string; belongsToSeries: boolean } | null>(null);

  useEffect(() => {
    loadFacturas();
    loadBillingConfigs(); // Load billing configs for "Nuevo Ingreso" check
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // Check if click is outside the filter button and dropdown
      if (showFilters && !target.closest('[data-filter-container]')) {
        setShowFilters(false);
      }
    }

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilters]);

  // Reload when navigating back to this page
  useEffect(() => {
    if (pathname === '/facturas') {
      loadFacturas();
    }
  }, [pathname]);

  // Auto-dismiss notifications after 3 seconds
  useEffect(() => {
    if (settingsSuccess) {
      const timer = setTimeout(() => {
        setSettingsSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [settingsSuccess]);

  useEffect(() => {
    if (settingsError) {
      const timer = setTimeout(() => {
        setSettingsError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [settingsError]);

  async function loadFacturas() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Load both invoices and expenses (no pagination - frontend filters by year)
      const [invoicesResponse, expensesResponse] = await Promise.all([
        invoices.list({ limit: 10000 }),
        expenses.list({ limit: 10000 }),
      ]);

      // Transform invoices to unified format
      const ingresosData: Factura[] = (invoicesResponse.data || []).map((inv: any) => ({
        ...inv,
        tipo: 'ingreso' as const,
      }));

      // Transform expenses to unified format
      const gastosData: Factura[] = (expensesResponse.data || []).map((exp: any) => ({
        ...exp,
        tipo: 'gasto' as const,
        proveedor: exp.proveedor_nombre,
      }));

      // Combine and sort by date (earliest to latest)
      const allFacturas = [...ingresosData, ...gastosData].sort(
        (a, b) => new Date(a.fecha_emision).getTime() - new Date(b.fecha_emision).getTime()
      );

      setFacturas(allFacturas);

      // Extract unique years based on fecha_pago/fecha_cobro or fecha_emision
      const currentYear = new Date().getFullYear();
      const yearsFromInvoices = Array.from(
        new Set(
          allFacturas.map((f) => {
            const date = f.fecha_pago || f.fecha_cobro || f.fecha_emision;
            return new Date(date).getFullYear();
          })
        )
      );

      // Get persisted years from localStorage (years that were created but may have no invoices)
      const storedYears: number[] = JSON.parse(localStorage.getItem('facturasCreatedYears') || '[]');

      // Merge: invoices years + stored years + current year (always present)
      // Use functional update to also preserve any years currently in state
      setAvailableYears(prevYears => {
        const computedYears = Array.from(new Set([
          ...yearsFromInvoices,
          ...storedYears,
          ...prevYears,
          currentYear
        ])).sort((a, b) => b - a);

        // Update localStorage with all years
        const yearsToStore = Array.from(new Set([...storedYears, ...yearsFromInvoices, ...prevYears]));
        localStorage.setItem('facturasCreatedYears', JSON.stringify(yearsToStore));

        // Only change selectedYear if current selection is invalid (not in available years)
        // This preserves the user's year selection when reloading data
        setSelectedYear(prevSelectedYear => {
          if (computedYears.includes(prevSelectedYear)) {
            return prevSelectedYear; // Keep current selection
          }
          return currentYear; // Default to current year only if selection is invalid
        });

        return computedYears;
      });
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticación')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.message || 'Error al cargar facturas');
      }
    } finally {
      setLoading(false);
    }
  }

  // Check for programaciones that can be extended to future years
  // Load programaciones for settings panel
  async function loadProgramaciones() {
    try {
      const response = await programaciones.list();
      setProgramacionesList(response.data || []);
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cargar programaciones');
    }
  }

  // Load clients for settings panel
  async function loadClients(includeInactive = false) {
    setLoadingClients(true);
    try {
      // Load active clients, or all clients if toggle is on
      const response = await clients.list(includeInactive ? { activo: 'all' } : {});
      setClientsList(response.data || []);
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cargar clientes');
    } finally {
      setLoadingClients(false);
    }
  }

  // Toggle client active status
  async function toggleClientStatus(client: Client) {
    // Don't allow toggling the principal client
    if (client.es_cliente_principal) {
      return;
    }

    try {
      const newStatus = !client.activo;
      await clients.update(client.id, { activo: newStatus });

      // Update the local state
      setClientsList(prevClients =>
        prevClients.map(c =>
          c.id === client.id ? { ...c, activo: newStatus } : c
        )
      );
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cambiar el estado del cliente');
    }
  }

  // Handle client deletion
  async function confirmDeleteClient() {
    if (!deletingClient) return;

    setIsDeletingClient(true);
    try {
      await clients.delete(deletingClient.id);
      setClientsList(clientsList.filter((c) => c.id !== deletingClient.id));
      setSettingsSuccess(`Cliente "${deletingClient.razon_social}" eliminado correctamente`);
      setDeletingClient(null);
    } catch (err: any) {
      setSettingsError(err.message || 'Error al eliminar cliente');
    } finally {
      setIsDeletingClient(false);
    }
  }

  function cancelDeleteClient() {
    setDeletingClient(null);
    setIsDeletingClient(false);
  }

  // Load billing configs for settings panel
  async function loadBillingConfigs() {
    setLoadingBillingConfigs(true);
    try {
      const response = await billingConfigs.list();
      setBillingConfigsList(response.data || []);
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cargar configuraciones de facturación');
    } finally {
      setLoadingBillingConfigs(false);
    }
  }

  // Handle billing config toggle (activate/deactivate)
  async function handleToggleBillingConfig(config: BillingConfig) {
    try {
      const newStatus = !config.activo;
      await billingConfigs.update(config.id, { activo: newStatus });

      // Update the local state
      setBillingConfigsList(prevConfigs =>
        prevConfigs.map(c =>
          c.id === config.id ? { ...c, activo: newStatus } : c
        )
      );
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cambiar el estado de la configuración');
    }
  }

  // Handle billing config deletion
  async function confirmDeleteBillingConfig() {
    if (!deletingBillingConfig) return;

    setIsDeletingBillingConfig(true);
    try {
      await billingConfigs.delete(deletingBillingConfig.id);
      setBillingConfigsList(billingConfigsList.filter((c) => c.id !== deletingBillingConfig.id));
      setSettingsSuccess(`Configuración "${deletingBillingConfig.razon_social}" eliminada correctamente`);
      setDeletingBillingConfig(null);
      // Reload to get updated active states if another was auto-activated
      await loadBillingConfigs();
    } catch (err: any) {
      setSettingsError(err.message || 'Error al eliminar la configuración');
    } finally {
      setIsDeletingBillingConfig(false);
    }
  }

  function cancelDeleteBillingConfig() {
    setDeletingBillingConfig(null);
    setIsDeletingBillingConfig(false);
  }

  // Handle "Nuevo Ingreso" click - check if billing config exists and is active
  function handleNuevoIngreso() {
    const hasActiveConfig = billingConfigsList.some(c => c.activo);
    if (billingConfigsList.length === 0 || !hasActiveConfig) {
      setShowNoBillingConfigWarning(true);
    } else {
      setIsFacturaModalOpen(true);
    }
  }

  // Handle deleting programacion
  async function handleDeleteProgramacion(deleteRecords: boolean) {
    if (!programacionToDelete) return;

    setIsDeletingProgramacion(true);
    try {
      await programaciones.delete(programacionToDelete.id, deleteRecords);
      setSettingsSuccess(
        deleteRecords
          ? `Programación "${programacionToDelete.nombre || programacionToDelete.datos_base?.concepto}" y sus registros han sido eliminados`
          : `Programación "${programacionToDelete.nombre || programacionToDelete.datos_base?.concepto}" ha sido eliminada (registros conservados)`
      );
      // Refresh programaciones, main list, and extendable years
      await loadProgramaciones();
      if (deleteRecords) {
        await loadFacturas();
      }
      // Always re-check extendable years when a programacion is deleted
      await checkExtendableYears();
    } catch (err: any) {
      setSettingsError(err.message || 'Error al eliminar la programación');
    } finally {
      setIsDeletingProgramacion(false);
      setProgramacionToDelete(null);
    }
  }

  // Load programaciones, clients, and billing configs when settings panel is opened
  useEffect(() => {
    if (showSettings) {
      loadProgramaciones();
      loadClients(showInactiveClients);
      loadBillingConfigs();
    }
  }, [showSettings, showInactiveClients]);

  // Inline editing for programacion nombre
  function handleNombreDoubleClick(prog: Programacion) {
    setEditingNombreId(prog.id);
    setEditingNombreValue(prog.nombre || prog.datos_base?.concepto || '');
  }

  async function handleNombreSave(id: string) {
    if (!editingNombreValue.trim()) {
      setSettingsError('El nombre no puede estar vacío');
      setEditingNombreId(null);
      return;
    }

    try {
      await programaciones.update(id, { nombre: editingNombreValue.trim() });
      // Update local state
      setProgramacionesList(prev =>
        prev.map(p => p.id === id ? { ...p, nombre: editingNombreValue.trim() } : p)
      );
      setSettingsSuccess('Nombre actualizado correctamente');
    } catch (err: any) {
      setSettingsError(err.message || 'Error al actualizar el nombre');
    } finally {
      setEditingNombreId(null);
    }
  }

  function handleNombreCancel() {
    setEditingNombreId(null);
    setEditingNombreValue('');
  }

  function handleNombreKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === 'Enter') {
      handleNombreSave(id);
    } else if (e.key === 'Escape') {
      handleNombreCancel();
    }
  }

  // Handle editing a programacion from the settings table
  function handleEditProgramacion(prog: Programacion) {
    // Find a factura/gasto from this programacion to use as the base for editing
    const relatedFactura = facturas.find(f => f.programacion_id === prog.id);

    if (!relatedFactura) {
      setSettingsError('No se encontraron registros para esta programación');
      return;
    }

    // Set series editing mode
    setEditingSeriesMode(true);
    setEditingProgramacionId(prog.id);
    setEditingFromSettings(true); // Mark that this edit came from settings

    // Open the appropriate modal based on tipo
    if (prog.tipo === 'INGRESO') {
      setEditingFacturaId(String(relatedFactura.id));
    } else {
      setEditingGastoId(String(relatedFactura.id));
    }

    // Don't close settings panel - let modal overlay on current view
    // setShowSettings(false);
  }

  async function checkExtendableYears() {
    try {
      const response = await programaciones.list();
      const progs = response.data || [];

      // Find programaciones without fecha_fin (can be extended indefinitely)
      const extendable = progs.filter((p: any) => !p.fecha_fin);

      if (extendable.length > 0) {
        const currentYear = new Date().getFullYear();
        // Get max ultimo_ano_generado from all extendable programaciones
        const maxYear = Math.max(
          ...extendable.map((p: any) => p.ultimo_ano_generado || currentYear)
        );

        // If there are programaciones that haven't generated for next year, show option
        const nextYear = maxYear + 1;
        if (nextYear > currentYear) {
          setExtendableYears([nextYear]);
        } else {
          // Show next year option if we're late in the current year
          const currentMonth = new Date().getMonth();
          if (currentMonth >= 10) { // November or December
            setExtendableYears([currentYear + 1]);
          } else {
            setExtendableYears([]);
          }
        }
      } else {
        // No extendable programaciones, clear the list
        setExtendableYears([]);
      }
    } catch (err) {
      console.error('Error checking extendable years:', err);
    }
  }

  // Handle year extension
  async function handleExtendYear(year: number) {
    setIsExtending(true);
    setExtendSuccess(null);

    try {
      // Extend both invoices and expenses
      const [invoiceResult, expenseResult] = await Promise.all([
        invoices.extendYear(year),
        expenses.extendYear(year),
      ]);

      const invoiceCount = invoiceResult.data?.total_created || 0;
      const expenseCount = expenseResult.data?.total_created || 0;
      const total = invoiceCount + expenseCount;

      // Save year to localStorage so it persists even if all invoices are deleted
      // Also preserve all current availableYears
      const currentAvailableYears = availableYears;
      const storedYears: number[] = JSON.parse(localStorage.getItem('facturasCreatedYears') || '[]');
      const allStoredYears = Array.from(new Set([...storedYears, ...currentAvailableYears, year]));
      localStorage.setItem('facturasCreatedYears', JSON.stringify(allStoredYears));

      if (total > 0) {
        setExtendSuccess(`Se han generado ${invoiceCount} facturas y ${expenseCount} gastos para ${year}`);
        await loadFacturas();
      } else {
        setExtendSuccess(`No hay programaciones pendientes de generar para ${year}`);
      }

      // Always ensure all years are preserved including the new one
      setAvailableYears(prev => {
        const merged = Array.from(new Set([...prev, ...currentAvailableYears, year]));
        return merged.sort((a, b) => b - a);
      });
      setSelectedYear(year);

      // Remove year from extendable list
      setExtendableYears(prev => prev.filter(y => y !== year));

      // Reload programaciones to update REGISTROS count in settings panel
      if (showSettings) {
        await loadProgramaciones();
      }

      // Re-check for next extendable years
      await checkExtendableYears();
    } catch (err: any) {
      setError(err.message || 'Error al generar registros para el ano');
    } finally {
      setIsExtending(false);
    }
  }

  // Handle year deletion
  // If deleting the earliest OR latest year (and not current year): removes content AND the year from dropdown
  // If deleting current year or middle years: removes content only, keeps year in dropdown
  async function handleDeleteYear(year: number) {
    setIsDeletingYear(true);
    setExtendSuccess(null);

    const currentCalendarYear = new Date().getFullYear();
    const isEarliestYear = year === Math.min(...availableYears);
    const isLatestYear = year === Math.max(...availableYears.filter(y => y !== currentCalendarYear));
    const isCurrentYear = year === currentCalendarYear;
    // Should remove from dropdown if it's an edge year (earliest or latest) and not the current year
    const shouldRemoveYear = (isEarliestYear || isLatestYear) && !isCurrentYear;

    try {
      // Delete both invoices and expenses for the year
      const [invoiceResult, expenseResult] = await Promise.all([
        invoices.deleteByYear(year),
        expenses.deleteByYear(year),
      ]);

      const invoiceCount = invoiceResult.data?.total_deleted || 0;
      const expenseCount = expenseResult.data?.total_deleted || 0;
      const total = invoiceCount + expenseCount;

      // Remove year from dropdown ONLY if:
      // 1. It's the earliest OR latest year (edge year), AND
      // 2. It's NOT the current calendar year
      if (shouldRemoveYear) {
        const storedYears: number[] = JSON.parse(localStorage.getItem('facturasCreatedYears') || '[]');
        localStorage.setItem('facturasCreatedYears', JSON.stringify(storedYears.filter(y => y !== year)));

        // Also remove from availableYears state
        setAvailableYears(prev => prev.filter(y => y !== year));
      }

      // Success messages
      if (total > 0) {
        if (shouldRemoveYear) {
          setExtendSuccess(`Se han eliminado ${invoiceCount} facturas y ${expenseCount} gastos, y el año ${year} ha sido eliminado`);
        } else {
          setExtendSuccess(`Se han eliminado ${invoiceCount} facturas y ${expenseCount} gastos de ${year}`);
        }
      } else {
        if (shouldRemoveYear) {
          setExtendSuccess(`Año ${year} eliminado`);
        } else {
          setExtendSuccess(`No había registros en ${year}`);
        }
      }

      // Refresh data - loadFacturas will read updated localStorage
      await loadFacturas();

      // Reload programaciones to update REGISTROS count in settings panel
      if (showSettings) {
        await loadProgramaciones();
      }

      // Select next year if we deleted the currently selected edge year
      if (selectedYear === year && shouldRemoveYear) {
        const remainingYears = availableYears.filter(y => y !== year);
        if (remainingYears.length > 0) {
          // If we deleted earliest year, select the new earliest; if latest, select the new latest
          setSelectedYear(isEarliestYear ? Math.min(...remainingYears) : Math.max(...remainingYears));
        } else {
          setSelectedYear(currentCalendarYear);
        }
      }

      // Re-check for extendable years (deleted year might become extendable again)
      await checkExtendableYears();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar registros del año');
    } finally {
      setIsDeletingYear(false);
      setYearToDelete(null);
    }
  }

  // Check for extendable years on initial load
  useEffect(() => {
    if (!loading && facturas.length >= 0) {
      checkExtendableYears();
    }
  }, [loading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('#year-dropdown')) {
        setIsYearDropdownOpen(false);
      }
    }

    if (isYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isYearDropdownOpen]);

  // Check if a factura belongs to a series and get the count
  async function checkSeriesInfo(factura: Factura): Promise<{ belongsToSeries: boolean; count: number }> {
    if (!factura.programacion_id) {
      return { belongsToSeries: false, count: 0 };
    }

    try {
      if (factura.tipo === 'ingreso') {
        const response = await invoices.getProgramacion(factura.id.toString());
        return {
          belongsToSeries: response.data?.pertenece_a_serie || false,
          count: response.data?.total_en_serie || 0
        };
      } else {
        const response = await expenses.getProgramacion(factura.id.toString());
        return {
          belongsToSeries: response.data?.pertenece_a_serie || false,
          count: response.data?.total_en_serie || 0
        };
      }
    } catch (err) {
      console.error('Error checking series info:', err);
      return { belongsToSeries: false, count: 0 };
    }
  }

  async function handleDelete(factura: Factura) {
    // Check if it belongs to a series
    if (factura.programacion_id) {
      const seriesInfo = await checkSeriesInfo(factura);
      if (seriesInfo.belongsToSeries && seriesInfo.count > 1) {
        setBulkActionModal({
          isOpen: true,
          action: 'delete',
          factura,
          seriesCount: seriesInfo.count
        });
        return;
      }
    }
    // Otherwise, use normal delete flow
    setDeletingFactura(factura);
  }

  async function handleEdit(factura: Factura) {
    // Check if it belongs to a series
    if (factura.programacion_id) {
      const seriesInfo = await checkSeriesInfo(factura);
      if (seriesInfo.belongsToSeries && seriesInfo.count > 1) {
        setBulkActionModal({
          isOpen: true,
          action: 'edit',
          factura,
          seriesCount: seriesInfo.count
        });
        return;
      }
    }
    // Otherwise, use normal edit flow
    if (factura.tipo === 'ingreso') {
      setEditingFacturaId(factura.id.toString());
    } else {
      setEditingGastoId(factura.id.toString());
    }
  }

  // Handle upload success from FileViewerModal
  async function handleUploadSuccess(detachedFromSeries: boolean) {
    await loadFacturas();
    if (detachedFromSeries) {
      await loadProgramaciones();
      setEditSuccess('Archivo adjuntado correctamente. El gasto ha sido desvinculado de la serie.');
    } else {
      setEditSuccess('Archivo adjuntado correctamente');
    }
  }

  async function handleBulkActionConfirm(applyToAll: boolean) {
    if (!bulkActionModal.factura) return;

    const factura = bulkActionModal.factura;
    setBulkActionLoading(true);

    try {
      if (bulkActionModal.action === 'delete') {
        // Delete operation
        if (factura.tipo === 'ingreso') {
          await invoices.deleteWithSeries(factura.id.toString(), applyToAll);
        } else {
          await expenses.deleteWithSeries(factura.id.toString(), applyToAll);
        }
        setBulkActionModal({ isOpen: false, action: 'delete', factura: null, seriesCount: 0 });
        await loadFacturas();
        // If deleting whole series, also refresh programaciones and extendable years
        if (applyToAll) {
          await loadProgramaciones();
          await checkExtendableYears();
        }
      } else {
        // Edit operation - close bulk modal and open edit modal
        setBulkActionModal({ isOpen: false, action: 'edit', factura: null, seriesCount: 0 });

        if (applyToAll) {
          // Editing entire series - pass series mode and programacion_id
          setEditingSeriesMode(true);
          setEditingProgramacionId(factura.programacion_id || null);
        } else {
          // Editing single item - use localStorage approach
          setEditingSeriesMode(false);
          setEditingProgramacionId(null);
          localStorage.setItem('editApplyToAll', 'false');
        }

        if (factura.tipo === 'ingreso') {
          setEditingFacturaId(factura.id.toString());
        } else {
          setEditingGastoId(factura.id.toString());
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deletingFactura) return;

    const tipoEliminado = deletingFactura.tipo;
    setIsDeleting(true);
    try {
      if (deletingFactura.tipo === 'ingreso') {
        await invoices.delete(deletingFactura.id.toString());
      } else {
        await expenses.delete(deletingFactura.id.toString());
      }
      setFacturas(facturas.filter((f) => !(f.id === deletingFactura.id && f.tipo === deletingFactura.tipo)));
      setDeletingFactura(null);
      setEditSuccess(tipoEliminado === 'ingreso' ? 'Ingreso eliminado correctamente' : 'Gasto eliminado correctamente');
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function cancelDelete() {
    setDeletingFactura(null);
    setIsDeleting(false);
  }

  async function handleStatusChange(factura: Factura, newStatus: boolean, fecha_pago?: string) {
    try {
      if (factura.tipo === 'ingreso') {
        if (newStatus) {
          // Mark as paid
          await invoices.markPaid(factura.id.toString(), { fecha_pago });
        } else {
          // Mark as pending - clear fecha_pago when reverting to pending
          await invoices.update(factura.id.toString(), { estado: 'PENDIENTE', pagada: false, fecha_pago: null });
        }
      } else {
        // For gastos
        if (newStatus) {
          await expenses.markPaid(factura.id.toString(), { fecha_pago });
        } else {
          await expenses.update(factura.id.toString(), { pagado: false, fecha_pago: null });
        }
      }

      // Reload data
      await loadFacturas();
    } catch (err: any) {
      alert('Error al cambiar estado: ' + err.message);
    }
  }

  const facturasFiltered = facturas.filter((f) => {
    const date = f.fecha_pago || f.fecha_cobro || f.fecha_emision;
    const yearMatch = new Date(date).getFullYear() === selectedYear;

    // Apply tipo filter
    const tipoMatch = filters.tipo === 'todos' || f.tipo === filters.tipo;

    // Apply estado filter
    let estadoMatch = true;
    if (filters.estado !== 'todos') {
      const isPaid = f.tipo === 'ingreso' ? f.pagada : f.pagado;
      estadoMatch = filters.estado === 'pagada' ? isPaid === true : isPaid === false;
    }

    return yearMatch && tipoMatch && estadoMatch;
  });

  // Group facturas by month based on fecha_pago if available, otherwise fecha_emision
  const getMonthKey = (factura: Factura): string => {
    const date = factura.fecha_pago || factura.fecha_cobro || factura.fecha_emision;
    const parsedDate = new Date(date);
    const month = parsedDate.getUTCMonth(); // 0-11
    const year = parsedDate.getUTCFullYear();
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  const getMonthName = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month), 1);
    const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
    // Capitalize first letter
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  // Group facturas by month
  const facturasByMonth = facturasFiltered.reduce((acc, factura) => {
    const monthKey = getMonthKey(factura);
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(factura);
    return acc;
  }, {} as Record<string, Factura[]>);

  // Sort facturas within each month by date (earliest to latest)
  Object.keys(facturasByMonth).forEach((monthKey) => {
    facturasByMonth[monthKey].sort((a, b) => {
      const dateA = new Date(a.fecha_pago || a.fecha_cobro || a.fecha_emision).getTime();
      const dateB = new Date(b.fecha_pago || b.fecha_cobro || b.fecha_emision).getTime();
      return dateA - dateB;
    });
  });

  // Sort months in ascending order (earliest to latest)
  const sortedMonths = Object.keys(facturasByMonth).sort((a, b) => a.localeCompare(b));

  // Check if a month is in the past (all its invoices have payment dates before today)
  const isMonthPast = (monthKey: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month] = monthKey.split('-').map(Number);
    // A month is considered "past" if it's before the current month
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    return year < currentYear || (year === currentYear && month < currentMonth);
  };

  // Initialize collapsed months when year changes or on first render (collapse past months by default)
  useEffect(() => {
    const pastMonths = sortedMonths.filter(isMonthPast);
    setCollapsedMonths(new Set(pastMonths));
  }, [selectedYear, sortedMonths.join(',')]);

  // Toggle month collapse state
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

  // Collapse all months
  const collapseAllMonths = () => {
    setCollapsedMonths(new Set(sortedMonths));
  };

  // Expand all months
  const expandAllMonths = () => {
    setCollapsedMonths(new Set());
  };

  const totalIngresos = facturasFiltered
    .filter((f) => f.tipo === 'ingreso')
    .reduce((sum, f) => sum + (parseFloat(f.base_imponible?.toString() || '0') || 0), 0);

  const totalGastos = facturasFiltered
    .filter((f) => f.tipo === 'gasto')
    .reduce((sum, f) => sum + (parseFloat(f.base_imponible?.toString() || '0') || 0), 0);

  const balance = totalIngresos - totalGastos;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Settings toasts using Toast component for consistency */}
      {settingsError && (
        <Toast message={settingsError} type="error" onClose={() => setSettingsError('')} />
      )}

      {settingsSuccess && (
        <Toast message={settingsSuccess} type="success" onClose={() => setSettingsSuccess(null)} />
      )}

      {error && (
        <Toast message={error} type="error" onClose={() => setError('')} />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando facturas...</p>
          </div>
        )}

        {extendSuccess && (
          <Toast message={extendSuccess} type="success" onClose={() => setExtendSuccess(null)} />
        )}

        {editSuccess && (
          <Toast message={editSuccess} type="success" onClose={() => setEditSuccess(null)} />
        )}

        {/* Year selector and action buttons */}
        {!loading && (
        <div className="mb-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center px-5 py-3">
            <div className="flex items-center gap-3">
              {/* Year selector custom dropdown */}
              <div className="flex items-center">
                <div className="relative" id="year-dropdown">
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
                    <div className="absolute z-50 mt-1 w-full min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="py-1">
                        {availableYears.slice().reverse().map((year) => (
                          <div
                            key={year}
                            className={`flex items-center justify-between px-3 py-2 text-sm font-medium transition-all ${
                              year === selectedYear
                                ? 'bg-slate-100 text-slate-900 border-l-3 border-slate-600'
                                : year === new Date().getFullYear()
                                  ? 'bg-blue-50/50 text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                                  : 'text-slate-700 hover:bg-slate-50 border-l-3 border-transparent'
                            }`}
                          >
                            <button
                              onClick={() => {
                                setSelectedYear(year);
                                setIsYearDropdownOpen(false);
                              }}
                              className="flex-1 text-left"
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
                            {/* Delete button for all years */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setYearToDelete(year);
                                setIsYearDropdownOpen(false);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title={
                                year === new Date().getFullYear()
                                  ? `Vaciar contenido de ${year} (año actual)`
                                  : year === Math.min(...availableYears)
                                    ? `Eliminar año ${year}`
                                    : `Vaciar contenido de ${year}`
                              }
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        {/* Extendable years (future years with programaciones) */}
                        {extendableYears.filter(year => !availableYears.includes(year)).length > 0 && (
                          <>
                            <div className="border-t border-slate-200 my-1"></div>
                            {extendableYears.filter(year => !availableYears.includes(year)).map((year) => (
                              <button
                                key={`extend-${year}`}
                                onClick={() => {
                                  handleExtendYear(year);
                                  setIsYearDropdownOpen(false);
                                }}
                                disabled={isExtending}
                                className="w-full text-left px-3 py-2 text-sm font-medium transition-all text-slate-700 hover:bg-slate-50 border-l-3 border-transparent hover:border-l-3 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {isExtending ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Generando...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {year}
                                  </>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Control Icons Group */}
              <div className="flex items-center gap-1 ml-6">
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
                  </button>

                  {/* Filter dropdown */}
                  {showFilters && (
                    <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 z-50 min-w-[220px] overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Filtros</h3>
                      </div>

                      <div className="p-2.5 space-y-3">
                        {/* Tipo filter */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1.5">Tipo de registro</label>
                          <div className="space-y-1">
                            {['todos', 'ingreso', 'gasto'].map((tipo) => (
                              <label key={tipo} className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                filters.tipo === tipo
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}>
                                <input
                                  type="radio"
                                  name="tipo"
                                  value={tipo}
                                  checked={filters.tipo === tipo}
                                  onChange={(e) => setFilters({ ...filters, tipo: e.target.value as any })}
                                  className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                                />
                                <span className={`text-xs font-medium ${
                                  filters.tipo === tipo ? 'text-blue-700' : 'text-slate-700'
                                }`}>
                                  {tipo === 'todos' ? 'Todos' : tipo === 'ingreso' ? 'Ingresos' : 'Gastos'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-200"></div>

                        {/* Estado filter */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1.5">Estado de pago</label>
                          <div className="space-y-1">
                            {['todos', 'pagada', 'pendiente'].map((estado) => (
                              <label key={estado} className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded transition-all ${
                                filters.estado === estado
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}>
                                <input
                                  type="radio"
                                  name="estado"
                                  value={estado}
                                  checked={filters.estado === estado}
                                  onChange={(e) => setFilters({ ...filters, estado: e.target.value as any })}
                                  className="w-3 h-3 text-blue-600 focus:ring-1 focus:ring-blue-500"
                                />
                                <span className={`text-xs font-medium ${
                                  filters.estado === estado ? 'text-blue-700' : 'text-slate-700'
                                }`}>
                                  {estado === 'todos' ? 'Todos' : estado === 'pagada' ? 'Pagados/Cobrados' : 'Pendientes'}
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

            <div className="flex gap-2">
              <button
                onClick={handleNuevoIngreso}
                className="px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nuevo Ingreso
              </button>
              <button
                onClick={() => setIsGastoModalOpen(true)}
                className="px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nuevo Gasto
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md transition-colors flex items-center justify-center ${
                  showSettings
                    ? 'bg-slate-200 text-slate-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Configuración de Facturas"
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

        {/* Settings Panel - shown inline below control panel */}
        {!loading && showSettings && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            {/* Billing Configurations */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Datos de Facturación</h2>
                <div className="flex items-center gap-4">
                  {/* Show inactive configs toggle */}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInactiveBillingConfigs}
                      onChange={(e) => setShowInactiveBillingConfigs(e.target.checked)}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Mostrar inactivos</span>
                  </label>
                  <button
                    onClick={() => setIsNewBillingConfigModalOpen(true)}
                    className="w-52 px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Nueva Configuración
                  </button>
                </div>
              </div>

              {loadingBillingConfigs ? (
                <div className="bg-white rounded-lg shadow text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando configuraciones...</p>
                </div>
              ) : (() => {
                // Filter billing configs based on toggle
                const filteredBillingConfigs = showInactiveBillingConfigs
                  ? billingConfigsList
                  : billingConfigsList.filter(c => c.activo);

                return billingConfigsList.length === 0 ? (
                <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
                  <p className="mb-4">No tienes configuraciones de facturación</p>
                  <button
                    onClick={() => setIsNewBillingConfigModalOpen(true)}
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Crear primera configuración
                  </button>
                </div>
              ) : filteredBillingConfigs.length === 0 ? (
                <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
                  <p className="mb-4">No hay configuraciones activas</p>
                  <p className="text-sm">Activa el filtro "Mostrar inactivos" para ver todas las configuraciones</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            NIF/CIF
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dirección
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IBAN
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredBillingConfigs.map((config) => (
                          <tr key={config.id} className="hover:bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                {config.logo_url ? (
                                  <img
                                    src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/uploads/${config.logo_url}`}
                                    alt={config.razon_social}
                                    className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200"
                                  />
                                ) : (
                                  <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm ${getInitialsColor(config.razon_social)}`}
                                  >
                                    {getInitials(config.razon_social)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">
                              <div className="font-medium">{config.razon_social}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center font-mono">
                              {config.nif || <span className="text-gray-400 italic text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="text-xs">
                                {config.direccion && <div>{config.direccion}</div>}
                                {(config.codigo_postal || config.ciudad || config.provincia) && (
                                  <div className="text-gray-500">
                                    {[config.codigo_postal, config.ciudad, config.provincia]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                )}
                                {!config.direccion && !config.ciudad && (
                                  <span className="text-gray-400 italic">Sin dirección</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {config.email_facturacion || <span className="text-gray-400 italic text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center font-mono">
                              {config.iban ? (
                                <span className="text-xs">
                                  {config.iban.substring(0, 4)}...{config.iban.substring(config.iban.length - 4)}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-xs">Sin IBAN</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleToggleBillingConfig(config)}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all hover:shadow-md ${
                                  config.activo
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                                title={`Clic para ${config.activo ? 'desactivar' : 'activar'}`}
                              >
                                {config.activo ? 'Activa' : 'Inactiva'}
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                              <button
                                onClick={() => setEditingBillingConfigId(config.id)}
                                className="text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center"
                                title="Editar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingBillingConfig(config)}
                                className={`inline-flex items-center ${
                                  config.activo && billingConfigsList.length === 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-red-600 hover:text-red-900'
                                }`}
                                title={config.activo && billingConfigsList.length === 1 ? 'No se puede eliminar la única configuración activa' : 'Eliminar'}
                                disabled={config.activo && billingConfigsList.length === 1}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
              })()}
            </div>

            {/* Client Management */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Mis Clientes</h2>
                <div className="flex items-center gap-4">
                  {/* Show inactive clients toggle */}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInactiveClients}
                      onChange={(e) => setShowInactiveClients(e.target.checked)}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Mostrar inactivos</span>
                  </label>
                  <button
                    onClick={() => setIsClienteModalOpen(true)}
                    className="w-52 px-4 py-2 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Nuevo Cliente
                  </button>
                </div>
              </div>

              {loadingClients ? (
                <div className="bg-white rounded-lg shadow text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando clientes...</p>
                </div>
              ) : clientsList.length === 0 ? (
                <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
                  <p className="mb-4">No tienes clientes registrados</p>
                  <button
                    onClick={() => setIsClienteModalOpen(true)}
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Crear primer cliente
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CIF / NIF
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dirección
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Teléfono
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {clientsList.map((client) => (
                          <tr key={client.id} className="hover:bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">
                              <div className="font-medium">{client.razon_social}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {client.cif}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="text-xs">
                                {client.direccion && <div>{client.direccion}</div>}
                                {(client.codigo_postal || client.ciudad || client.provincia) && (
                                  <div className="text-gray-500">
                                    {[client.codigo_postal, client.ciudad, client.provincia]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {client.telefono || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {client.email}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <div className="flex gap-2 justify-center">
                                {client.es_cliente_principal ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                    ⭐ Principal
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => toggleClientStatus(client)}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all hover:shadow-md ${
                                      client.activo
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    }`}
                                    title={`Clic para ${client.activo ? 'desactivar' : 'activar'}`}
                                  >
                                    {client.activo ? 'Activo' : 'Inactivo'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                              <button
                                onClick={() => setEditingClienteId(client.id)}
                                className="text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center"
                                title="Editar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingClient(client)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                title="Eliminar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Programaciones Management */}
            {programacionesList.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3 text-gray-900">Programaciones Recurrentes</h2>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Frecuencia
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha Inicio
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha Fin
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Base
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registros
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {programacionesList.map((prog) => (
                          <tr key={prog.id} className="hover:bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                prog.tipo === 'INGRESO'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {prog.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-900 text-center">
                              {editingNombreId === prog.id ? (
                                <input
                                  type="text"
                                  value={editingNombreValue}
                                  onChange={(e) => setEditingNombreValue(e.target.value)}
                                  onBlur={() => handleNombreSave(prog.id)}
                                  onKeyDown={(e) => handleNombreKeyDown(e, prog.id)}
                                  className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  className="font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                  onDoubleClick={() => handleNombreDoubleClick(prog)}
                                  title="Doble clic para editar"
                                >
                                  {prog.nombre || prog.datos_base?.concepto || 'Sin nombre'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-900 text-center">
                              <div className="leading-tight">
                                <div className="capitalize">
                                  {prog.frecuencia_descripcion
                                    ? prog.frecuencia_descripcion.split(',')[0].toLowerCase().replace(/_/g, ' ')
                                    : prog.periodicidad.toLowerCase().replace(/_/g, ' ')}
                                </div>
                                <div className="capitalize text-gray-600">
                                  {prog.frecuencia_descripcion
                                    ? prog.frecuencia_descripcion.split(',')[1]?.trim().toLowerCase().replace(/_/g, ' ')
                                    : prog.tipo_dia.toLowerCase().replace(/_/g, ' ')}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {formatDateShort(prog.fecha_inicio)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {prog.fecha_fin ? formatDateShort(prog.fecha_fin) : (
                                <span className="text-blue-600 text-xs">Indefinido</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              {formatEuro(prog.datos_base?.base_imponible || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                              <div>
                                {Number(prog.total_ingresos || 0) + Number(prog.total_gastos || 0)}
                              </div>
                              {prog.ultimo_ano_generado && (
                                <div className="text-xs text-gray-500">hasta {prog.ultimo_ano_generado}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                              {(prog.contrato_datos_extraidos as any)?.archivo_url && (
                                <button
                                  onClick={() => setViewingContract({
                                    programacionId: prog.id,
                                    nombre: (prog.contrato_datos_extraidos as any).archivo_nombre || prog.nombre || 'Contrato'
                                  })}
                                  className="text-green-600 hover:text-green-900 mr-3 inline-flex items-center"
                                  title="Ver contrato"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => handleEditProgramacion(prog)}
                                className="text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center"
                                title="Editar programación"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setProgramacionToDelete(prog)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                title="Eliminar programación"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary cards - hidden when settings are shown */}
        {!loading && !showSettings && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Ingresos {selectedYear}</div>
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
                <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Gastos {selectedYear}</div>
                <div className="text-xl font-bold text-red-700">-{formatEuro(totalGastos)}</div>
              </div>
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`rounded-lg border px-4 py-3 ${
            balance >= 0
              ? 'bg-gradient-to-br from-blue-50 to-white border-blue-100'
              : 'bg-gradient-to-br from-orange-50 to-white border-orange-100'
          }`}>
            <div>
              <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                balance >= 0 ? 'text-blue-700' : 'text-orange-700'
              }`}>Balance {selectedYear}</div>
              <div className={`text-xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {balance >= 0 ? '+' : ''}{formatEuro(balance)}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Facturas table - hidden when settings are shown */}
        {!loading && !showSettings && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {facturasFiltered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay facturas para el año {selectedYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>F.</div>
                    <div>Emisión</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>F.Pago/</div>
                    <div>F.Cobro</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>Número/</div>
                    <div>Concepto</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente / Proveedor
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IVA
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IRPF
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {sortedMonths.map((monthKey) => (
                  <Fragment key={monthKey}>
                    {/* Month header - clickable to collapse/expand */}
                    <tr
                      key={`month-${monthKey}`}
                      className="bg-blue-50 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => toggleMonthCollapse(monthKey)}
                    >
                      <td colSpan={11} className="px-4 py-1.5 text-left font-bold text-blue-900 text-base">
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
                                {facturasByMonth[monthKey].length} {facturasByMonth[monthKey].length === 1 ? 'Factura' : 'Facturas'}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const monthIngresos = facturasByMonth[monthKey].filter(f => f.tipo === 'ingreso').reduce((sum, f) => sum + (parseFloat(f.base_imponible?.toString() || '0') || 0), 0);
                            const monthGastos = facturasByMonth[monthKey].filter(f => f.tipo === 'gasto').reduce((sum, f) => sum + (parseFloat(f.base_imponible?.toString() || '0') || 0), 0);
                            const monthBalance = monthIngresos - monthGastos;
                            return (
                              <div className="flex items-center gap-3 text-xs font-medium">
                                <span className="text-green-700">+{formatEuro(monthIngresos)}</span>
                                <span className="text-red-600">-{formatEuro(monthGastos)}</span>
                                <span className={monthBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}>
                                  = {monthBalance >= 0 ? '+' : ''}{formatEuro(monthBalance)}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                    {/* Facturas for this month - only show if not collapsed */}
                    {!collapsedMonths.has(monthKey) && facturasByMonth[monthKey].map((factura) => (
                  <tr key={`${factura.tipo}-${factura.id}`} className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          factura.tipo === 'ingreso'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <span>{factura.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
                        {factura.programacion_id && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Generado automaticamente">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                      {formatDayMonth(factura.fecha_emision)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                      {factura.fecha_pago ? (
                        <span className="text-gray-900">{formatDayMonth(factura.fecha_pago)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {factura.tipo === 'ingreso' ? (
                        <div>
                          <div className="font-medium">{factura.numero_factura}</div>
                          <div className="text-gray-500 text-xs">{factura.concepto}</div>
                        </div>
                      ) : (
                        <div className="text-xs">{factura.concepto}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {factura.tipo === 'ingreso' ? factura.cliente?.razon_social || '-' : factura.proveedor || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-medium">
                      <span className={factura.tipo === 'ingreso' ? 'text-gray-900' : 'text-red-600'}>
                        {factura.tipo === 'ingreso' ? '+' : '-'}{formatEuro(factura.base_imponible)}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right">
                      <span className={factura.tipo === 'ingreso' ? 'text-gray-600' : 'text-red-600'}>
                        {factura.tipo === 'ingreso' ? '+' : '-'}{formatEuro(factura.cuota_iva)}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right">
                      {factura.cuota_irpf && parseFloat(factura.cuota_irpf.toString()) > 0 ? (
                        <span className={factura.tipo === 'ingreso' ? 'text-red-600' : 'text-gray-900'}>
                          {factura.tipo === 'ingreso' ? '-' : '+'}{formatEuro(factura.cuota_irpf)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-right">
                      <span className={factura.tipo === 'ingreso' ? 'text-gray-900' : 'text-red-600'}>
                        {factura.tipo === 'ingreso' ? '+' : '-'}{formatEuro(factura.total_factura)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <StatusToggle
                        currentStatus={
                          factura.tipo === 'ingreso'
                            ? factura.estado === 'PAGADA' || factura.pagada === true
                            : factura.pagado === true
                        }
                        onChange={(newStatus, fecha_pago) =>
                          handleStatusChange(factura, newStatus, fecha_pago)
                        }
                        type={factura.tipo}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {/* PDF icon for invoices */}
                      {factura.tipo === 'ingreso' && factura.pdf_generado && (
                        <button
                          onClick={() => setPdfModalInvoiceId(factura.id.toString())}
                          className="text-green-600 hover:text-green-900 mr-3 inline-flex items-center"
                          title="Ver PDF"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                      {/* File attachment icon for expenses */}
                      {factura.tipo === 'gasto' && factura.archivo_url && (
                        <button
                          onClick={() => setViewingFileExpense({ id: factura.id.toString(), concepto: factura.concepto })}
                          className="text-green-600 hover:text-green-900 mr-3 inline-flex items-center"
                          title="Ver documento adjunto"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                      {/* Quick upload button for expenses without attached files */}
                      {factura.tipo === 'gasto' && !factura.archivo_url && (
                        <button
                          onClick={() => setUploadingExpense({
                            id: factura.id.toString(),
                            concepto: factura.concepto,
                            belongsToSeries: !!factura.programacion_id
                          })}
                          className="mr-3 inline-flex items-center text-gray-400 hover:text-green-600"
                          title="Adjuntar factura"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(factura)}
                        className="text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(factura)}
                        disabled={factura.tipo === 'ingreso' ? (factura.estado === 'PAGADA' || factura.pagada === true) : factura.pagado === true}
                        className={`inline-flex items-center ${
                          (factura.tipo === 'ingreso' ? (factura.estado === 'PAGADA' || factura.pagada === true) : factura.pagado === true)
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-900'
                        }`}
                        title={(factura.tipo === 'ingreso' ? (factura.estado === 'PAGADA' || factura.pagada === true) : factura.pagado === true) ? 'No se puede eliminar un registro pagado' : 'Eliminar'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        )}
      </main>

      {/* PDF Viewer Modal */}
      {pdfModalInvoiceId && (
        <PDFViewerModal
          invoiceId={pdfModalInvoiceId}
          onClose={() => setPdfModalInvoiceId(null)}
        />
      )}

      {/* File Viewer Modal for expense attachments (view mode) */}
      {viewingFileExpense && (
        <FileViewerModal
          expenseId={viewingFileExpense.id}
          title={viewingFileExpense.concepto}
          onClose={() => setViewingFileExpense(null)}
        />
      )}

      {/* File Viewer Modal for uploading (upload mode) */}
      {uploadingExpense && (
        <FileViewerModal
          expenseId={uploadingExpense.id}
          title={uploadingExpense.concepto}
          mode="upload"
          belongsToSeries={uploadingExpense.belongsToSeries}
          onClose={() => setUploadingExpense(null)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* Contract Viewer Modal */}
      {viewingContract && (
        <ContractViewerModal
          programacionId={viewingContract.programacionId}
          contractName={viewingContract.nombre}
          onClose={() => setViewingContract(null)}
        />
      )}

      {/* Nueva Factura Modal */}
      <NuevaFacturaModal
        isOpen={isFacturaModalOpen}
        onClose={() => setIsFacturaModalOpen(false)}
        onSuccess={(invoiceId, fechaEmision) => {
          loadFacturas();
          loadProgramaciones();
          checkExtendableYears();
          setEditSuccess('Ingreso creado correctamente');
          // Show PDF modal if fecha_emision is today
          if (invoiceId && fechaEmision) {
            const today = new Date().toISOString().split('T')[0];
            if (fechaEmision === today) {
              setPdfModalInvoiceId(invoiceId);
            }
          }
        }}
        onOpenSettings={() => {
          setShowSettings(true);
          setIsNewBillingConfigModalOpen(true);
        }}
      />

      {/* Nuevo Gasto Modal */}
      <NuevoGastoModal
        isOpen={isGastoModalOpen}
        onClose={() => setIsGastoModalOpen(false)}
        onSuccess={() => {
          loadFacturas();
          loadProgramaciones();
          checkExtendableYears();
          setEditSuccess('Gasto creado correctamente');
        }}
      />

      {/* Editar Gasto Modal */}
      <EditarGastoModal
        isOpen={!!editingGastoId}
        gastoId={editingGastoId}
        onClose={() => {
          setEditingGastoId(null);
          setEditingSeriesMode(false);
          setEditingProgramacionId(null);
          setEditingFromSettings(false);
        }}
        onSuccess={() => {
          loadFacturas();
          setEditSuccess(editingSeriesMode ? 'Serie de gastos actualizada correctamente' : 'Gasto actualizado correctamente');
          // If editing series from settings, reload programaciones (settings panel stays open)
          if (editingFromSettings) {
            loadProgramaciones();
          }
          setEditingSeriesMode(false);
          setEditingProgramacionId(null);
          setEditingFromSettings(false);
        }}
        editingSeriesMode={editingSeriesMode}
        programacionId={editingProgramacionId}
      />

      {/* Editar Factura Modal */}
      <EditarFacturaModal
        isOpen={!!editingFacturaId}
        facturaId={editingFacturaId}
        onClose={() => {
          setEditingFacturaId(null);
          setEditingSeriesMode(false);
          setEditingProgramacionId(null);
          setEditingFromSettings(false);
        }}
        onSuccess={() => {
          loadFacturas();
          setEditSuccess(editingSeriesMode ? 'Serie de ingresos actualizada correctamente' : 'Ingreso actualizado correctamente');
          // If editing series from settings, reload programaciones (settings panel stays open)
          if (editingFromSettings) {
            loadProgramaciones();
          }
          setEditingSeriesMode(false);
          setEditingProgramacionId(null);
          setEditingFromSettings(false);
        }}
        editingSeriesMode={editingSeriesMode}
        programacionId={editingProgramacionId}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingFactura}
        title="Confirmar eliminación"
        message={
          deletingFactura
            ? deletingFactura.tipo === 'ingreso'
              ? `¿Estás seguro de eliminar la factura de ingreso "${deletingFactura.numero_factura}"? Esta acción no se puede deshacer.`
              : `¿Estás seguro de eliminar el gasto "${deletingFactura.concepto}"? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isDeleting={isDeleting}
      />

      {/* Bulk Action Modal (for scheduled series) */}
      <ConfirmBulkActionModal
        isOpen={bulkActionModal.isOpen}
        onClose={() => setBulkActionModal({ isOpen: false, action: 'delete', factura: null, seriesCount: 0 })}
        onConfirm={handleBulkActionConfirm}
        action={bulkActionModal.action}
        tipo={bulkActionModal.factura?.tipo === 'ingreso' ? 'INGRESO' : 'GASTO'}
        seriesCount={bulkActionModal.seriesCount}
        loading={bulkActionLoading}
      />

      {/* Nuevo Cliente Modal */}
      <NuevoClienteModal
        isOpen={isClienteModalOpen}
        onClose={() => setIsClienteModalOpen(false)}
        onSuccess={() => {
          loadClients(showInactiveClients);
          setEditSuccess('Cliente creado correctamente');
        }}
      />

      {/* Editar Cliente Modal */}
      <EditarClienteModal
        isOpen={!!editingClienteId}
        clientId={editingClienteId}
        onClose={() => setEditingClienteId(null)}
        onSuccess={() => {
          loadClients(showInactiveClients);
          setEditSuccess('Cliente actualizado correctamente');
        }}
      />

      {/* Nueva Datos Facturación Modal */}
      <NuevaDatosFacturacionModal
        isOpen={isNewBillingConfigModalOpen}
        onClose={() => setIsNewBillingConfigModalOpen(false)}
        onSuccess={() => {
          loadBillingConfigs();
          setEditSuccess('Configuración creada correctamente');
        }}
      />

      {/* Editar Datos Facturación Modal */}
      <EditarDatosFacturacionModal
        isOpen={!!editingBillingConfigId}
        configId={editingBillingConfigId}
        onClose={() => setEditingBillingConfigId(null)}
        onSuccess={() => {
          loadBillingConfigs();
          setEditSuccess('Configuración actualizada correctamente');
        }}
      />

      {/* Delete Billing Config Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingBillingConfig}
        title="Eliminar configuración de facturación"
        message={
          deletingBillingConfig
            ? `¿Estás seguro de eliminar la configuración "${deletingBillingConfig.razon_social}"? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDeleteBillingConfig}
        onCancel={cancelDeleteBillingConfig}
        isDeleting={isDeletingBillingConfig}
      />

      {/* No Billing Config Warning Modal */}
      {showNoBillingConfigWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Configuración de Facturación Requerida</h3>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  {billingConfigsList.length === 0 ? (
                    <>
                      <p className="text-gray-600">
                        Para crear un nuevo ingreso, primero debes configurar tus datos de facturación (razón social, dirección, IBAN, etc.).
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Estos datos aparecerán en tus facturas emitidas.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600">
                        Para crear un nuevo ingreso, debes tener una configuración de facturación activa.
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Tienes {billingConfigsList.length} configuración{billingConfigsList.length > 1 ? 'es' : ''} pero ninguna está activa. Activa una configuración para poder emitir facturas.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNoBillingConfigWarning(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowNoBillingConfigWarning(false);
                  setShowSettings(true);
                  if (billingConfigsList.length === 0) {
                    setIsNewBillingConfigModalOpen(true);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {billingConfigsList.length === 0 ? 'Crear Configuración' : 'Ir a Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Year Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!yearToDelete}
        title={
          yearToDelete === new Date().getFullYear()
            ? `Vaciar año ${yearToDelete}`
            : yearToDelete === Math.min(...availableYears)
              ? `Eliminar año ${yearToDelete}`
              : `Vaciar año ${yearToDelete}`
        }
        message={
          yearToDelete === new Date().getFullYear()
            ? `¿Estás seguro de eliminar todas las facturas y gastos del año ${yearToDelete}? El año permanecerá en el listado ya que es el año actual. Esta acción no se puede deshacer.`
            : yearToDelete === Math.min(...availableYears)
              ? `¿Estás seguro de eliminar todas las facturas y gastos del año ${yearToDelete}? El año también será eliminado del listado. Esta acción no se puede deshacer.`
              : `¿Estás seguro de eliminar todas las facturas y gastos del año ${yearToDelete}? El año permanecerá en el listado (vacío). Esta acción no se puede deshacer.`
        }
        onConfirm={() => yearToDelete && handleDeleteYear(yearToDelete)}
        onCancel={() => setYearToDelete(null)}
        isDeleting={isDeletingYear}
      />

      {/* Delete Programacion Modal */}
      {programacionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Eliminar Programación</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 mb-4">
                ¿Qué deseas hacer con la programación <strong>"{programacionToDelete.nombre || programacionToDelete.datos_base?.concepto}"</strong>?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Esta programación tiene {(programacionToDelete.total_ingresos || 0) + (programacionToDelete.total_gastos || 0)} registro(s) asociado(s).
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleDeleteProgramacion(false)}
                  disabled={isDeletingProgramacion}
                  className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">Solo eliminar programación</div>
                  <div className="text-sm text-gray-500">Los registros existentes se conservarán</div>
                </button>
                <button
                  onClick={() => handleDeleteProgramacion(true)}
                  disabled={isDeletingProgramacion}
                  className="w-full px-4 py-3 text-left border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-red-700">Eliminar programación y registros</div>
                  <div className="text-sm text-red-500">Se eliminarán todos los registros asociados</div>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setProgramacionToDelete(null)}
                disabled={isDeletingProgramacion}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
            {isDeletingProgramacion && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingClient}
        title="Confirmar eliminación"
        message={
          deletingClient
            ? `¿Estás seguro de eliminar el cliente "${deletingClient.razon_social}"? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDeleteClient}
        onCancel={cancelDeleteClient}
        isDeleting={isDeletingClient}
      />
    </div>
  );
}

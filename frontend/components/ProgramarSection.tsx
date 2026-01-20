'use client';

import { useState, useEffect, useCallback } from 'react';
import { programaciones } from '@/lib/api';

// How often records are generated
type Periodicidad = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

// Which day of the period to use
type TipoDia =
  | 'ULTIMO_DIA_LABORAL'   // Last business day of the month
  | 'PRIMER_DIA_LABORAL'   // First business day of the month
  | 'ULTIMO_DIA'           // Last day of the month
  | 'PRIMER_DIA'           // First day of the month
  | 'DIA_ESPECIFICO';      // Specific day (e.g., 15th)

interface ProgramarConfig {
  periodicidad: Periodicidad;
  tipoDia: TipoDia;
  diaEspecifico: number;
  fechaInicio: string;
  fechaFin: string | null;
  sinFechaFin: boolean;
}

interface ProgramarSectionProps {
  tipo: 'INGRESO' | 'GASTO';
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  config: ProgramarConfig;
  onConfigChange: (config: ProgramarConfig) => void;
  onPreviewChange?: (count: number) => void;
  disabled?: boolean; // When true, prevents toggling off (for series editing)
}

const PERIODICIDAD_OPTIONS: { value: Periodicidad; label: string }[] = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'ANUAL', label: 'Anual' },
];

const TIPO_DIA_OPTIONS: { value: TipoDia; label: string }[] = [
  { value: 'ULTIMO_DIA_LABORAL', label: 'Ultimo dia laboral' },
  { value: 'PRIMER_DIA_LABORAL', label: 'Primer dia laboral' },
  { value: 'ULTIMO_DIA', label: 'Ultimo dia del mes' },
  { value: 'PRIMER_DIA', label: 'Primer dia del mes' },
  { value: 'DIA_ESPECIFICO', label: 'Dia especifico' },
];

export default function ProgramarSection({
  tipo,
  enabled,
  onEnabledChange,
  config,
  onConfigChange,
  onPreviewChange,
  disabled = false,
}: ProgramarSectionProps) {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const tipoLabel = tipo === 'INGRESO' ? 'ingreso' : 'gasto';

  // Fetch preview count when config changes
  const fetchPreview = useCallback(async () => {
    if (!enabled) {
      setPreviewCount(null);
      onPreviewChange?.(0);
      return;
    }

    // Validate dates
    if (!config.fechaInicio) {
      setPreviewCount(null);
      setPreviewError(null);
      return;
    }

    // For non-sinFechaFin, require fechaFin
    if (!config.sinFechaFin && !config.fechaFin) {
      setPreviewCount(null);
      setPreviewError(null);
      return;
    }

    // For DIA_ESPECIFICO, require valid day
    if (config.tipoDia === 'DIA_ESPECIFICO' && (!config.diaEspecifico || config.diaEspecifico < 1 || config.diaEspecifico > 31)) {
      setPreviewError('Ingresa un dia valido (1-31)');
      setPreviewCount(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await programaciones.preview({
        periodicidad: config.periodicidad,
        tipo_dia: config.tipoDia,
        dia_especifico: config.tipoDia === 'DIA_ESPECIFICO' ? config.diaEspecifico : undefined,
        fecha_inicio: config.fechaInicio,
        fecha_fin: config.sinFechaFin ? null : config.fechaFin,
      });

      const count = response.data?.total || 0;
      setPreviewCount(count);
      onPreviewChange?.(count);
    } catch (err: any) {
      setPreviewError(err.message || 'Error al calcular fechas');
      setPreviewCount(null);
      onPreviewChange?.(0);
    } finally {
      setPreviewLoading(false);
    }
  }, [enabled, config, onPreviewChange]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchPreview();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchPreview]);

  function handleToggle() {
    onEnabledChange(!enabled);
  }

  function handlePeriodicidadChange(value: Periodicidad) {
    onConfigChange({ ...config, periodicidad: value });
  }

  function handleTipoDiaChange(value: TipoDia) {
    onConfigChange({ ...config, tipoDia: value });
  }

  function handleDiaEspecificoChange(value: number) {
    onConfigChange({ ...config, diaEspecifico: value });
  }

  function handleFechaInicioChange(value: string) {
    onConfigChange({ ...config, fechaInicio: value });
  }

  function handleFechaFinChange(value: string) {
    onConfigChange({ ...config, fechaFin: value });
  }

  function handleSinFechaFinChange(checked: boolean) {
    onConfigChange({ ...config, sinFechaFin: checked, fechaFin: checked ? null : config.fechaFin });
  }

  // Generate schedule description
  function getScheduleDescription(): string {
    const periodicidadDesc: Record<Periodicidad, string> = {
      'MENSUAL': 'cada mes',
      'TRIMESTRAL': 'cada trimestre',
      'SEMESTRAL': 'cada semestre',
      'ANUAL': 'cada ano',
    };

    const tipoDiaDesc: Record<TipoDia, string> = {
      'ULTIMO_DIA_LABORAL': 'el ultimo dia laboral',
      'PRIMER_DIA_LABORAL': 'el primer dia laboral',
      'ULTIMO_DIA': 'el ultimo dia',
      'PRIMER_DIA': 'el primer dia',
      'DIA_ESPECIFICO': `el dia ${config.diaEspecifico || '?'}`,
    };

    return `${tipoDiaDesc[config.tipoDia]} de ${periodicidadDesc[config.periodicidad]}`;
  }

  return (
    <div className="border-t border-slate-200 pt-4 mb-4">
      {/* Toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">Repetir</h3>
        <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-400 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
          <span className="ms-2 text-xs font-medium text-slate-700">
            Repetir este {tipoLabel} {disabled && '(obligatorio en serie)'}
          </span>
        </label>
      </div>

      {enabled && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            {/* Periodicidad */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Periodicidad *</label>
              <select
                value={config.periodicidad}
                onChange={(e) => handlePeriodicidadChange(e.target.value as Periodicidad)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              >
                {PERIODICIDAD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de dia */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dia de generacion *</label>
              <select
                value={config.tipoDia}
                onChange={(e) => handleTipoDiaChange(e.target.value as TipoDia)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              >
                {TIPO_DIA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dia especifico (only when DIA_ESPECIFICO is selected) */}
            {config.tipoDia === 'DIA_ESPECIFICO' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dia del mes *</label>
                <input
                  type="number"
                  value={config.diaEspecifico || ''}
                  onChange={(e) => handleDiaEspecificoChange(parseInt(e.target.value) || 0)}
                  min="1"
                  max="31"
                  placeholder="15"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Si el mes tiene menos dias, se usara el ultimo dia disponible
                </p>
              </div>
            )}

            {/* Fecha inicio */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha inicio *</label>
              <input
                type="date"
                value={config.fechaInicio}
                onChange={(e) => handleFechaInicioChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
            </div>

            {/* Fecha fin */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fecha fin {config.sinFechaFin ? '(solo este ano)' : '*'}
              </label>
              <input
                type="date"
                value={config.fechaFin || ''}
                onChange={(e) => handleFechaFinChange(e.target.value)}
                disabled={config.sinFechaFin}
                min={config.fechaInicio}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Sin fecha fin checkbox */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.sinFechaFin}
                  onChange={(e) => handleSinFechaFinChange(e.target.checked)}
                  className="w-3.5 h-3.5 text-slate-400 bg-white border-slate-300 rounded focus:ring-slate-400 focus:ring-2"
                />
                <span className="text-xs text-slate-700">
                  Sin fecha de fin (solo se generaran para el ano actual)
                </span>
              </label>
            </div>
          </div>

          {/* Schedule description */}
          <div className="mt-2.5 text-xs text-slate-600 italic">
            Se generara {getScheduleDescription()}
          </div>

          {/* Preview */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-200">
            {previewLoading ? (
              <div className="flex items-center text-slate-400 text-xs">
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Calculando...
              </div>
            ) : previewError ? (
              <div className="text-rose-400 text-xs">{previewError}</div>
            ) : previewCount !== null ? (
              <div className="flex items-center justify-between">
                <div className="text-slate-600 font-medium text-xs">
                  Se crearan <span className="text-sm font-bold">{previewCount}</span> {previewCount === 1 ? (tipo === 'INGRESO' ? 'factura' : 'gasto') : (tipo === 'INGRESO' ? 'facturas' : 'gastos')}
                </div>
                {previewCount > 24 && (
                  <div className="text-amber-400 text-xs">
                    Muchos registros
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs">
                Selecciona las fechas para ver cuantos registros se crearan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export config type for use in parent components
export type { ProgramarConfig, Periodicidad, TipoDia };

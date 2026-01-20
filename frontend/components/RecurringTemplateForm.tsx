'use client';

import { useState, useEffect } from 'react';
import { clients } from '@/lib/api';
import FrequencySelector from './FrequencySelector';

interface RecurringTemplateFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
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

export default function RecurringTemplateForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Crear Plantilla'
}: RecurringTemplateFormProps) {
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre_plantilla: initialData?.nombre_plantilla || '',
    descripcion: initialData?.descripcion || '',
    cliente_id: initialData?.cliente_id || '',
    concepto: initialData?.concepto || '',
    descripcion_detallada: initialData?.descripcion_detallada || '',
    base_imponible: initialData?.base_imponible || '',
    tipo_iva: initialData?.tipo_iva || '21',
    tipo_irpf: initialData?.tipo_irpf || '7',
    serie: initialData?.serie || 'A',
    frecuencia: initialData?.frecuencia || 'MENSUAL',
    tipo_dia_generacion: initialData?.tipo_dia_generacion || 'DIA_ESPECIFICO',
    dia_generacion: initialData?.dia_generacion || 1,
    fecha_inicio: initialData?.fecha_inicio || new Date().toISOString().split('T')[0],
    fecha_fin: initialData?.fecha_fin || '',
    incluir_periodo_facturacion: initialData?.incluir_periodo_facturacion ?? true,
    dias_vencimiento: initialData?.dias_vencimiento || 30,
    duracion_periodo_dias: initialData?.duracion_periodo_dias || 30,
    generar_pdf_automatico: initialData?.generar_pdf_automatico ?? true,
  });

  const [calculatedValues, setCalculatedValues] = useState({
    cuota_iva: 0,
    cuota_irpf: 0,
    total_factura: 0,
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [formData.base_imponible, formData.tipo_iva, formData.tipo_irpf]);

  async function loadClients() {
    try {
      const response = await clients.list();
      setClientsList(response.data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }

  function calculateTotals() {
    const base = parseFloat(formData.base_imponible) || 0;
    const iva = parseFloat(formData.tipo_iva) || 0;
    const irpf = parseFloat(formData.tipo_irpf) || 0;

    const cuota_iva = Math.round((base * iva) / 100 * 100) / 100;
    const cuota_irpf = Math.round((base * irpf) / 100 * 100) / 100;
    const total_factura = Math.round((base + cuota_iva - cuota_irpf) * 100) / 100;

    setCalculatedValues({ cuota_iva, cuota_irpf, total_factura });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, type } = e.target;
    let value = e.target.value;
    const checked = (e.target as HTMLInputElement).checked;

    // For base_imponible, normalize the input to handle locale differences
    if (name === 'base_imponible') {
      value = normalizeNumericInput(value);
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  }

  function handleFrequencyChange(
    frecuencia: string,
    tipoDiaGeneracion: 'DIA_ESPECIFICO' | 'PRIMER_DIA_NATURAL' | 'PRIMER_DIA_LECTIVO' | 'ULTIMO_DIA_NATURAL' | 'ULTIMO_DIA_LECTIVO',
    diaGeneracion: number
  ) {
    setFormData({
      ...formData,
      frecuencia,
      tipo_dia_generacion: tipoDiaGeneracion,
      dia_generacion: diaGeneracion
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validations
    if (!formData.nombre_plantilla) {
      alert('El nombre de la plantilla es requerido');
      return;
    }
    if (!formData.cliente_id) {
      alert('Debe seleccionar un cliente');
      return;
    }
    if (!formData.concepto) {
      alert('El concepto es requerido');
      return;
    }
    if (!formData.base_imponible || parseFloat(formData.base_imponible) <= 0) {
      alert('La base imponible debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      // Convert to proper types
      const submitData = {
        ...formData,
        base_imponible: parseFloat(formData.base_imponible),
        tipo_iva: parseFloat(formData.tipo_iva),
        tipo_irpf: parseFloat(formData.tipo_irpf),
        dia_generacion: parseInt(formData.dia_generacion.toString()),
        dias_vencimiento: parseInt(formData.dias_vencimiento.toString()),
        duracion_periodo_dias: parseInt(formData.duracion_periodo_dias.toString()),
        fecha_fin: formData.fecha_fin || undefined,
      };

      await onSubmit(submitData);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre de la Plantilla *
        </label>
        <input
          type="text"
          name="nombre_plantilla"
          value={formData.nombre_plantilla}
          onChange={handleChange}
          placeholder="Ej: Factura mensual desarrollo web"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          Un nombre descriptivo para identificar esta plantilla
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción (opcional)
        </label>
        <textarea
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Descripción adicional..."
        />
      </div>

      {/* Client */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
        <select
          name="cliente_id"
          value={formData.cliente_id}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Seleccionar cliente...</option>
          {clientsList.map((client: any) => (
            <option key={client.id} value={client.id}>
              {client.razon_social} - {client.cif}
            </option>
          ))}
        </select>
        {clientsList.length === 0 && (
          <p className="mt-1 text-sm text-amber-600">
            No hay clientes disponibles. Crea un cliente primero.
          </p>
        )}
      </div>

      {/* Concept */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Concepto *</label>
        <textarea
          name="concepto"
          value={formData.concepto}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Servicios de desarrollo web mensual..."
          required
        />
      </div>

      {/* Detailed Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción detallada (opcional)
        </label>
        <textarea
          name="descripcion_detallada"
          value={formData.descripcion_detallada}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Detalles adicionales que aparecerán en la factura..."
        />
      </div>

      {/* Frequency Selector */}
      <FrequencySelector
        value={formData.frecuencia}
        tipoDiaGeneracion={formData.tipo_dia_generacion as any}
        diaGeneracion={formData.dia_generacion}
        onChange={handleFrequencyChange}
      />

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha de inicio *
          </label>
          <input
            type="date"
            name="fecha_inicio"
            value={formData.fecha_inicio}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Cuando empezar a generar facturas
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha de fin (opcional)
          </label>
          <input
            type="date"
            name="fecha_fin"
            value={formData.fecha_fin}
            onChange={handleChange}
            min={formData.fecha_inicio}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Dejar vacío para sin límite
          </p>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Base Imponible (€) *
          </label>
          <input
            type="text"
            inputMode="decimal"
            name="base_imponible"
            value={formData.base_imponible}
            onChange={handleChange}
            placeholder="0.00"
            pattern="[0-9]*[.,]?[0-9]*"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">IVA (%)</label>
          <select
            name="tipo_iva"
            value={formData.tipo_iva}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="0">0% - Exento</option>
            <option value="4">4% - Superreducido</option>
            <option value="10">10% - Reducido</option>
            <option value="21">21% - General</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">IRPF (%)</label>
          <select
            name="tipo_irpf"
            value={formData.tipo_irpf}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="0">0% - Sin retención</option>
            <option value="7">7% - General</option>
            <option value="15">15% - Profesionales</option>
            <option value="19">19% - Actividades agrícolas</option>
          </select>
        </div>
      </div>

      {/* Calculated totals preview */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-gray-700 mb-2 font-medium">Vista previa del importe:</div>
        <div className="text-3xl font-bold text-blue-600 mb-2">
          {calculatedValues.total_factura.toFixed(2)} €
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Base imponible: {parseFloat(formData.base_imponible || '0').toFixed(2)}€</div>
          <div className="text-green-700">+ IVA ({formData.tipo_iva}%): {calculatedValues.cuota_iva.toFixed(2)}€</div>
          <div className="text-red-700">- IRPF ({formData.tipo_irpf}%): {calculatedValues.cuota_irpf.toFixed(2)}€</div>
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900">Opciones adicionales</h3>

        <div className="flex items-start">
          <input
            type="checkbox"
            name="incluir_periodo_facturacion"
            checked={formData.incluir_periodo_facturacion}
            onChange={handleChange}
            className="mt-1 mr-3"
          />
          <div>
            <label className="text-sm font-medium text-gray-700">
              Incluir periodo de facturación automático
            </label>
            <p className="text-sm text-gray-500">
              Las facturas incluirán fechas de inicio/fin del periodo facturado
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días para vencimiento
            </label>
            <input
              type="number"
              name="dias_vencimiento"
              value={formData.dias_vencimiento}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="mt-1 text-sm text-gray-500">
              Días después de emisión
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serie
            </label>
            <input
              type="text"
              name="serie"
              value={formData.serie}
              onChange={handleChange}
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="mt-1 text-sm text-gray-500">
              Serie de numeración (default: A)
            </p>
          </div>
        </div>

        <div className="flex items-start">
          <input
            type="checkbox"
            name="generar_pdf_automatico"
            checked={formData.generar_pdf_automatico}
            onChange={handleChange}
            className="mt-1 mr-3"
          />
          <div>
            <label className="text-sm font-medium text-gray-700">
              Generar PDF automáticamente
            </label>
            <p className="text-sm text-gray-500">
              El PDF se generará automáticamente al crear la factura
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading || clientsList.length === 0}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Guardando...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

'use client';

type TipoDiaGeneracion =
  | 'DIA_ESPECIFICO'
  | 'PRIMER_DIA_NATURAL'
  | 'PRIMER_DIA_LECTIVO'
  | 'ULTIMO_DIA_NATURAL'
  | 'ULTIMO_DIA_LECTIVO';

interface FrequencySelectorProps {
  value: string;
  tipoDiaGeneracion: TipoDiaGeneracion;
  diaGeneracion: number;
  onChange: (frecuencia: string, tipoDiaGeneracion: TipoDiaGeneracion, diaGeneracion: number) => void;
}

export default function FrequencySelector({
  value,
  tipoDiaGeneracion,
  diaGeneracion,
  onChange
}: FrequencySelectorProps) {
  const frequencies = [
    { value: 'MENSUAL', label: 'Mensual', description: 'Cada mes', icon: '📅' },
    { value: 'TRIMESTRAL', label: 'Trimestral', description: 'Cada 3 meses', icon: '📊' },
    { value: 'ANUAL', label: 'Anual', description: 'Cada año', icon: '📆' },
  ];

  const dayTypeOptions = [
    {
      value: 'DIA_ESPECIFICO',
      label: 'Día específico',
      description: 'Ej: cada día 15 del mes',
      icon: '📌'
    },
    {
      value: 'PRIMER_DIA_NATURAL',
      label: 'Primer día del mes',
      description: 'Siempre el día 1',
      icon: '1️⃣'
    },
    {
      value: 'PRIMER_DIA_LECTIVO',
      label: 'Primer día hábil',
      description: 'Primer lun-vie del mes',
      icon: '💼'
    },
    {
      value: 'ULTIMO_DIA_NATURAL',
      label: 'Último día del mes',
      description: 'Día 28-31 según mes',
      icon: '🔚'
    },
    {
      value: 'ULTIMO_DIA_LECTIVO',
      label: 'Último día hábil',
      description: 'Último lun-vie del mes',
      icon: '📋'
    },
  ];

  // Generate day options (1-31)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const getPeriodLabel = () => {
    switch (value) {
      case 'MENSUAL':
        return 'mes';
      case 'TRIMESTRAL':
        return 'trimestre';
      case 'ANUAL':
        return 'año';
      default:
        return 'periodo';
    }
  };

  const getPreviewText = () => {
    const periodo = getPeriodLabel();

    switch (tipoDiaGeneracion) {
      case 'DIA_ESPECIFICO':
        return `Se generará el día ${diaGeneracion} de cada ${periodo}`;
      case 'PRIMER_DIA_NATURAL':
        return `Se generará el primer día de cada ${periodo}`;
      case 'PRIMER_DIA_LECTIVO':
        return `Se generará el primer día hábil (lun-vie) de cada ${periodo}`;
      case 'ULTIMO_DIA_NATURAL':
        return `Se generará el último día de cada ${periodo}`;
      case 'ULTIMO_DIA_LECTIVO':
        return `Se generará el último día hábil (lun-vie) de cada ${periodo}`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Frequency Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Frecuencia de generación *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {frequencies.map((freq) => (
            <button
              key={freq.value}
              type="button"
              onClick={() => onChange(freq.value, tipoDiaGeneracion, diaGeneracion)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                value === freq.value
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{freq.icon}</span>
                <div className="font-semibold text-gray-900">{freq.label}</div>
              </div>
              <div className="text-sm text-gray-600">{freq.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Day Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tipo de día de generación *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dayTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(value, option.value as TipoDiaGeneracion, diaGeneracion)}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                tipoDiaGeneracion === option.value
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{option.label}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{option.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Specific Day Selection (only shown when DIA_ESPECIFICO) */}
      {tipoDiaGeneracion === 'DIA_ESPECIFICO' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Día del {getPeriodLabel()} *
          </label>
          <select
            value={diaGeneracion}
            onChange={(e) => onChange(value, tipoDiaGeneracion, parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            {days.map((day) => (
              <option key={day} value={day}>
                Día {day}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Nota: Para meses sin día {diaGeneracion}, se usará el último día disponible
          </p>
        </div>
      )}

      {/* Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <div className="text-sm font-medium text-blue-900">Resumen de generación</div>
            <div className="text-sm text-blue-700 mt-1">{getPreviewText()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Company Settings Validator for PDF Generation
 * Validates that all required company settings are present before generating invoices
 */

export interface CompanySettingsValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorMessage: string | null;
}

export interface CompanySettings {
  direccion?: string | null;
  ciudad?: string | null;
  iban?: string | null;
  nombre_completo?: string | null;
  nif?: string | null;
}

/**
 * Validates that company settings are complete for PDF generation
 * Required fields: direccion, ciudad, iban
 */
export function validateCompanySettingsForPDF(
  settings: CompanySettings
): CompanySettingsValidationResult {
  const missingFields: string[] = [];

  if (!settings.direccion?.trim()) {
    missingFields.push('Dirección');
  }

  if (!settings.ciudad?.trim()) {
    missingFields.push('Ciudad');
  }

  if (!settings.iban?.trim()) {
    missingFields.push('IBAN');
  }

  if (missingFields.length === 0) {
    return { isValid: true, missingFields: [], errorMessage: null };
  }

  const fieldList = missingFields.join(', ');
  const errorMessage = `Para generar facturas PDF, debe configurar los siguientes datos de empresa: ${fieldList}. Vaya a Ajustes → Configuración de Facturación para completarlos.`;

  return { isValid: false, missingFields, errorMessage };
}

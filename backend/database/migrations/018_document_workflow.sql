-- ============================================================================
-- Migration 018: Document Workflow for Spanish Autónomos Alta Process
-- ============================================================================
-- Date: 2026-01-14
-- Description: Transforms the documents section into an intelligent Alta workflow
--   - Document types catalog for autónomo-specific documents
--   - AI-powered document suggestions
--   - Alta progress tracking
--   - Integration with programaciones for recurring entries
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE document_types TABLE (Document Types Catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_types (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  es_obligatorio BOOLEAN DEFAULT false,
  triggers_documentos TEXT[],          -- Document codes that become required if this exists
  campos_esperados JSONB,              -- Fields AI should extract from this document type
  palabras_clave TEXT[],               -- Keywords to help AI identify this document type
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE document_types IS 'Catalog of document types relevant to Spanish autónomos';
COMMENT ON COLUMN document_types.codigo IS 'Unique code for the document type (e.g., MODELO_036)';
COMMENT ON COLUMN document_types.triggers_documentos IS 'Array of document_type.codigo that become required when this document exists';
COMMENT ON COLUMN document_types.campos_esperados IS 'JSON schema of fields AI should extract from this document type';
COMMENT ON COLUMN document_types.palabras_clave IS 'Keywords to help AI identify this document type';

-- Insert initial document types
INSERT INTO document_types (codigo, nombre, descripcion, es_obligatorio, triggers_documentos, campos_esperados, palabras_clave, orden) VALUES
  ('MODELO_036', 'Alta en Hacienda (Modelo 036)', 'Declaración censal de alta, modificación o baja en el censo de empresarios, profesionales y retenedores', true, NULL,
   '{"nif": "string", "nombre_razon_social": "string", "fecha_presentacion": "date", "epigrafe_iae": "string", "regimen_iva": "string", "es_trade": "boolean", "domicilio_fiscal": "string"}',
   ARRAY['MODELO 036', 'DECLARACIÓN CENSAL', 'ALTA EN EL CENSO', 'AGENCIA TRIBUTARIA', 'HACIENDA'], 1),

  ('MODELO_TA0521', 'Alta en RETA (Modelo TA.0521)', 'Solicitud de alta, baja o variación de datos en el Régimen Especial de Trabajadores Autónomos', true, NULL,
   '{"nif": "string", "nombre": "string", "fecha_alta": "date", "base_cotizacion": "number", "mutua": "string", "tarifa_plana": "boolean"}',
   ARRAY['TA.0521', 'TA0521', 'RÉGIMEN ESPECIAL', 'TRABAJADORES AUTÓNOMOS', 'RETA', 'SEGURIDAD SOCIAL', 'TESORERÍA GENERAL'], 2),

  ('CONTRATO_TRADE', 'Contrato TRADE', 'Contrato de trabajador autónomo económicamente dependiente con cliente principal', false, ARRAY['APROBACION_SEPE'],
   '{"cliente_nombre": "string", "cliente_cif": "string", "importe_mensual": "number", "fecha_inicio": "date", "fecha_fin": "date", "duracion_meses": "number", "actividad": "string"}',
   ARRAY['TRABAJADOR AUTÓNOMO ECONÓMICAMENTE DEPENDIENTE', 'TRADE', 'CLIENTE PRINCIPAL', 'DEPENDENCIA ECONÓMICA'], 3),

  ('APROBACION_SEPE', 'Aprobación SEPE', 'Justificante de comunicación y registro del contrato TRADE en el SEPE', false, NULL,
   '{"numero_registro": "string", "fecha_registro": "date", "cliente_nombre": "string", "cliente_cif": "string"}',
   ARRAY['SERVICIO PÚBLICO DE EMPLEO', 'SEPE', 'COMUNICACIÓN TRADE', 'REGISTRO CONTRATO', 'JUSTIFICANTE'], 4),

  ('CONTRATO_ALQUILER', 'Contrato de Alquiler', 'Contrato de arrendamiento de vivienda habitual o local profesional', false, NULL,
   '{"arrendador_nombre": "string", "arrendador_cif": "string", "importe_mensual": "number", "dia_pago": "number", "fecha_inicio": "date", "fecha_fin": "date", "uso": "string", "direccion": "string"}',
   ARRAY['ARRENDAMIENTO', 'ARRENDADOR', 'ARRENDATARIO', 'ALQUILER', 'RENTA MENSUAL', 'CONTRATO DE ALQUILER'], 5),

  ('CONTRATO_SUMINISTROS', 'Contrato de Suministros', 'Contratos de suministros (luz, gas, agua, internet, teléfono)', false, NULL,
   '{"proveedor_nombre": "string", "proveedor_cif": "string", "tipo_suministro": "string", "importe_mensual_estimado": "number", "titular_nombre": "string", "direccion_suministro": "string"}',
   ARRAY['SUMINISTRO', 'ELECTRICIDAD', 'GAS', 'AGUA', 'INTERNET', 'TELECOMUNICACIONES', 'LUZ', 'FIBRA'], 6),

  ('CONTRATO_CLIENTE', 'Contrato con Cliente', 'Contrato de prestación de servicios con cliente', false, NULL,
   '{"cliente_nombre": "string", "cliente_cif": "string", "importe_mensual": "number", "importe_total": "number", "fecha_inicio": "date", "fecha_fin": "date", "descripcion_servicios": "string"}',
   ARRAY['CONTRATO DE SERVICIOS', 'PRESTACIÓN DE SERVICIOS', 'CLIENTE', 'HONORARIOS'], 7),

  ('DOCUMENTO_IDENTIDAD', 'Documento de Identidad', 'DNI, NIE o pasaporte del autónomo', false, NULL,
   '{"numero_documento": "string", "tipo_documento": "string", "fecha_expedicion": "date", "fecha_caducidad": "date", "nombre_completo": "string"}',
   ARRAY['DNI', 'NIE', 'DOCUMENTO NACIONAL', 'IDENTIDAD', 'PASAPORTE'], 8),

  ('CERTIFICADO_DIGITAL', 'Certificado Digital', 'Certificado digital de persona física o autónomo', false, NULL,
   '{"numero_serie": "string", "entidad_emisora": "string", "fecha_emision": "date", "fecha_caducidad": "date", "titular": "string"}',
   ARRAY['CERTIFICADO DIGITAL', 'FNMT', 'FIRMA ELECTRÓNICA', 'CERTIFICADO ELECTRÓNICO'], 9),

  ('OTRO', 'Otro Documento', 'Otros documentos relevantes para la actividad', false, NULL, '{}', ARRAY[]::TEXT[], 99)
ON CONFLICT (codigo) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_document_types_codigo ON document_types(codigo);
CREATE INDEX IF NOT EXISTS idx_document_types_obligatorio ON document_types(es_obligatorio) WHERE es_obligatorio = true;

-- ============================================================================
-- 2. CREATE ai_document_suggestions TABLE (AI Suggestions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_document_suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Suggestion details
  tipo_sugerencia VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad VARCHAR(20) DEFAULT 'MEDIA',

  -- For UPLOAD_DOCUMENT suggestions
  documento_sugerido_tipo VARCHAR(50) REFERENCES document_types(codigo),

  -- For CREATE_EXPENSE / CREATE_INVOICE suggestions
  programacion_tipo VARCHAR(10),
  datos_programacion JSONB,

  -- For DATA_CORRECTION suggestions
  campo_corregir VARCHAR(100),
  valor_actual TEXT,
  valor_sugerido TEXT,

  -- Status tracking
  estado VARCHAR(20) DEFAULT 'PENDIENTE',
  fecha_decision TIMESTAMP,
  notas_usuario TEXT,

  -- If suggestion was accepted and created something
  programacion_creada_id UUID REFERENCES programaciones(id),
  documento_creado_id INTEGER REFERENCES documents(id),

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_tipo_sugerencia CHECK (tipo_sugerencia IN ('UPLOAD_DOCUMENT', 'CREATE_EXPENSE', 'CREATE_INVOICE', 'DATA_CORRECTION')),
  CONSTRAINT valid_prioridad CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
  CONSTRAINT valid_estado CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'MODIFICADA')),
  CONSTRAINT valid_programacion_tipo CHECK (programacion_tipo IS NULL OR programacion_tipo IN ('INGRESO', 'GASTO'))
);

COMMENT ON TABLE ai_document_suggestions IS 'AI-generated suggestions based on document analysis';
COMMENT ON COLUMN ai_document_suggestions.tipo_sugerencia IS 'UPLOAD_DOCUMENT, CREATE_EXPENSE, CREATE_INVOICE, DATA_CORRECTION';
COMMENT ON COLUMN ai_document_suggestions.datos_programacion IS 'Pre-filled data for creating programacion when accepted';

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user ON ai_document_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_document ON ai_document_suggestions(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_estado ON ai_document_suggestions(estado);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending ON ai_document_suggestions(user_id, estado) WHERE estado = 'PENDIENTE';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON ai_document_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_suggestions_updated_at();

-- ============================================================================
-- 3. CREATE alta_autonomo_progress TABLE (Alta Progress Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alta_autonomo_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Required documents (obligatory for all autónomos)
  modelo_036_uploaded BOOLEAN DEFAULT false,
  modelo_036_document_id INTEGER REFERENCES documents(id),
  modelo_ta0521_uploaded BOOLEAN DEFAULT false,
  modelo_ta0521_document_id INTEGER REFERENCES documents(id),

  -- TRADE-specific (detected from documents)
  es_trade BOOLEAN DEFAULT false,
  contrato_trade_uploaded BOOLEAN DEFAULT false,
  contrato_trade_document_id INTEGER REFERENCES documents(id),
  aprobacion_sepe_uploaded BOOLEAN DEFAULT false,
  aprobacion_sepe_document_id INTEGER REFERENCES documents(id),

  -- Local/office (detected from documents or user setting)
  tiene_local BOOLEAN DEFAULT false,
  contrato_alquiler_uploaded BOOLEAN DEFAULT false,
  contrato_alquiler_document_id INTEGER REFERENCES documents(id),

  -- Completion tracking
  alta_completa BOOLEAN DEFAULT false,
  fecha_alta_completa TIMESTAMP,
  documentos_obligatorios_completados INTEGER DEFAULT 0,
  documentos_opcionales_completados INTEGER DEFAULT 0,
  sugerencias_pendientes INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alta_autonomo_progress IS 'Tracks user progress through the Alta de Autónomo documentation workflow';

CREATE INDEX IF NOT EXISTS idx_alta_progress_user ON alta_autonomo_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_alta_progress_incomplete ON alta_autonomo_progress(alta_completa) WHERE alta_completa = false;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_alta_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alta_progress_updated_at
  BEFORE UPDATE ON alta_autonomo_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_alta_progress_updated_at();

-- ============================================================================
-- 4. ALTER documents TABLE (Add new columns)
-- ============================================================================

-- Add new columns for AI analysis and document type linking
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS document_type_id INTEGER REFERENCES document_types(id),
ADD COLUMN IF NOT EXISTS ai_analizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_fecha_analisis TIMESTAMP,
ADD COLUMN IF NOT EXISTS ai_datos_extraidos JSONB,
ADD COLUMN IF NOT EXISTS ai_confianza DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_tipo_detectado VARCHAR(50),
ADD COLUMN IF NOT EXISTS vinculado_programacion_id UUID REFERENCES programaciones(id);

COMMENT ON COLUMN documents.document_type_id IS 'Reference to the document type from catalog';
COMMENT ON COLUMN documents.ai_analizado IS 'Whether AI has analyzed this document';
COMMENT ON COLUMN documents.ai_datos_extraidos IS 'Data extracted by AI analysis';
COMMENT ON COLUMN documents.ai_confianza IS 'AI confidence score (0-100)';
COMMENT ON COLUMN documents.ai_tipo_detectado IS 'Document type code detected by AI';
COMMENT ON COLUMN documents.vinculado_programacion_id IS 'If this document created a programacion';

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_ai_analizado ON documents(ai_analizado);
CREATE INDEX IF NOT EXISTS idx_documents_programacion ON documents(vinculado_programacion_id);

-- Update categoria constraint to include new categories
-- First drop the existing constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS valid_categoria;

-- Add updated constraint with new categories
ALTER TABLE documents ADD CONSTRAINT valid_categoria CHECK (categoria IN (
  -- New categories for Alta workflow
  'ALTA_HACIENDA',
  'ALTA_SEGURIDAD_SOCIAL',
  'CONTRATO_TRADE',
  'APROBACION_SEPE',
  'CONTRATO_ALQUILER',
  'CONTRATO_SUMINISTROS',
  'CONTRATO_CLIENTE',
  'DOCUMENTO_IDENTIDAD',
  'CERTIFICADO_DIGITAL',
  -- Original categories (for backwards compatibility)
  'CONTRATO_VIVIENDA',
  'DOCUMENTO_BANCARIO',
  'OTRO'
));

-- ============================================================================
-- 5. FUNCTION: Update Alta Progress
-- ============================================================================
CREATE OR REPLACE FUNCTION update_alta_progress_on_document()
RETURNS TRIGGER AS $$
DECLARE
  doc_type_code VARCHAR(50);
  user_progress alta_autonomo_progress%ROWTYPE;
  obligatorios_count INTEGER;
  opcionales_count INTEGER;
BEGIN
  -- Get the document type code
  SELECT codigo INTO doc_type_code FROM document_types WHERE id = NEW.document_type_id;

  -- Ensure progress record exists for user
  INSERT INTO alta_autonomo_progress (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update the corresponding flag based on document type
  CASE doc_type_code
    WHEN 'MODELO_036' THEN
      UPDATE alta_autonomo_progress
      SET modelo_036_uploaded = true, modelo_036_document_id = NEW.id
      WHERE user_id = NEW.user_id;
    WHEN 'MODELO_TA0521' THEN
      UPDATE alta_autonomo_progress
      SET modelo_ta0521_uploaded = true, modelo_ta0521_document_id = NEW.id
      WHERE user_id = NEW.user_id;
    WHEN 'CONTRATO_TRADE' THEN
      UPDATE alta_autonomo_progress
      SET contrato_trade_uploaded = true, contrato_trade_document_id = NEW.id, es_trade = true
      WHERE user_id = NEW.user_id;
    WHEN 'APROBACION_SEPE' THEN
      UPDATE alta_autonomo_progress
      SET aprobacion_sepe_uploaded = true, aprobacion_sepe_document_id = NEW.id
      WHERE user_id = NEW.user_id;
    WHEN 'CONTRATO_ALQUILER' THEN
      UPDATE alta_autonomo_progress
      SET contrato_alquiler_uploaded = true, contrato_alquiler_document_id = NEW.id, tiene_local = true
      WHERE user_id = NEW.user_id;
    ELSE
      -- Other document types don't affect progress directly
      NULL;
  END CASE;

  -- Recalculate completion counts
  SELECT * INTO user_progress FROM alta_autonomo_progress WHERE user_id = NEW.user_id;

  -- Count obligatory documents (036 and TA0521)
  obligatorios_count := 0;
  IF user_progress.modelo_036_uploaded THEN obligatorios_count := obligatorios_count + 1; END IF;
  IF user_progress.modelo_ta0521_uploaded THEN obligatorios_count := obligatorios_count + 1; END IF;

  -- Count optional documents based on context
  opcionales_count := 0;
  IF user_progress.es_trade THEN
    IF user_progress.contrato_trade_uploaded THEN opcionales_count := opcionales_count + 1; END IF;
    IF user_progress.aprobacion_sepe_uploaded THEN opcionales_count := opcionales_count + 1; END IF;
  END IF;
  IF user_progress.tiene_local THEN
    IF user_progress.contrato_alquiler_uploaded THEN opcionales_count := opcionales_count + 1; END IF;
  END IF;

  -- Update counts and check if alta is complete
  UPDATE alta_autonomo_progress
  SET
    documentos_obligatorios_completados = obligatorios_count,
    documentos_opcionales_completados = opcionales_count,
    alta_completa = (
      obligatorios_count >= 2 AND
      (NOT es_trade OR (contrato_trade_uploaded AND aprobacion_sepe_uploaded)) AND
      (NOT tiene_local OR contrato_alquiler_uploaded)
    ),
    fecha_alta_completa = CASE
      WHEN alta_completa = false AND (
        obligatorios_count >= 2 AND
        (NOT es_trade OR (contrato_trade_uploaded AND aprobacion_sepe_uploaded)) AND
        (NOT tiene_local OR contrato_alquiler_uploaded)
      ) THEN NOW()
      ELSE fecha_alta_completa
    END
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update alta progress when document is created/updated
CREATE TRIGGER trg_update_alta_progress
  AFTER INSERT OR UPDATE OF document_type_id ON documents
  FOR EACH ROW
  WHEN (NEW.document_type_id IS NOT NULL AND NEW.estado = 'ACTIVO')
  EXECUTE FUNCTION update_alta_progress_on_document();

-- ============================================================================
-- 6. FUNCTION: Count Pending Suggestions
-- ============================================================================
CREATE OR REPLACE FUNCTION update_pending_suggestions_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the count in alta_autonomo_progress
  UPDATE alta_autonomo_progress
  SET sugerencias_pendientes = (
    SELECT COUNT(*) FROM ai_document_suggestions
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND estado = 'PENDIENTE'
  )
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_pending_suggestions
  AFTER INSERT OR UPDATE OR DELETE ON ai_document_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_suggestions_count();

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETED
-- ============================================================================
-- Tables created: 3 (document_types, ai_document_suggestions, alta_autonomo_progress)
-- Columns added to documents: 7
-- Triggers created: 4
-- Functions created: 3
--
-- To verify:
-- SELECT * FROM document_types ORDER BY orden;
-- SELECT COUNT(*) FROM ai_document_suggestions;
-- SELECT * FROM alta_autonomo_progress;
-- ============================================================================

-- ============================================================================
-- Migración 006: Sistema de Repositorio de Documentos y Contratos
-- ============================================================================
-- Fecha: 2026-01-11
-- Descripción: Crea el sistema completo de gestión de documentos con:
--   - Almacenamiento de contratos TRADE, vivienda, clientes, bancarios
--   - Control de versiones con historial completo
--   - Sistema de enlaces compartidos temporales
--   - Alertas automáticas de vencimiento
--   - Logs de auditoría de accesos
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLA PRINCIPAL: documents (documentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Metadatos del documento
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50) NOT NULL,
  tipo_documento VARCHAR(100),

  -- Información del archivo
  archivo_nombre_original VARCHAR(255) NOT NULL,
  archivo_nombre_storage VARCHAR(255) NOT NULL UNIQUE,
  archivo_ruta VARCHAR(500) NOT NULL,
  archivo_tipo_mime VARCHAR(100) NOT NULL,
  archivo_tamanio_bytes INTEGER NOT NULL,
  archivo_hash_sha256 VARCHAR(64),

  -- Fechas importantes
  fecha_subida TIMESTAMP DEFAULT NOW() NOT NULL,
  fecha_documento DATE,
  fecha_vencimiento DATE,
  fecha_recordatorio DATE,

  -- Control de versiones
  version INTEGER DEFAULT 1 NOT NULL,
  documento_padre_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  es_version_actual BOOLEAN DEFAULT true NOT NULL,

  -- Estado y visibilidad
  estado VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL,
  visible BOOLEAN DEFAULT true NOT NULL,

  -- Metadatos adicionales
  notas TEXT,
  etiquetas TEXT[],

  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_categoria CHECK (categoria IN (
    'CONTRATO_TRADE',
    'CONTRATO_VIVIENDA',
    'CONTRATO_CLIENTE',
    'DOCUMENTO_BANCARIO',
    'OTRO'
  )),
  CONSTRAINT valid_estado CHECK (estado IN ('ACTIVO', 'ARCHIVADO', 'ELIMINADO')),
  CONSTRAINT fecha_vencimiento_posterior CHECK (
    fecha_vencimiento IS NULL OR
    fecha_documento IS NULL OR
    fecha_vencimiento >= fecha_documento
  )
);

COMMENT ON TABLE documents IS 'Almacena documentos y contratos del usuario';
COMMENT ON COLUMN documents.categoria IS 'CONTRATO_TRADE, CONTRATO_VIVIENDA, CONTRATO_CLIENTE, DOCUMENTO_BANCARIO, OTRO';
COMMENT ON COLUMN documents.archivo_hash_sha256 IS 'Hash SHA-256 para detectar duplicados';
COMMENT ON COLUMN documents.documento_padre_id IS 'Referencia a la versión anterior del documento';
COMMENT ON COLUMN documents.es_version_actual IS 'Solo la última versión debe ser true';

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_categoria ON documents(categoria);
CREATE INDEX IF NOT EXISTS idx_documents_fecha_vencimiento ON documents(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL AND estado = 'ACTIVO';
CREATE INDEX IF NOT EXISTS idx_documents_estado ON documents(estado);
CREATE INDEX IF NOT EXISTS idx_documents_version_actual ON documents(user_id, es_version_actual)
  WHERE es_version_actual = true;
CREATE INDEX IF NOT EXISTS idx_documents_etiquetas ON documents USING GIN(etiquetas);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(archivo_hash_sha256)
  WHERE archivo_hash_sha256 IS NOT NULL;

-- ============================================================================
-- 2. TABLA DE VERSIONES: document_versions
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Información del archivo de esta versión
  archivo_nombre_storage VARCHAR(255) NOT NULL,
  archivo_ruta VARCHAR(500) NOT NULL,
  archivo_tamanio_bytes INTEGER NOT NULL,
  archivo_hash_sha256 VARCHAR(64),

  -- Metadatos al momento de la versión
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha_documento DATE,

  -- Auditoría
  creado_por_user_id INTEGER NOT NULL REFERENCES usuarios(id),
  motivo_cambio TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT unique_document_version UNIQUE(document_id, version_number)
);

COMMENT ON TABLE document_versions IS 'Historial de versiones de documentos para auditoría y trazabilidad';
COMMENT ON COLUMN document_versions.motivo_cambio IS 'Razón por la cual se creó una nueva versión';

CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at);

-- ============================================================================
-- 3. TABLA DE ENLACES COMPARTIDOS: document_shares
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_shares (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Token único y seguro
  token VARCHAR(64) UNIQUE NOT NULL,

  -- Control de acceso
  fecha_creacion TIMESTAMP DEFAULT NOW() NOT NULL,
  fecha_expiracion TIMESTAMP NOT NULL,
  activo BOOLEAN DEFAULT true NOT NULL,
  requiere_password BOOLEAN DEFAULT false,
  password_hash VARCHAR(255),

  -- Limitaciones
  max_accesos INTEGER,
  accesos_realizados INTEGER DEFAULT 0 NOT NULL,

  -- Metadatos
  nombre_destinatario VARCHAR(255),
  email_destinatario VARCHAR(255),
  notas TEXT,

  -- Auditoría
  ultimo_acceso TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_expiracion CHECK (fecha_expiracion > fecha_creacion),
  CONSTRAINT valid_max_accesos CHECK (max_accesos IS NULL OR max_accesos > 0),
  CONSTRAINT password_requerido CHECK (
    (requiere_password = false AND password_hash IS NULL) OR
    (requiere_password = true AND password_hash IS NOT NULL)
  )
);

COMMENT ON TABLE document_shares IS 'Enlaces temporales para compartir documentos con terceros sin autenticación';
COMMENT ON COLUMN document_shares.token IS 'Token único generado con UUID v4 para acceso público';
COMMENT ON COLUMN document_shares.max_accesos IS 'NULL = ilimitado, número = límite de accesos permitidos';

CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(token)
  WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user ON document_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_expiracion ON document_shares(fecha_expiracion)
  WHERE activo = true;

-- ============================================================================
-- 4. TABLA DE LOGS DE ACCESO: document_access_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_access_logs (
  id SERIAL PRIMARY KEY,
  document_share_id INTEGER NOT NULL REFERENCES document_shares(id) ON DELETE CASCADE,

  -- Información del acceso
  ip_address INET,
  user_agent TEXT,
  accion VARCHAR(50) NOT NULL,
  exitoso BOOLEAN NOT NULL,
  mensaje_error TEXT,

  -- Auditoría
  fecha_acceso TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE document_access_logs IS 'Registro de todos los accesos a documentos compartidos para auditoría';
COMMENT ON COLUMN document_access_logs.accion IS 'VIEW, DOWNLOAD, FAILED_PASSWORD, EXPIRED';

CREATE INDEX IF NOT EXISTS idx_document_access_logs_share ON document_access_logs(document_share_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_fecha ON document_access_logs(fecha_acceso);

-- ============================================================================
-- 5. INTEGRACIÓN CON SISTEMA DE ALERTAS EXISTENTE
-- ============================================================================

-- Agregar campo para relacionar alertas con documentos
ALTER TABLE alertas_compliance
ADD COLUMN IF NOT EXISTS related_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alertas_compliance_document ON alertas_compliance(related_document_id);

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha de modificación
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Trigger para gestionar versiones y fecha de recordatorio
CREATE OR REPLACE FUNCTION gestionar_version_documento()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se marca como versión actual, desmarcar las anteriores
  IF NEW.es_version_actual = true AND NEW.documento_padre_id IS NOT NULL THEN
    UPDATE documents
    SET es_version_actual = false, updated_at = NOW()
    WHERE documento_padre_id = NEW.documento_padre_id
      AND id != NEW.id
      AND es_version_actual = true;
  END IF;

  -- Calcular fecha de recordatorio automáticamente (30 días antes del vencimiento)
  IF NEW.fecha_vencimiento IS NOT NULL AND NEW.fecha_recordatorio IS NULL THEN
    NEW.fecha_recordatorio := NEW.fecha_vencimiento - INTERVAL '30 days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gestionar_version_documento
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION gestionar_version_documento();

-- Trigger para incrementar contador de accesos
CREATE OR REPLACE FUNCTION incrementar_accesos_share()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exitoso = true AND NEW.accion IN ('VIEW', 'DOWNLOAD') THEN
    UPDATE document_shares
    SET accesos_realizados = accesos_realizados + 1,
        ultimo_acceso = NOW()
    WHERE id = NEW.document_share_id;

    -- Desactivar automáticamente si se alcanzó el límite de accesos
    UPDATE document_shares
    SET activo = false
    WHERE id = NEW.document_share_id
      AND max_accesos IS NOT NULL
      AND accesos_realizados >= max_accesos;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incrementar_accesos_share
  AFTER INSERT ON document_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION incrementar_accesos_share();

-- ============================================================================
-- 7. FUNCIONES DE ALERTAS AUTOMÁTICAS
-- ============================================================================

-- Función para generar alertas de documentos próximos a vencer
CREATE OR REPLACE FUNCTION generar_alertas_vencimiento_documentos()
RETURNS INTEGER AS $$
DECLARE
  documentos_por_vencer RECORD;
  alertas_creadas INTEGER := 0;
BEGIN
  -- Buscar documentos que vencen en 30, 15, 7 días
  FOR documentos_por_vencer IN
    SELECT
      d.id,
      d.user_id,
      d.nombre,
      d.categoria,
      d.fecha_vencimiento,
      (d.fecha_vencimiento - CURRENT_DATE) as dias_restantes
    FROM documents d
    WHERE d.estado = 'ACTIVO'
      AND d.fecha_vencimiento IS NOT NULL
      AND d.fecha_vencimiento >= CURRENT_DATE
      AND d.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM alertas_compliance ca
        WHERE ca.related_document_id = d.id
          AND ca.tipo = 'DOCUMENTO_POR_VENCER'
          AND ca.leida = false
          AND ca.fecha_alerta > CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    -- Determinar nivel de severidad según días restantes
    INSERT INTO alertas_compliance (
      user_id,
      tipo,
      nivel,
      mensaje,
      related_document_id,
      fecha_alerta,
      leida
    ) VALUES (
      documentos_por_vencer.user_id,
      'DOCUMENTO_POR_VENCER',
      CASE
        WHEN documentos_por_vencer.dias_restantes <= 7 THEN 'CRITICAL'
        WHEN documentos_por_vencer.dias_restantes <= 15 THEN 'WARNING'
        ELSE 'INFO'
      END,
      'El documento "' || documentos_por_vencer.nombre || '" vence el ' ||
        TO_CHAR(documentos_por_vencer.fecha_vencimiento, 'DD/MM/YYYY') ||
        ' (en ' || documentos_por_vencer.dias_restantes || ' días). ' ||
        CASE documentos_por_vencer.categoria
          WHEN 'CONTRATO_TRADE' THEN 'Renueva tu contrato TRADE antes del vencimiento para mantener las bonificaciones.'
          WHEN 'CONTRATO_VIVIENDA' THEN 'Contacta con tu arrendador para renovar o renegociar el contrato.'
          WHEN 'CONTRATO_CLIENTE' THEN 'Revisa y renueva el contrato con tu cliente si es necesario.'
          ELSE 'Revisa el documento y toma las acciones necesarias antes del vencimiento.'
        END,
      documentos_por_vencer.id,
      NOW(),
      false
    );

    alertas_creadas := alertas_creadas + 1;
  END LOOP;

  RETURN alertas_creadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_alertas_vencimiento_documentos() IS 'Genera alertas automáticas para documentos que vencen en los próximos 30 días';

-- Función para generar alertas de documentos ya vencidos
CREATE OR REPLACE FUNCTION generar_alertas_documentos_vencidos()
RETURNS INTEGER AS $$
DECLARE
  documentos_vencidos RECORD;
  alertas_creadas INTEGER := 0;
BEGIN
  FOR documentos_vencidos IN
    SELECT
      d.id,
      d.user_id,
      d.nombre,
      d.categoria,
      d.fecha_vencimiento,
      (CURRENT_DATE - d.fecha_vencimiento) as dias_vencido
    FROM documents d
    WHERE d.estado = 'ACTIVO'
      AND d.fecha_vencimiento IS NOT NULL
      AND d.fecha_vencimiento < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM alertas_compliance ca
        WHERE ca.related_document_id = d.id
          AND ca.tipo = 'DOCUMENTO_VENCIDO'
          AND ca.leida = false
      )
  LOOP
    INSERT INTO alertas_compliance (
      user_id,
      tipo,
      nivel,
      mensaje,
      related_document_id,
      fecha_alerta,
      leida
    ) VALUES (
      documentos_vencidos.user_id,
      'DOCUMENTO_VENCIDO',
      'CRITICAL',
      'URGENTE: El documento "' || documentos_vencidos.nombre || '" venció hace ' ||
        documentos_vencidos.dias_vencido || ' días (el ' ||
        TO_CHAR(documentos_vencidos.fecha_vencimiento, 'DD/MM/YYYY') || '). ' ||
        'Sube una nueva versión actualizada o archiva este documento si ya no es relevante.',
      documentos_vencidos.id,
      NOW(),
      false
    );

    alertas_creadas := alertas_creadas + 1;
  END LOOP;

  RETURN alertas_creadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_alertas_documentos_vencidos() IS 'Genera alertas críticas para documentos que ya han vencido';

-- Función auxiliar para limpiar enlaces compartidos expirados
CREATE OR REPLACE FUNCTION limpiar_shares_expirados()
RETURNS INTEGER AS $$
DECLARE
  shares_desactivados INTEGER;
BEGIN
  UPDATE document_shares
  SET activo = false
  WHERE activo = true
    AND fecha_expiracion < NOW();

  GET DIAGNOSTICS shares_desactivados = ROW_COUNT;
  RETURN shares_desactivados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpiar_shares_expirados() IS 'Desactiva automáticamente los enlaces compartidos que han expirado';

-- ============================================================================
-- 8. DATOS DE PRUEBA (OPCIONAL - comentado por defecto)
-- ============================================================================

-- Descomentar para insertar datos de prueba
/*
-- Insertar un documento de prueba para el primer usuario
INSERT INTO documents (
  user_id,
  nombre,
  descripcion,
  categoria,
  archivo_nombre_original,
  archivo_nombre_storage,
  archivo_ruta,
  archivo_tipo_mime,
  archivo_tamanio_bytes,
  fecha_documento,
  fecha_vencimiento
) VALUES (
  1,
  'Contrato TRADE 2026',
  'Contrato de Trabajador Autónomo Económicamente Dependiente con justificante del SEPE',
  'CONTRATO_TRADE',
  'contrato_trade_2026.pdf',
  'abc123_1705304400000.pdf',
  '/uploads/documents/1/2026/abc123_1705304400000.pdf',
  'application/pdf',
  2458624,
  '2026-01-01',
  '2026-12-31'
) ON CONFLICT DO NOTHING;
*/

COMMIT;

-- ============================================================================
-- MIGRACIÓN COMPLETADA
-- ============================================================================
-- Tablas creadas: 4 (documents, document_versions, document_shares, document_access_logs)
-- Índices creados: 13
-- Triggers creados: 3
-- Funciones creadas: 5
--
-- Para verificar la migración:
-- SELECT COUNT(*) FROM documents;
-- SELECT COUNT(*) FROM document_versions;
-- SELECT COUNT(*) FROM document_shares;
-- SELECT COUNT(*) FROM document_access_logs;
--
-- Para generar alertas manualmente:
-- SELECT generar_alertas_vencimiento_documentos();
-- SELECT generar_alertas_documentos_vencidos();
-- ============================================================================

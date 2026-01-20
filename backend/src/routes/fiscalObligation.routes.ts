import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument as uploadMiddleware, handleMulterError } from '../middleware/upload';
import {
  uploadFiscalObligationDocument,
  getFiscalObligationDocument,
  viewFiscalObligationDocument,
  downloadFiscalObligationDocument,
  deleteFiscalObligationDocument,
  getFiscalObligationDocumentsByYear,
} from '../controllers/fiscalObligation.controller';

const router = Router();

// ============================================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================================

router.use(authenticate);

// ============================================================================
// FISCAL OBLIGATION DOCUMENT ROUTES
// ============================================================================

/**
 * GET /api/fiscal/obligations/year/:ano
 * Obtiene todos los documentos fiscales de un año
 */
router.get('/year/:ano', getFiscalObligationDocumentsByYear);

/**
 * POST /api/fiscal/obligations/:modelo/upload
 * Sube un documento para una obligación fiscal
 * Query params: trimestre (opcional), ano (requerido)
 */
router.post(
  '/:modelo/upload',
  uploadMiddleware.single('file'),
  handleMulterError,
  uploadFiscalObligationDocument
);

/**
 * GET /api/fiscal/obligations/:modelo/document
 * Obtiene metadatos del documento de una obligación fiscal
 * Query params: trimestre (opcional), ano (requerido)
 */
router.get('/:modelo/document', getFiscalObligationDocument);

/**
 * GET /api/fiscal/obligations/:modelo/view
 * Visualiza el documento de una obligación fiscal (devuelve el archivo)
 * Query params: trimestre (opcional), ano (requerido)
 */
router.get('/:modelo/view', viewFiscalObligationDocument);

/**
 * GET /api/fiscal/obligations/:modelo/download
 * Descarga el documento de una obligación fiscal
 * Query params: trimestre (opcional), ano (requerido)
 */
router.get('/:modelo/download', downloadFiscalObligationDocument);

/**
 * DELETE /api/fiscal/obligations/:modelo/document
 * Elimina el documento de una obligación fiscal
 * Query params: trimestre (opcional), ano (requerido)
 */
router.delete('/:modelo/document', deleteFiscalObligationDocument);

export default router;

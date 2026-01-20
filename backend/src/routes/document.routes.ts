import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument as uploadMiddleware, handleMulterError } from '../middleware/upload';
import {
  uploadDocument,
  getDocuments,
  getUnifiedDocuments,
  viewUnifiedDocument,
  downloadUnifiedDocument,
  deleteUnifiedDocument,
  getDocument,
  downloadDocument,
  viewDocument,
  updateDocument,
  deleteDocument,
  uploadVersion,
  getVersions,
  createShare,
  getShares,
  revokeShare,
  accessShared,
} from '../controllers/document.controller';

const router = Router();

// ============================================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================================

router.use(authenticate);

// ============================================================================
// UNIFIED DOCUMENTS (aggregated view from all sources)
// ============================================================================

// Get unified list of all documents (expenses + invoices + standalone)
router.get('/unified', getUnifiedDocuments);

// View/download/delete from any source
router.get('/view/:sourceType/:id', viewUnifiedDocument);
router.get('/download/:sourceType/:id', downloadUnifiedDocument);
router.delete('/unified/:sourceType/:id', deleteUnifiedDocument);

// ============================================================================
// GESTIÓN DE DOCUMENTOS STANDALONE
// ============================================================================

// Gestión de documentos
router.get('/', getDocuments);
router.post(
  '/',
  uploadMiddleware.single('file'),
  handleMulterError,
  uploadDocument
);
router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);
router.get('/:id/view', viewDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);

// Gestión de versiones
router.post(
  '/:id/versions',
  uploadMiddleware.single('file'),
  handleMulterError,
  uploadVersion
);
router.get('/:id/versions', getVersions);

// Gestión de enlaces compartidos
router.post('/:id/share', createShare);
router.get('/:id/shares', getShares);

// Revocar enlaces compartidos (ruta separada sin :id del documento)
router.delete('/shares/:shareId', revokeShare);

export default router;

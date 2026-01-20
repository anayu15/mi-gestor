import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument as uploadMiddleware, handleMulterError } from '../middleware/upload';
import {
  uploadAndAnalyzeAltaSS,
  getAltaSSAnalysis,
  getAltaSSHistory,
  deleteCurrentAltaSSAnalysis,
  deleteAltaSSAnalysisById,
} from '../controllers/altaSS.controller';

const router = Router();

// ============================================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================================

router.use(authenticate);

// ============================================================================
// ALTA SS (RETA) UPLOAD & ANALYSIS ROUTES
// ============================================================================

/**
 * POST /api/fiscal/alta-ss/upload
 * Sube y analiza un documento Alta SS (RETA)
 */
router.post(
  '/upload',
  uploadMiddleware.single('file'),
  handleMulterError,
  uploadAndAnalyzeAltaSS
);

/**
 * GET /api/fiscal/alta-ss/analysis
 * Obtiene el análisis más reciente del usuario
 */
router.get('/analysis', getAltaSSAnalysis);

/**
 * GET /api/fiscal/alta-ss/history
 * Obtiene el historial de todos los documentos Alta SS subidos
 */
router.get('/history', getAltaSSHistory);

/**
 * DELETE /api/fiscal/alta-ss/analysis
 * Elimina el análisis más reciente del usuario
 */
router.delete('/analysis', deleteCurrentAltaSSAnalysis);

/**
 * DELETE /api/fiscal/alta-ss/analysis/:id
 * Elimina un análisis específico por ID
 */
router.delete('/analysis/:id', deleteAltaSSAnalysisById);

export default router;

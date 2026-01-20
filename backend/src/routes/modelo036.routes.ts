import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument as uploadMiddleware, handleMulterError } from '../middleware/upload';
import {
  uploadAndAnalyzeModelo036,
  getModelo036Analysis,
  getModelo036History,
  getModelMismatches,
  getModelo036AnalysisById,
  deleteCurrentModelo036Analysis,
  deleteModelo036AnalysisById,
} from '../controllers/modelo036.controller';

const router = Router();

// ============================================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================================

router.use(authenticate);

// ============================================================================
// MODELO 036 UPLOAD & ANALYSIS ROUTES
// ============================================================================

/**
 * POST /api/fiscal/modelo-036/upload
 * Sube y analiza un documento Modelo 036
 */
router.post(
  '/upload',
  uploadMiddleware.single('file'),
  handleMulterError,
  uploadAndAnalyzeModelo036
);

/**
 * GET /api/fiscal/modelo-036/analysis
 * Obtiene el análisis más reciente del usuario
 */
router.get('/analysis', getModelo036Analysis);

/**
 * GET /api/fiscal/modelo-036/analysis/:id
 * Obtiene un análisis específico por ID
 */
router.get('/analysis/:id', getModelo036AnalysisById);

/**
 * GET /api/fiscal/modelo-036/history
 * Obtiene el historial de todos los 036 subidos
 */
router.get('/history', getModelo036History);

/**
 * GET /api/fiscal/modelo-036/mismatches
 * Compara recomendaciones del AI con preferencias del usuario
 */
router.get('/mismatches', getModelMismatches);

/**
 * DELETE /api/fiscal/modelo-036/analysis
 * Elimina el análisis más reciente del usuario
 */
router.delete('/analysis', deleteCurrentModelo036Analysis);

/**
 * DELETE /api/fiscal/modelo-036/analysis/:id
 * Elimina un análisis específico por ID
 */
router.delete('/analysis/:id', deleteModelo036AnalysisById);

export default router;

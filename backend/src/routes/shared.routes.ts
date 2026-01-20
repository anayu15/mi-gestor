import { Router } from 'express';
import { accessShared } from '../controllers/document.controller';

const router = Router();

// ============================================================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================================================

// Acceso a documento compartido mediante token
router.get('/:token', accessShared);

export default router;

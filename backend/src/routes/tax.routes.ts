import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getModelo303, getModelo130, getModelo115, getModelo180, getModelo390, getTaxSummary } from '../controllers/tax.controller';

const router = Router();

router.use(authenticate);

// Quarterly routes
router.get('/modelo-303/:year/:trimestre', getModelo303);
router.get('/modelo-130/:year/:trimestre', getModelo130);
router.get('/modelo-115/:year/:trimestre', getModelo115);

// Annual routes
router.get('/modelo-180/:year', getModelo180);
router.get('/modelo-390/:year', getModelo390);

// Summary
router.get('/summary/:year', getTaxSummary);

export default router;

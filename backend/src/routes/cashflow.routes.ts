import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDailyCashFlow } from '../controllers/cashflow.controller';

const router = Router();

router.use(authenticate);

// Routes
router.get('/daily', getDailyCashFlow);

export default router;

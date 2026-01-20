import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDashboardSummary,
  getCashFlowHistory,
  getIngresosGastosChart,
  getFiscalCalendar,
  getModeloData,
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

// Routes
router.get('/summary', getDashboardSummary);
router.get('/cash-flow-history', getCashFlowHistory);
router.get('/charts/ingresos-gastos', getIngresosGastosChart);
router.get('/fiscal-calendar', getFiscalCalendar);
router.get('/modelo-data/:modelo/:trimestre?/:year?', getModeloData);

export default router;

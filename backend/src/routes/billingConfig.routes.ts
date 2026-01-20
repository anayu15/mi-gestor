import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument, handleMulterError } from '../middleware/upload';
import {
  getBillingConfigs,
  getBillingConfig,
  getActiveBillingConfig,
  createBillingConfig,
  updateBillingConfig,
  deleteBillingConfig,
  setActiveBillingConfig,
  setPrincipalBillingConfig,
  uploadBillingConfigLogo,
} from '../controllers/billingConfig.controller';

const router = Router();

router.use(authenticate);

// Routes
router.get('/', getBillingConfigs);
router.get('/active', getActiveBillingConfig);
router.get('/:id', getBillingConfig);
router.post('/', createBillingConfig);
router.patch('/:id', updateBillingConfig);
router.delete('/:id', deleteBillingConfig);
router.post('/:id/activate', setActiveBillingConfig);
router.post('/:id/set-principal', setPrincipalBillingConfig);
router.post('/:id/logo', uploadDocument.single('logo'), handleMulterError, uploadBillingConfigLogo);

export default router;

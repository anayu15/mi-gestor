import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument, handleMulterError } from '../middleware/upload';
import {
  getCompanySettings,
  updateCompanySettings,
  uploadLogo,
  checkPDFReadiness,
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);

// Company settings routes
router.get('/company', getCompanySettings);
router.get('/company/pdf-readiness', checkPDFReadiness);
router.patch('/company', updateCompanySettings);
router.post('/company/logo', uploadDocument.single('logo'), handleMulterError, uploadLogo);

export default router;

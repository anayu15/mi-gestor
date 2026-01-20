import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Route coming soon' });
});

export default router;

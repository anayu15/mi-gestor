import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/client.controller';

const router = Router();

router.use(authenticate);

// Routes
router.get('/', getClients);
router.get('/:id', getClient);
router.post('/', createClient);
router.patch('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;

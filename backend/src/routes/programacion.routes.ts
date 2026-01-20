import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadDocument, handleMulterError } from '../middleware/upload';
import {
  getProgramaciones,
  getProgramacion,
  previewScheduledDates,
  deleteProgramacion,
  getLinkedRecordsCount,
  extractFromContract,
  getProgramacionContrato,
  viewProgramacionContratoFile,
  regenerateSeries,
  updateProgramacion
} from '../controllers/programacion.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all programaciones
router.get('/', getProgramaciones);

// Preview scheduled dates (before creating)
router.post('/preview', previewScheduledDates);

// Extract data from contract (must be before :id routes)
router.post(
  '/extract-from-contract',
  uploadDocument.single('contract'),
  handleMulterError,
  extractFromContract
);

// Get single programacion
router.get('/:id', getProgramacion);

// Get contract for programacion
router.get('/:id/contrato', getProgramacionContrato);

// View contract file for programacion
router.get('/:id/contrato/file', viewProgramacionContratoFile);

// Get count of linked records
router.get('/:id/count', getLinkedRecordsCount);

// Regenerate series with new periodicity
router.post('/:id/regenerate', regenerateSeries);

// Update programacion
router.patch('/:id', updateProgramacion);

// Delete programacion
router.delete('/:id', deleteProgramacion);

export default router;

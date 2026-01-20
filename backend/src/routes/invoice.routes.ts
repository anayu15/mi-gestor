import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getInvoices,
  getInvoice,
  generateInvoice,
  updateInvoice,
  markInvoicePaid,
  deleteInvoice,
  getNextInvoiceNumber,
  downloadInvoicePDF,
  regenerateInvoicePDF,
  generateScheduledInvoices,
  extendYearInvoices,
  deleteByYear,
  getInvoiceProgramacion,
  deleteInvoiceWithSeries,
  updateInvoiceWithSeries,
} from '../controllers/invoice.controller';

const router = Router();

router.use(authenticate);

// Routes
router.get('/', getInvoices);
router.get('/next-number', getNextInvoiceNumber);

// Scheduled invoice routes (must be before :id routes)
router.post('/generate-scheduled', generateScheduledInvoices);
router.post('/extend-year/:year', extendYearInvoices);
router.delete('/by-year/:year', deleteByYear);

router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadInvoicePDF);
router.get('/:id/programacion', getInvoiceProgramacion);
router.post('/generate', generateInvoice);
router.post('/:id/regenerate-pdf', regenerateInvoicePDF);
router.patch('/:id/with-series', updateInvoiceWithSeries);
router.patch('/:id', updateInvoice);
router.put('/:id', updateInvoice);
router.patch('/:id/mark-paid', markInvoicePaid);
router.delete('/:id/with-series', deleteInvoiceWithSeries);
router.delete('/:id', deleteInvoice);

export default router;

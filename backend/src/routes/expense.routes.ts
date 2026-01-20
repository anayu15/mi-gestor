import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  checkIndependenceExpenses,
  markExpensePaid,
  extractFromInvoice,
  viewExpenseFile,
  createScheduledExpenses,
  extendYearExpenses,
  deleteByYear,
  getExpenseProgramacion,
  deleteExpenseWithSeries,
  updateExpenseWithSeries,
} from '../controllers/expense.controller';
import { uploadDocument as uploadMiddleware, handleMulterError } from '../middleware/upload';

const router = Router();

router.use(authenticate);

// Routes
// OCR endpoint (must be BEFORE '/' route to avoid conflicts)
router.post(
  '/extract-from-invoice',
  uploadMiddleware.single('invoice'),
  handleMulterError,
  extractFromInvoice
);

// Scheduled expense routes (must be before :id routes)
router.post('/create-scheduled', createScheduledExpenses);
router.post('/extend-year/:year', extendYearExpenses);
router.delete('/by-year/:year', deleteByYear);

router.get('/', getExpenses);
router.get('/independence-check/:year/:month', checkIndependenceExpenses);
router.get('/:id', getExpense);
router.get('/:id/file', viewExpenseFile);
router.get('/:id/programacion', getExpenseProgramacion);
router.post('/', createExpense);
router.patch('/:id/mark-paid', markExpensePaid);
router.patch('/:id/with-series', updateExpenseWithSeries);
router.patch('/:id', updateExpense);
router.put('/:id', updateExpense);
router.delete('/:id/with-series', deleteExpenseWithSeries);
router.delete('/:id', deleteExpense);

export default router;

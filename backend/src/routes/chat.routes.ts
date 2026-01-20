import { Router } from 'express';
import { chat, getSuggestions } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// POST /api/chat - Send a message and get AI response
router.post('/', chat);

// GET /api/chat/suggestions - Get quick chat suggestions
router.get('/suggestions', getSuggestions);

export default router;

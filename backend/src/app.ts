import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// Import routes
import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import assetRoutes from './routes/asset.routes';
import expenseRoutes from './routes/expense.routes';
import invoiceRoutes from './routes/invoice.routes';
import dashboardRoutes from './routes/dashboard.routes';
import taxRoutes from './routes/tax.routes';
import complianceRoutes from './routes/compliance.routes';
import calendarRoutes from './routes/calendar.routes';
import simulatorRoutes from './routes/simulator.routes';
import bankRoutes from './routes/bank.routes';
import documentRoutes from './routes/document.routes';
import sharedRoutes from './routes/shared.routes';
import cashflowRoutes from './routes/cashflow.routes';
import settingsRoutes from './routes/settings.routes';
import programacionRoutes from './routes/programacion.routes';
import billingConfigRoutes from './routes/billingConfig.routes';
import modelo036Routes from './routes/modelo036.routes';
import altaSSRoutes from './routes/altaSS.routes';
import fiscalObligationRoutes from './routes/fiscalObligation.routes';
import chatRoutes from './routes/chat.routes';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones. Por favor, intenta de nuevo más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Health check (for deployment platforms like Render)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.env,
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.env,
    },
  });
});

// API Routes
const apiPrefix = config.apiPrefix;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/clients`, clientRoutes);
app.use(`${apiPrefix}/assets`, assetRoutes);
app.use(`${apiPrefix}/expenses`, expenseRoutes);
app.use(`${apiPrefix}/invoices`, invoiceRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/tax`, taxRoutes);
app.use(`${apiPrefix}/compliance`, complianceRoutes);
app.use(`${apiPrefix}/calendar`, calendarRoutes);
app.use(`${apiPrefix}/simulator`, simulatorRoutes);
app.use(`${apiPrefix}/bank-accounts`, bankRoutes);
app.use(`${apiPrefix}/documents`, documentRoutes);
app.use(`${apiPrefix}/cashflow`, cashflowRoutes);
app.use(`${apiPrefix}/settings`, settingsRoutes);
app.use(`${apiPrefix}/programaciones`, programacionRoutes);
app.use(`${apiPrefix}/billing-configs`, billingConfigRoutes);
app.use(`${apiPrefix}/fiscal/modelo-036`, modelo036Routes);
app.use(`${apiPrefix}/fiscal/alta-ss`, altaSSRoutes);
app.use(`${apiPrefix}/fiscal/obligations`, fiscalObligationRoutes);
app.use(`${apiPrefix}/chat`, chatRoutes);

// Ruta pública para acceso a documentos compartidos (sin prefijo /api)
app.use('/shared', sharedRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;

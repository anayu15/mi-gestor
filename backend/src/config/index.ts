import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  apiPrefix: process.env.API_PREFIX || '/api',

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'migestor',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ocr: {
    lang: process.env.TESSERACT_LANG || 'spa',
    cacheDir: process.env.TESSERACT_CACHE_DIR || '/tmp/tesseract-cache',
  },

  vision: {
    provider: process.env.VISION_PROVIDER || 'openrouter',
    claudeApiKey: process.env.CLAUDE_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
    // Gemini 2.0 Flash is best for contract extraction (tested: 100/100 accuracy)
    contractModel: process.env.CONTRACT_MODEL || 'google/gemini-2.0-flash-001',
    // Model for Modelo 036 analysis - uses same as contract by default
    // Can override with MODELO036_MODEL env var for better accuracy if needed
    // Options: google/gemini-2.0-flash-001, google/gemini-pro-vision, anthropic/claude-3-5-sonnet-20241022
    modelo036Model: process.env.MODELO036_MODEL || 'google/gemini-2.0-flash-001',
    claudeModel: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4-vision-preview',
    maxImageSize: parseInt(process.env.MAX_OCR_IMAGE_SIZE || '5242880'), // 5MB
    timeoutMs: parseInt(process.env.VISION_API_TIMEOUT || '30000'), // 30s
  },

  upload: {
    // Resolve to absolute path to ensure consistent file location regardless of working directory
    dir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,application/pdf').split(','),
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@migestor.es',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    ocrMax: parseInt(process.env.OCR_RATE_LIMIT_MAX || '10'),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};

export default config;

import app from './app';
import config from './config';
import { pool } from './config/database';
import fs from 'fs';

const PORT = config.port;

// Ensure upload directory exists
function ensureUploadDirectories() {
  const uploadDir = config.upload.dir;
  const subdirs = ['invoices', 'documents', 'logos'];

  try {
    // Create main upload directory
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`✅ Created upload directory: ${uploadDir}`);
    }

    // Create subdirectories
    for (const subdir of subdirs) {
      const subdirPath = `${uploadDir}/${subdir}`;
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
      }
    }
    console.log(`✅ Upload directories verified: ${uploadDir}`);
  } catch (error) {
    console.error('❌ Failed to create upload directories:', error);
    process.exit(1);
  }
}

// Test database connection
async function testDbConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Ensure required directories exist
    ensureUploadDirectories();

    await testDbConnection();

    app.listen(PORT, () => {
      console.log(`
🚀 miGestor Backend Server

Environment: ${config.env}
Port: ${PORT}
API Prefix: ${config.apiPrefix}
Database: ${config.database.name}

Server running at: http://localhost:${PORT}
Health check: http://localhost:${PORT}/health
API docs: http://localhost:${PORT}${config.apiPrefix}

Press CTRL+C to stop
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Start
startServer();

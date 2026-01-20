const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'migestor',
    user: process.env.DB_USER || process.env.USER || 'anayusta',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('Connecting to database...');
    
    // Check if table already exists
    const checkResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'fiscal_obligation_documents'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Table fiscal_obligation_documents already exists. Dropping and recreating...');
      await pool.query('DROP TABLE IF EXISTS fiscal_obligation_documents CASCADE');
    }

    console.log('Running migration 027_fiscal_obligation_documents.sql...');
    
    // Run migration
    const sqlPath = path.join(__dirname, 'database/migrations/027_fiscal_obligation_documents.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    
    console.log('✅ Migration 027_fiscal_obligation_documents.sql executed successfully!');
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

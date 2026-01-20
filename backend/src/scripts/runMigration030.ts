import { query, pool } from '../config/database';

async function runMigration() {
  console.log('Running migration 030: Simplify registration...');
  
  try {
    // Make nif nullable
    await query('ALTER TABLE users ALTER COLUMN nif DROP NOT NULL');
    console.log('✓ Made nif column nullable');
  } catch (error: any) {
    if (error.message.includes('already NOT NULL') || error.message.includes('does not exist')) {
      console.log('✓ nif column is already nullable');
    } else {
      throw error;
    }
  }
  
  try {
    // Make fecha_alta_autonomo nullable
    await query('ALTER TABLE users ALTER COLUMN fecha_alta_autonomo DROP NOT NULL');
    console.log('✓ Made fecha_alta_autonomo column nullable');
  } catch (error: any) {
    if (error.message.includes('already NOT NULL') || error.message.includes('does not exist')) {
      console.log('✓ fecha_alta_autonomo column is already nullable');
    } else {
      throw error;
    }
  }
  
  console.log('Migration 030 completed successfully!');
  await pool.end();
  process.exit(0);
}

runMigration().catch(error => {
  console.error('Migration failed:', error);
  pool.end();
  process.exit(1);
});

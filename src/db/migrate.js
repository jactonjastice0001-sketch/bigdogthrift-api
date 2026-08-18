const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db'); // or '../db' depending on your structure

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('🔄 Applying database schema...');
    await pool.query(sql);
    console.log('✅ Schema applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
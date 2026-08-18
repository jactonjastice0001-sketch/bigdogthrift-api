require('dotenv').config();
const { pool } = require('./src/config/db');

async function test() {
    try {
        const result = await pool.query('SELECT NOW() as time, current_database() as db');
        console.log('✅ Database connected!');
        console.log('📅 Time:', result.rows[0].time);
        console.log('📦 Database:', result.rows[0].db);
        await pool.end();
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\n💡 Check your DATABASE_URL in .env');
    }
}

test();

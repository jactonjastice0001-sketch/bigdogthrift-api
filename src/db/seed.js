require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

async function seed() {
  try {
    console.log('🌱 Seeding database...');
    
    // Get admin/seller credentials from .env
    const adminEmail = process.env.SELLER_EMAIL || 'admin@bigdogthrift.com';
    const adminPassword = process.env.SELLER_PASSWORD || 'Admin@123';
    
    // Check if admin already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existing.rows.length > 0) {
      console.log('✅ Admin user already exists, skipping seed.');
      await pool.end();
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, business_name, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminEmail,
        '+254700000001',
        hashedPassword,
        'Big Dog Admin',
        'admin',
        'Big Dog Thrift',
        true
      ]
    );

    console.log(`✅ Admin account created for ${adminEmail}`);
    
    // Create a test seller
    const sellerExists = await query('SELECT id FROM users WHERE email = $1', ['seller@bigdogthrift.com']);
    
    if (sellerExists.rows.length === 0) {
      const sellerPassword = await bcrypt.hash('Seller@123', 12);
      await query(
        `INSERT INTO users (email, phone, password_hash, full_name, role, business_name, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'seller@bigdogthrift.com',
          '+254700000002',
          sellerPassword,
          'Big Dog Seller',
          'seller',
          'Big Dog Thrift Store',
          true
        ]
      );
      console.log('✅ Test seller account created: seller@bigdogthrift.com / Seller@123');
    }

    // Create a test buyer
    const buyerExists = await query('SELECT id FROM users WHERE email = $1', ['buyer@bigdogthrift.com']);
    
    if (buyerExists.rows.length === 0) {
      const buyerPassword = await bcrypt.hash('Buyer@123', 12);
      await query(
        `INSERT INTO users (email, phone, password_hash, full_name, role, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'buyer@bigdogthrift.com',
          '+254700000003',
          buyerPassword,
          'Big Dog Buyer',
          'buyer',
          true
        ]
      );
      console.log('✅ Test buyer account created: buyer@bigdogthrift.com / Buyer@123');
    }

    console.log('✅ Seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('🔑 Admin: admin@bigdogthrift.com / Admin@123');
    console.log('🔑 Seller: seller@bigdogthrift.com / Seller@123');
    console.log('🔑 Buyer: buyer@bigdogthrift.com / Buyer@123');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();

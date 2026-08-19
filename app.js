process.on('uncaughtException', (err) => { console.error('UNCAUGHT EXCEPTION:', err)
process.exit(1); })
    const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

// ===================== SECURITY MIDDLEWARE =====================
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per window
});
app.use('/api', limiter);

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================== ROUTES =====================
// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: '🐕 BIG DOG THRIFT API', 
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            payments: '/api/payments',
            seller: '/api/seller',
            admin: '/api/admin'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/payments', require('./src/routes/payments.routes'));
app.use('/api/seller', require('./src/routes/seller.routes'));
app.use('/api/cart', require('./src/routes/cart.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/currency', require('./src/routes/currency.routes'));

// ===================== ERROR HANDLING =====================
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

module.exports = app;

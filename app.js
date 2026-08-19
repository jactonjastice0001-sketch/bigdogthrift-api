process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  setTimeout(() => process.exit(1), 1000);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api', limiter);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.json({ 
        message: 'BIG DOG THRIFT API', 
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

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

function safeRequire(routePath, label) {
  try {
    fs.writeSync(2, `Loading ${label}...\n`);
    const mod = require(routePath);
    fs.writeSync(2, `Loaded ${label} OK\n`);
    return mod;
  } catch (err) {
    fs.writeSync(2, `FAILED loading ${label}: ${err.stack}\n`);
    throw err;
  }
}

app.use('/api/auth', safeRequire('./src/routes/auth', 'auth'));
app.use('/api/products', safeRequire('./src/routes/products', 'products'));
app.use('/api/orders', safeRequire('./src/routes/orders.routes', 'orders.routes'));
app.use('/api/payments', safeRequire('./src/routes/payments.routes', 'payments.routes'));
app.use('/api/seller', safeRequire('./src/routes/seller.routes', 'seller.routes'));
app.use('/api/cart', safeRequire('./src/routes/cart.routes', 'cart.routes'));
app.use('/api/admin', safeRequire('./src/routes/admin.routes', 'admin.routes'));
app.use('/api/currency', safeRequire('./src/routes/currency.routes', 'currency.routes'));

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

module.exports = app;
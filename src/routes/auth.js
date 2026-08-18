const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { query } = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/test', (req, res) => {
    res.json({ message: 'Auth router is working!' });
});

router.post('/register', async (req, res) => {
    try {
        const { email, phone, password, full_name, role = 'buyer' } = req.body;

        if (!email || !phone || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'All fields are required: email, phone, password, full_name' });
        }

        const strongEnough = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
        if (!strongEnough) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include a letter anda number' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists with this email or phone' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await query(
            `INSERT INTO users (email, phone, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, phone, full_name, role, is_verified, created_at`,
            [email, phone, hashedPassword, full_name, role]
        );
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
        res.status(201).json({ success: true, message: 'User registered successfully', token, user });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const user = result.rows[0];
        if (user.is_banned) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
        const { password_hash, ...userWithoutPassword } = user;
        res.json({ success: true, message: 'Login successful', token, user: userWithoutPassword });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

router.patch('/profile', auth, async (req, res) => {
    try {
        const { full_name, phone, country, county, address, id_number } = req.body;
        const result = await query(
            `UPDATE users SET
                full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                country = COALESCE($3, country),
                county = COALESCE($4, county),
                address = COALESCE($5, address),
                id_number = COALESCE($6, id_number)
             WHERE id = $7
             RETURNING id, email, phone, full_name, role, country, county, address, id_number`,
            [full_name, phone, country, county, address, id_number, req.user.id]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const shortId = userId.replace(/-/g, '').slice(0, 12);
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const unusablePasswordHash = await bcrypt.hash(randomPassword, 12);

        const result = await query(
            `UPDATE users SET
                email = $1,
                phone = $2,
                full_name = 'Deleted User',
                password_hash = $3,
                business_name = NULL,
                id_number = NULL,
                address = NULL,
                logo_url = NULL,
                country = NULL,
                county = NULL,
                is_banned = true,
                updated_at = NOW()
             WHERE id = $4
             RETURNING id`,
            [`deleted-${shortId}@dukatag.local`, `deleted-${shortId}`, unusablePasswordHash, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
        await query('DELETE FROM favorites WHERE buyer_id = $1', [userId]);

        res.json({ success: true, message: 'Account deleted. Your order history has been preserved anonymously.' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ success: false, message: 'Server error during account deletion' });
    }
});

module.exports = router;

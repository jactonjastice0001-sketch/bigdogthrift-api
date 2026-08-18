const express = require('express');
const { auth, isAdmin } = require('../middleware/auth');
const { query } = require('../config/db');
const router = express.Router();

router.use(auth, isAdmin);

// --- Users ---
router.get('/users', async (req, res) => {
    const { role } = req.query;
    const result = role
        ? await query('SELECT id, email, phone, full_name, role, is_verified, is_banned, created_at FROM users WHERE role = $1 ORDER BY created_at DESC', [role])
        : await query('SELECT id, email, phone, full_name, role, is_verified, is_banned, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
});

router.patch('/users/:id/verify', async (req, res) => {
    const result = await query('UPDATE users SET is_verified = true WHERE id = $1 RETURNING id, email, is_verified', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/users/:id/ban', async (req, res) => {
    const result = await query('UPDATE users SET is_banned = true WHERE id = $1 RETURNING id, email, is_banned', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/users/:id/unban', async (req, res) => {
    const result = await query('UPDATE users SET is_banned = false WHERE id = $1 RETURNING id, email, is_banned', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/users/:id/promote', async (req, res) => {
    const result = await query(
        `UPDATE users SET role = 'admin' WHERE id = $1 RETURNING id, email, role`,
        [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
});

// --- Products ---
router.get('/products', async (req, res) => {
    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, products: result.rows });
});

router.patch('/products/:id/remove', async (req, res) => {
    const { reason } = req.body;
    const result = await query(
        'UPDATE products SET is_available = false, flagged = true, flag_reason = $2 WHERE id = $1 RETURNING id, name, is_available, flag_reason',
        [req.params.id, reason || null]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: result.rows[0] });
});

router.patch('/products/:id/restore', async (req, res) => {
    const result = await query(
        'UPDATE products SET is_available = true, flagged = false, flag_reason = NULL WHERE id = $1 RETURNING id, name, is_available',
        [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: result.rows[0] });
});

// --- Orders ---
router.get('/orders', async (req, res) => {
    const { stage } = req.query;
    const result = stage
        ? await query('SELECT * FROM orders WHERE stage = $1 ORDER BY created_at DESC', [stage])
        : await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json({ success: true, orders: result.rows });
});

router.patch('/orders/:id/resolve', async (req, res) => {
    const { stage, admin_note } = req.body;
    const result = await query(
        'UPDATE orders SET stage = COALESCE($2, stage), admin_note = $3 WHERE id = $1 RETURNING *',
        [req.params.id, stage || null, admin_note || null]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
});

// --- Stats ---
router.get('/stats', async (req, res) => {
    const [users, sellers, products, orders, revenue] = await Promise.all([
        query(`SELECT COUNT(*) FROM users`),
        query(`SELECT COUNT(*) FROM users WHERE role = 'seller'`),
        query(`SELECT COUNT(*) FROM products WHERE is_available = true`),
        query(`SELECT COUNT(*) FROM orders`),
        query(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE payment_status = 'paid'`)
    ]);
    res.json({
        success: true,
        stats: {
            total_users: Number(users.rows[0].count),
            total_sellers: Number(sellers.rows[0].count),
            active_products: Number(products.rows[0].count),
            total_orders: Number(orders.rows[0].count),
            total_revenue: Number(revenue.rows[0].total)
        }
    });
});

module.exports = router;
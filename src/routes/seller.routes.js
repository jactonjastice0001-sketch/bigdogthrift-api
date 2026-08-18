const express = require('express');
const { query } = require('../config/db');
const { auth, isSeller } = require('../middleware/auth');
const { upload, uploadImage, uploadMedia } = require('../middleware/upload');
const router = express.Router();

// Helper function for file URLs
function toUrl(filename) {
    return filename ? `${process.env.PUBLIC_BASE_URL || 'http://localhost:4000'}/uploads/${filename}` : null;
}

// ---- Public: storefront needs shop info without logging in ----
router.get('/storefront', async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT business_name, till_number, till_name, logo_url, ad_video_url FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        );
        res.json(rows[0] || {});
    } catch (error) {
        console.error('Error fetching storefront:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Seller: view own settings ----
router.get('/settings', auth, isSeller, async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT id, business_name, email, phone, full_name, till_number, till_name, logo_url, ad_video_url FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json(rows[0] || {});
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Seller: update till number / account name ----
router.patch('/settings/payment', auth, isSeller, async (req, res) => {
    try {
        const { tillNumber, tillName } = req.body;
        const { rows } = await query(
            'UPDATE users SET till_number = $1, till_name = $2 WHERE id = $3 RETURNING *',
            [tillNumber, tillName, req.user.id]
        );
        const user = rows[0];
        delete user.password_hash;
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error updating payment settings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Seller: upload/replace logo ----
router.post('/settings/logo', auth, isSeller, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const url = toUrl(req.file.filename);
        await query('UPDATE users SET logo_url = $1 WHERE id = $2', [url, req.user.id]);
        res.json({ success: true, logoUrl: url });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Seller: upload/replace ad video ----
router.post('/settings/ad-video', auth, isSeller, upload.single('video'), async (req, res) => {
    try {
        const url = req.file ? toUrl(req.file.filename) : req.body.videoUrl;
        if (!url) {
            return res.status(400).json({ error: 'Upload a video file or provide videoUrl' });
        }
        await query('UPDATE users SET ad_video_url = $1 WHERE id = $2', [url, req.user.id]);
        res.json({ success: true, adVideoUrl: url });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Seller: get dashboard stats ----
router.get('/dashboard', auth, isSeller, async (req, res) => {
    try {
        // Get product count
        const products = await query(
            'SELECT COUNT(*) FROM products WHERE seller_id = $1',
            [req.user.id]
        );
        
        // Get order count for this seller's products (payment-confirmed only)
        const orders = await query(
            `SELECT COUNT(DISTINCT o.id) 
             FROM orders o 
             JOIN order_items oi ON o.id = oi.order_id 
             JOIN products p ON oi.product_id = p.id 
             WHERE p.seller_id = $1
               AND o.payment_status = 'confirmed'`,
            [req.user.id]
        );
        
        // Get recent orders (payment-confirmed only)
        const recentOrders = await query(
            `SELECT o.*, COUNT(oi.id) as items_count
             FROM orders o
             JOIN order_items oi ON o.id = oi.order_id
             JOIN products p ON oi.product_id = p.id
             WHERE p.seller_id = $1
               AND o.payment_status = 'confirmed'
             GROUP BY o.id
             ORDER BY o.created_at DESC
             LIMIT 10`,
            [req.user.id]
        );
        
        res.json({
            success: true,
            stats: {
                products: parseInt(products.rows[0].count),
                orders: parseInt(orders.rows[0].count)
            },
            recentOrders: recentOrders.rows
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

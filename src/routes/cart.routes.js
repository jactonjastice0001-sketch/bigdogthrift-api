const express = require('express');
const { query } = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET my cart
router.get('/', auth, async (req, res) => {
    try {
        const result = await query(
            `SELECT c.id AS cart_item_id, c.quantity, p.*
             FROM cart_items c
             JOIN products p ON p.id = c.product_id
             WHERE c.user_id = $1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, items: result.rows });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST add to cart (or increment if already there)
router.post('/', auth, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        if (!product_id) {
            return res.status(400).json({ success: false, message: 'product_id is required' });
        }
        await query(
            `INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, product_id)
             DO UPDATE SET quantity = cart_items.quantity + $3`,
            [req.user.id, product_id, quantity || 1]
        );
        res.status(201).json({ success: true, message: 'Added to cart' });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE remove from cart
router.delete('/:productId', auth, async (req, res) => {
    try {
        await query(
            'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
            [req.user.id, req.params.productId]
        );
        res.status(204).end();
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

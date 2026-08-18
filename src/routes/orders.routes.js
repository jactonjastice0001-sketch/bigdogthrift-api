const express = require('express');
const { query, pool } = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

function generateOrderCode() {
    const prefix = 'BDOG';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// Create order
router.post('/', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { items, destination, paymentMethod, shipping_address, deliveryFee, distanceKm } = req.body;

        if (!items || !items.length || !destination || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Items, destination, and payment method are required'
            });
        }

        await client.query('BEGIN');

        let total = 0;
        const orderItems = [];

        for (const line of items) {
            const result = await client.query(
                'SELECT * FROM products WHERE id = $1 FOR UPDATE',
                [line.productId]
            );

            const product = result.rows[0];
            if (!product) {
                throw new Error(`Product ${line.productId} not found`);
            }
            if (product.stock < line.quantity) {
                throw new Error(`Not enough stock for ${product.name}`);
            }

            total += Number(product.price) * line.quantity;
            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: line.quantity
            });
        }

        const finalDeliveryFee = Number(deliveryFee) || 0;
        const grandTotal = total + finalDeliveryFee;
        const orderCode = generateOrderCode();

        const orderResult = await client.query(
            `INSERT INTO orders (
                order_code, buyer_id, destination, total, payment_method,
                payment_status, stage, shipping_address, delivery_fee, distance_km
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [orderCode, req.user.id, destination, grandTotal, paymentMethod,
             'pending', 'placed', shipping_address || destination, finalDeliveryFee, distanceKm || null]
        );

        const order = orderResult.rows[0];

        for (const item of orderItems) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, name, price, quantity)
                 VALUES ($1, $2, $3, $4, $5)`,
                [order.id, item.productId, item.name, item.price, item.quantity]
            );

            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.productId]
            );
        }

        await client.query(
            'DELETE FROM cart_items WHERE user_id = $1',
            [req.user.id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: order
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    } finally {
        client.release();
    }
});

// Get buyer's own orders
router.get('/my-orders', auth, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, orders: result.rows });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get orders containing this seller's products
router.get('/seller/mine', auth, async (req, res) => {
    try {
        const result = await query(
            `SELECT DISTINCT o.*
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN products p ON p.id = oi.product_id
             WHERE p.seller_id = $1
               AND o.payment_status = 'confirmed'
             ORDER BY o.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, orders: result.rows });
    } catch (error) {
        console.error('Error fetching seller orders:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const orderResult = await query(
            `SELECT o.*,
                    u.full_name  AS buyer_name,
                    u.email      AS buyer_email,
                    u.phone      AS buyer_phone,
                    u.address    AS buyer_address,
                    u.county     AS buyer_county,
                    u.country    AS buyer_country
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             WHERE o.id = $1
               AND (
                     o.buyer_id = $2
                     OR EXISTS (
                       SELECT 1 FROM order_items oi
                       JOIN products p ON p.id = oi.product_id
                       WHERE oi.order_id = o.id AND p.seller_id = $2
                     )
                   )`,
            [id, req.user.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemsResult = await query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [id]
        );

        res.json({
            success: true,
            order: orderResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update order status (for sellers/admins)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;

        if (!stage) {
            return res.status(400).json({ success: false, message: 'Stage required' });
        }

        const validStages = ['placed', 'packaging', 'shipped', 'delivered', 'cancelled'];
        if (!validStages.includes(stage)) {
            return res.status(400).json({ success: false, message: 'Invalid stage' });
        }

        const result = await query(
            'UPDATE orders SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [stage, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        await query(
            'INSERT INTO order_status_log (order_id, stage, sms_sent) VALUES ($1, $2, $3)',
            [id, stage, false]
        );

        res.json({
            success: true,
            message: 'Order status updated',
            order: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Buyer submits M-Pesa transaction code after paying
router.post('/:id/submit-payment', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { transactionCode } = req.body;

        if (!transactionCode || !transactionCode.trim()) {
            return res.status(400).json({ success: false, message: 'Transaction code is required' });
        }

        const result = await query(
            `UPDATE orders
             SET transaction_code = $1, payment_status = 'submitted', payment_submitted_at = NOW(), updated_at = NOW()
             WHERE id = $2 AND buyer_id = $3 AND payment_status = 'pending'
             RETURNING *`,
            [transactionCode.trim().toUpperCase(), id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or payment already submitted' });
        }

        res.json({ success: true, message: 'Payment code submitted, awaiting confirmation', order: result.rows[0] });
    } catch (error) {
        console.error('Error submitting payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Seller confirms payment after checking M-Pesa statement
router.put('/:id/confirm-payment', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        const check = await client.query(
            `SELECT DISTINCT o.* FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN products p ON p.id = oi.product_id
             WHERE o.id = $1 AND p.seller_id = $2`,
            [id, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (check.rows[0].payment_status !== 'submitted') {
            return res.status(400).json({ success: false, message: 'No pending payment to confirm for this order' });
        }

        const result = await client.query(
            `UPDATE orders SET payment_status = 'confirmed', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );

        res.json({ success: true, message: 'Payment confirmed', order: result.rows[0] });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// Seller declines payment (bad/fake code) — cancels order and restocks
router.put('/:id/decline-payment', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { reason } = req.body;

        await client.query('BEGIN');

        const check = await client.query(
            `SELECT DISTINCT o.* FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN products p ON p.id = oi.product_id
             WHERE o.id = $1 AND p.seller_id = $2`,
            [id, req.user.id]
        );

        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (check.rows[0].payment_status === 'confirmed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Cannot decline an already-confirmed payment' });
        }

        // Restock items since order is being cancelled
        const items = await client.query(
            'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
            [id]
        );
        for (const item of items.rows) {
            await client.query(
                'UPDATE products SET stock = stock + $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }

        const result = await client.query(
            `UPDATE orders SET payment_status = 'declined', stage = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );

        await client.query(
            'INSERT INTO order_status_log (order_id, stage, sms_sent) VALUES ($1, $2, $3)',
            [id, 'cancelled', false]
        );

        await client.query('COMMIT');

        res.json({ success: true, message: `Payment declined${reason ? ': ' + reason : ''}, order cancelled`, order: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error declining payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});
module.exports = router;

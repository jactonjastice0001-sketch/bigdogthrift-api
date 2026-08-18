const express = require('express');
const { query } = require('../config/db');
const { auth, isSeller, requireRole } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const MAX_PHOTOS = 4;

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'big-dog-thrift/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    cb(null, true);
  }
});

// GET all products (public)
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT p.*, u.is_verified AS seller_verified
             FROM products p
             JOIN users u ON u.id = p.seller_id
             WHERE p.is_available = true
             ORDER BY p.created_at DESC`
        );
        res.json({
            success: true,
            products: result.rows
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// ---- Buyer: list my favorites ----
router.get('/mine/favorites', auth, requireRole('buyer'), async (req, res) => {
    try {
        const result = await query(
            `SELECT p.* FROM favorites f
             JOIN products p ON p.id = f.product_id
             WHERE f.buyer_id = $1
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, products: result.rows });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
})
// GET single product (public)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('UPDATE products SET views = views + 1 WHERE id = $1', [id]);

        const result = await query(
            `SELECT p.*, u.is_verified AS seller_verified
             FROM products p
             JOIN users u ON u.id = p.seller_id
             WHERE p.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const product = result.rows[0];

        const sizesResult = await query(
            `SELECT id, size, stock FROM product_sizes WHERE product_id = $1 ORDER BY size`,
            [id]
        );

        const similarResult = await query(
            `SELECT id, name, price, photo_url, category
             FROM products
             WHERE category = $1 AND id != $2 AND is_available = true
             ORDER BY created_at DESC
             LIMIT 4`,
            [product.category, id]
        );

        res.json({
            success: true,
            product: { ...product, sizes: sizesResult.rows },
            similar: similarResult.rows
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST create product (sellers only)
router.post('/', auth, isSeller, upload.array('photos', MAX_PHOTOS), async (req, res) => {
    try {
        const { name, category, price, stock, description, brand, size, color, sizes } = req.body;

        if (!name || !category || !price) {
            return res.status(400).json({
                success: false,
                message: 'Name, category, and price are required'
            });
        }

        // req.files is an array (multer .array()); each file's Cloudinary URL is at .path
        const photoUrls = (req.files || []).map((f) => f.path);
        const photo_url = photoUrls[0] || null; // first image stays the "primary" photo for backward compatibility

        const result = await query(
            `INSERT INTO products (seller_id, name, category, price, stock, description, brand, size, color, photo_url, photos, is_available)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
             RETURNING *`,
            [req.user.id, name, category, price, stock || 1, description, brand, size, color, photo_url, photoUrls]
        );

        const product = result.rows[0];

        if (sizes) {
            const parsedSizes = JSON.parse(sizes);
            for (const s of parsedSizes) {
                if (s.size && s.stock >= 0) {
                    await query(
                        `INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)`,
                        [product.id, s.size, s.stock]
                    );
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            product
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT update product (sellers only)
router.put('/:id', auth, isSeller, upload.array('photos', MAX_PHOTOS), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, price, stock, description, brand, size, color, is_available } = req.body;

        const product = await query('SELECT * FROM products WHERE id = $1', [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // If new photos were uploaded, replace the full set; otherwise keep what's already stored
        const newPhotoUrls = (req.files || []).map((f) => f.path);
        const photos = newPhotoUrls.length > 0 ? newPhotoUrls : product.rows[0].photos;
        const photo_url = newPhotoUrls.length > 0 ? newPhotoUrls[0] : (req.body.photo_url || product.rows[0].photo_url);

        const result = await query(
            `UPDATE products SET
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                price = COALESCE($3, price),
                stock = COALESCE($4, stock),
                description = COALESCE($5, description),
                brand = COALESCE($6, brand),
                size = COALESCE($7, size),
                color = COALESCE($8, color),
                photo_url = COALESCE($9, photo_url),
                photos = COALESCE($10, photos),
                is_available = COALESCE($11, is_available)
             WHERE id = $12
             RETURNING *`,
            [name, category, price, stock, description, brand, size, color, photo_url, photos, is_available, id]
        );

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE product (sellers only)
router.delete('/:id', auth, isSeller, async (req, res) => {
    try {
        const { id } = req.params;

        const product = await query('SELECT * FROM products WHERE id = $1', [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await query('DELETE FROM products WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// ---- Buyer: add product to favorites ----
router.post('/:id/favorite', auth, requireRole('buyer'), async (req, res) => {
    try {
        await query(
            `INSERT INTO favorites (buyer_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [req.user.id, req.params.id]
        );
        res.status(204).end();
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Buyer: remove product from favorites ----
router.delete('/:id/favorite', auth, requireRole('buyer'), async (req, res) => {
    try {
        await query(
            'DELETE FROM favorites WHERE buyer_id = $1 AND product_id = $2',
            [req.user.id, req.params.id]
        );
        res.status(204).end();
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

const router = express.Router();

function toUrl(req, filename) {
  return filename ? `${process.env.PUBLIC_BASE_URL}/uploads/${filename}` : null;
}

// ---- Public: list items, optional ?category= filter ----
router.get('/', async (req, res) => {
  const { category } = req.query;
  const params = [];
  let sql = 'SELECT * FROM items';
  if (category) {
    params.push(category);
    sql += ' WHERE category = $1';
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// ---- Public: single item ----
router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM items WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
});

// ---- Seller: add new item, with photo upload ----
router.post('/', verifyToken, requireRole('seller'), uploadImage.single('photo'), async (req, res) => {
  try {
    const { name, category, price, qty, description } = req.body;
    if (!name || !category || price == null || qty == null) {
      return res.status(400).json({ error: 'name, category, price and qty are required' });
    }
    const photoUrl = req.file ? toUrl(req, req.file.filename) : null;
    const { rows } = await query(
      `INSERT INTO items (name, category, price, qty, photo_url, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, category, price, qty, photoUrl, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add item' });
  }
});

// ---- Seller: update item (price, qty, description, replace photo) ----
router.patch('/:id', verifyToken, requireRole('seller'), uploadImage.single('photo'), async (req, res) => {
  try {
    const { name, category, price, qty, description } = req.body;
    const photoUrl = req.file ? toUrl(req, req.file.filename) : undefined;

    const { rows: existingRows } = await query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Item not found' });
    const current = existingRows[0];

    const { rows } = await query(
      `UPDATE items SET name=$1, category=$2, price=$3, qty=$4, description=$5,
       photo_url=$6, updated_at=now() WHERE id=$7 RETURNING *`,
      [
        name ?? current.name,
        category ?? current.category,
        price ?? current.price,
        qty ?? current.qty,
        description ?? current.description,
        photoUrl ?? current.photo_url,
        req.params.id
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update item' });
  }
});

// ---- Seller: delete item ----
router.delete('/:id', verifyToken, requireRole('seller'), async (req, res) => {
  await query('DELETE FROM items WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// ---- Buyer: favorites ----
router.post('/:id/favorite', verifyToken, requireRole('buyer'), async (req, res) => {
  await query(
    `INSERT INTO favorites (buyer_id, item_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.user.id, req.params.id]
  );
  res.status(204).end();
});

router.delete('/:id/favorite', verifyToken, requireRole('buyer'), async (req, res) => {
  await query('DELETE FROM favorites WHERE buyer_id = $1 AND item_id = $2', [req.user.id, req.params.id]);
  res.status(204).end();
});

router.get('/mine/favorites', verifyToken, requireRole('buyer'), async (req, res) => {
  const { rows } = await query(
    `SELECT i.* FROM favorites f JOIN items i ON i.id = f.item_id WHERE f.buyer_id = $1`,
    [req.user.id]
  );
  res.json(rows);
});

module.exports = router;

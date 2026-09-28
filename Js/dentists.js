const express = require('express');
const { pool } = require('../db');
const { dentistOut } = require('../mappers');

const router = express.Router();

// GET /api/dentists
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dentists ORDER BY name');
    res.json(result.rows.map(dentistOut));
  } catch (err) {
    console.error('Fetching dentists failed:', err);
    res.status(500).json({ error: 'Could not load dentists.' });
  }
});

module.exports = router;

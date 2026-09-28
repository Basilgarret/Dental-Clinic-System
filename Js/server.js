const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./database');

const apiRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check — visit http://localhost:4000/api/health in a
// browser to confirm the server AND the database connection are both up.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'not connected', detail: err.message });
  }
});

const workspaceRoot = path.resolve(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/Css', express.static(path.join(workspaceRoot, 'Css')));
app.use('/Js', express.static(__dirname));
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Wellstone Dental API running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

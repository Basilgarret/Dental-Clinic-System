const { pool } = require('./database');

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const result = await pool.query('SELECT name, role, clinic_id, disabled_at FROM users WHERE id = $1', [req.session.user.id]);
    const current = result.rows[0];
    if (!current || current.disabled_at) {
      return req.session.destroy(() => {
        res.clearCookie('wellstone.sid', { httpOnly: true, sameSite: 'lax' });
        res.status(401).json({ error: 'This account is disabled or no longer exists.' });
      });
    }
    req.session.user.name = current.name;
    req.session.user.role = current.role;
    req.session.user.clinicId = current.clinic_id || null;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Sign in to continue.' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

const jwt = require('jsonwebtoken');
const db = require('../../database');

const JWT_SECRET = process.env.JWT_SECRET || 'awb-os-secret-key';

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = db.getUserById ? await db.getUserById(decoded.userId) : null;

    if (!user && decoded.email) {
      user = db.getUserByEmail ? await db.getUserByEmail(decoded.email) : null;
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: user.id, email: user.email, full_name: user.full_name };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };

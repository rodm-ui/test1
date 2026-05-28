// server.js
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// =======================
// MySQL Connection Pool
// =======================
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
});

// Test connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected to MySQL!');
    conn.release();
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
  }
})();

// =======================
// Centralized Logger Middleware
// =======================
app.use(async (req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    res.send = originalSend;
    const statusCode = res.statusCode;
    (async () => {
      try {
        const actor = req.body?.email || 'System / Visitor';
        const endpoint = req.originalUrl;
        const method = req.method;

        if (!endpoint.startsWith('/assets') && !endpoint.includes('/api/system-logs')) {
          await pool.execute(
            'INSERT INTO system_logs (user_email, action, method, endpoint, status_code) VALUES (?, ?, ?, ?, ?)',
            [actor, `Executed endpoint call`, method, endpoint, statusCode]
          );
        }
      } catch (err) {
        console.error('⚠️ Logger error:', err.message);
      }
    })();
    return res.send(body);
  };
  next();
});

// =======================
// API: Retrieve Operational Logs
// =======================
app.get('/api/system-logs', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, logs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to retrieve logs' });
  }
});

// Optional: SSE real-time stream
app.get('/api/system-logs/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(async () => {
    try {
      const [rows] = await pool.execute('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 1');
      if (rows.length > 0) res.write(`data: ${JSON.stringify(rows[0])}\n\n`);
    } catch (err) {
      console.error(err);
    }
  }, 3000);

  req.on('close', () => clearInterval(interval));
});

// =======================
// Login API
// =======================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email/password' });

    const user = rows[0];
    const isValid = password === user.password || await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid email/password' });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal DB error' });
  }
});

// =======================
// Users & Products APIs
// =======================
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, role, created_at FROM users');
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products');
    res.json({ success: true, products: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// =======================
// Serve frontend for all other routes
// =======================
app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

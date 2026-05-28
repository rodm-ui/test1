import express from 'express';
import mysql from 'mysql2/promise'; // Using promise wrapper for async/await
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables from .env file
dotenv.config();

const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Serve static assets from frontend build directory
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// =========================================================================
// 1. AIVEN MYSQL DATABASE CONFIGURATION
// =========================================================================
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    // Required for secure connections to Aiven
    rejectUnauthorized: false
  }
});

// Test the MySQL connection pool on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected successfully to your Aiven MySQL Database!');
    connection.release();
  } catch (err) {
    console.error('❌ Connection to Aiven MySQL Database failed:', err.message);
  }
})();

// =========================================================================
// 2. DYNAMIC LOGIN API ROUTE (NO HARDCODING)
// =========================================================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required.' 
    });
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = rows[0];

    const isPasswordValid = password === user.password || await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Database login transaction failed:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server database error' 
    });
  }
});

// =========================================================================
// 3. DYNAMIC DASHBOARD USERS ROUTE (ADDED TO FIX YOUR DATA MISMATCH)
// =========================================================================
app.get('/api/users', async (req, res) => {
  try {
    // Pull ALL users directly out of your real Aiven Database tables
    const [rows] = await pool.execute('SELECT id, name, email, role, created_at FROM users');
    
    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error('Database error while fetching users:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server database error' 
    });
  }
});

// =========================================================================
// 4. DYNAMIC PRODUCTS CATALOG ROUTE
// =========================================================================
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products');
    return res.json({ success: true, products: rows });
  } catch (error) {
    console.error('Database error while fetching products:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// =========================================================================
// 5. DYNAMIC ORDERS ROUTE
// =========================================================================
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM orders');
    return res.json({ success: true, orders: rows });
  } catch (error) {
    console.error('Database error while fetching orders:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// =========================================================================
// 6. WILDCARD FALLBACK ROUTE (Fixes Express 5 / path-to-regexp crash)
// =========================================================================
app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
});

// =========================================================================
// 7. SERVER EXECUTION
// =========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Bloomery Flower Shop Server running on port ${PORT}`);
});

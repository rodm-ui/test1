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
// Aiven MySQL connection URLs look like: mysql://user:pass@host:port/dbname
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
    // Look up user strictly inside your live Aiven MySQL Database
    // Note: MySQL uses '?' instead of '$1' for parameterized queries
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

    // IF NOTHING IS FOUND IN THE DATABASE: Reject immediately
    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = rows[0];

    // Verify password (supports plain text for your seeds, or secure bcrypt hashes)
    const isPasswordValid = password === user.password || await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    // Success! Return user profile details extracted straight from your database
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
// 3. WILDCARD FALLBACK ROUTE (Fixes Express 5 / path-to-regexp crash)
// =========================================================================
app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
});

// =========================================================================
// 4. SERVER EXECUTION
// =========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Bloomery Flower Shop Server running on port ${PORT}`);
});

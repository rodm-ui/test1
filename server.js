import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from a .env file (for local development)
dotenv.config();

const app = express();

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Serve static assets from the frontend build directory
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// =========================================================================
// 1. AIVEN DATABASE CONFIGURATION
// =========================================================================
const { Pool } = pg;

// Initialize connection pool using the single Connection URI from Aiven
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Aiven requires SSL connections. setting rejectUnauthorized to false 
    // prevents connection blocking over dynamic cloud environments like Render.
    rejectUnauthorized: false 
  }
});

// Test the database connection pool on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Connection to Aiven Database failed:', err.stack);
  } else {
    console.log('✅ Connected successfully to your Aiven Database!');
    release(); // Release the test client back to the pool
  }
});

// =========================================================================
// 2. DYNAMIC LOGIN API ROUTE (NO HARDCODING)
// =========================================================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Fail-safe: Block evaluation if parameters are missing
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required.' 
    });
  }

  try {
    // Look up the user account STRICTLY inside your live Aiven Database
    const queryText = 'SELECT * FROM users WHERE email = $1 LIMIT 1';
    const result = await pool.query(queryText, [email]);

    // IF NOTHING IS FOUND IN THE DATABASE: Stop immediately and reject the login
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = result.rows[0];

    // Password validation engine:
    // Supports plain-text checks for old seeds, or highly secure bcrypt hashing hashes
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
        email: user.email
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
// Uses regex /.*/ to safely forward client-side routing to Vite's index.html
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

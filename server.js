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
// 2. CENTRALIZED OPERATIONAL LOGGER MIDDLEWARE (No Hardcoding)
// =========================================================================
// This interceptor automatically runs on EVERY incoming request, records it 
// into your central Aiven database, and passes the operation safely along.
app.use(async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function (body) {
    res.send = originalSend;
    const statusCode = res.statusCode;
    
    // Process the database logging asynchronously so it doesn't slow down the user experience
    (async () => {
      try {
        const actor = req.body?.email || 'System / Visitor'; 
        const endpointPath = req.originalUrl;
        const httpMethod = req.method;

        // Skip recording internal build file fetches or logs endpoint loops to avoid database flooding
        if (!endpointPath.startsWith('/assets') && !endpointPath.includes('/api/system-logs')) {
          await pool.execute(
            'INSERT INTO system_logs (user_email, action, method, endpoint, status_code) VALUES (?, ?, ?, ?, ?)',
            [actor, `Executed endpoint call`, httpMethod, endpointPath, statusCode]
          );
        }
      } catch (err) {
        console.error('⚠️ Centralized Logger Interceptor Failure:', err.message);
      }
    })();

    return res.send(body);
  };
  
  next();
});

// =========================================================================
// 3. REAL-TIME LOGRETRIEVAL API ENDPOINT
// =========================================================================
app.get('/api/system-logs', async (req, res) => {
  try {
    // Dynamically retrieve the newest record history directly from Aiven MySQL
    const [rows] = await pool.execute('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100');
    
    return res.json({
      success: true,
      logs: rows
    });
  } catch (error) {
    console.error('Database query error while pulling system logs:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve operational database records' 
    });
  }
});

// =========================================================================
// 4. DYNAMIC LOGIN API ROUTE
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
// 5. ADDITIONAL COMPLEMENTARY CORE ENDPOINTS
// =========================================================================
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, role, created_at FROM users');
    return res.json({ success: true, users: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products');
    return res.json({ success: true, products: rows });
  } catch (error) {
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
  console.log(`🚀 Bloomery Flower Shop Server executing smoothly on port ${PORT}`);
});

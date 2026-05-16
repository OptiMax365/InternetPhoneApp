// server.js
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import pkg from "pg";

// Attempt to load dotenv only in local development
if (process.env.NODE_ENV !== "production") {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
    console.log("✅ Loaded .env file");
  } catch (err) {
    console.warn("⚠️ dotenv not installed, skipping...");
  }
}

const { Pool } = pkg;
const app = express();

// PORT from environment or fallback to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set! Please set it in environment variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true // Required for Render PostgreSQL
  }
});

// CREATE USERS TABLE IF IT DOESN'T EXIST
async function startDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database Ready");
  } catch (err) {
    console.error("❌ Database Error:", err);
  }
}

// Start DB on server start
startDatabase();

// ================== ROUTES ==================

// Root route
app.get("/", (req, res) => {
  res.send("VOICE MESH SERVER RUNNING");
});

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    username = username.toLowerCase().trim();

    // Check if username exists
    const check = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    await pool.query("INSERT INTO users(username,password) VALUES($1,$2)", [username, hashed]);

    res.json({ success: true, message: "User registered" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup server error" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    username = username.toLowerCase().trim();

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid username" });
    }

    const user = result.rows[0];

    // Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    res.json({ success: true, username: user.username, message: "Login success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login server error" });
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
});
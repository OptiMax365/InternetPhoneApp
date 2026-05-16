// server.js
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DATABASE CONFIGURATION
// Use DATABASE_URL environment variable (Render provides it)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render
    }
});

// CREATE USERS TABLE IF NOT EXISTS
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

startDatabase();

// ROOT ENDPOINT
app.get("/", (req, res) => {
    res.send("VOICE MESH SERVER RUNNING");
});

// SIGNUP ENDPOINT
app.post("/signup", async (req, res) => {
    try {
        let { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Missing username or password" });
        }

        username = username.toLowerCase().trim();

        const check = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users(username,password) VALUES($1,$2)", [username, hashed]);

        res.json({ success: true, message: "User registered" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Signup server error" });
    }
});

// LOGIN ENDPOINT
app.post("/login", async (req, res) => {
    try {
        let { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Missing username or password" });
        }

        username = username.toLowerCase().trim();

        const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Invalid username" });
        }

        const user = result.rows[0];
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

// START SERVER
app.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
});
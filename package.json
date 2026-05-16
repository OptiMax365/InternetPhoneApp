// server.js

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import bcrypt from "bcrypt";
import { ExpressPeerServer } from "peer";
import http from "http";

const { Pool } = pkg;

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;

// =========================
// POSTGRESQL DATABASE
// =========================

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://admin:jJYTKV0cpikWb4aN5bTIhOaQIN6Tm70Z@dpg-d844caeq1p3s738l08g0-a/voice_mesh_db",
  ssl: {
    rejectUnauthorized: false,
  },
});

// =========================
// CREATE USERS TABLE
// =========================

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Users table ready");
  } catch (err) {
    console.log(err);
  }
}

createTable();

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// =========================
// PEER SERVER
// =========================

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/",
});

app.use("/peerjs", peerServer);

// =========================
// SIGNUP
// =========================

app.post("/signup", async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing username or password",
      });
    }

    username = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const existing = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users(username,password) VALUES($1,$2)",
      [username, hashed]
    );

    res.json({
      success: true,
      message: "Registered successfully",
      username,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Signup server error",
    });
  }
});

// =========================
// LOGIN
// =========================

app.post("/login", async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing username or password",
      });
    }

    username = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid username",
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      username: user.username,
      peerId: user.username,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Login server error",
    });
  }
});

// =========================
// ONLINE TEST
// =========================

app.get("/", (req, res) => {
  res.send("VOICE MESH SERVER ONLINE");
});

// =========================
// START SERVER
// =========================

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
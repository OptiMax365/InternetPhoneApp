const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

/* ===================== */
/* POSTGRES */
/* ===================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY
);
`);

/* ===================== */
/* STATE */
/* ===================== */

const sockets = new Map();
const peers = new Map();

function norm(u) {
  return (u || "").trim().toLowerCase();
}

function send(user, data) {
  const ws = sockets.get(user);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastUsers() {
  const users = Array.from(peers.entries()).map(([username, peerId]) => ({
    username,
    peerId
  }));

  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "users", users }));
    }
  }
}

/* ===================== */
/* WS */
/* ===================== */

wss.on("connection", (ws) => {
  let currentUser = null;

  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);

    /* ===== SIGNUP ===== */
    if (data.type === "signup") {
      const username = norm(data.username);

      if (username.length < 4) {
        return ws.send(JSON.stringify({
          type: "error",
          message: "Username too short"
        }));
      }

      const exists = await pool.query(
        "SELECT username FROM users WHERE username=$1",
        [username]
      );

      if (exists.rows.length > 0) {
        return ws.send(JSON.stringify({
          type: "error",
          message: "Username already exists"
        }));
      }

      await pool.query(
        "INSERT INTO users(username) VALUES($1)",
        [username]
      );

      return ws.send(JSON.stringify({
        type: "ok",
        message: "Signup successful"
      }));
    }

    /* ===== SIGNIN (STRICT VERIFICATION) ===== */
    if (data.type === "signin") {
      const username = norm(data.username);

      const user = await pool.query(
        "SELECT username FROM users WHERE username=$1",
        [username]
      );

      if (user.rows.length === 0) {
        return ws.send(JSON.stringify({
          type: "error",
          message: "User not registered"
        }));
      }

      currentUser = username;

      sockets.set(username, ws);
      peers.set(username, data.peerId);

      broadcastUsers();

      return ws.send(JSON.stringify({
        type: "ok",
        message: "logged-in"
      }));
    }

    /* ===== CALL ===== */
    if (data.type === "call-request") {
      send(data.to, {
        type: "incoming-call",
        from: data.from,
        peerId: peers.get(data.from)
      });
    }

    if (data.type === "accept-call") {
      send(data.to, { type: "call-start" });
      send(data.from, { type: "call-start" });
    }

    if (data.type === "end-call") {
      send(data.to, { type: "call-ended" });
      send(data.from, { type: "call-ended" });
    }

    /* ===== LOGOUT ===== */
    if (data.type === "logout") {
      if (currentUser) {
        sockets.delete(currentUser);
        peers.delete(currentUser);
        broadcastUsers();
      }
    }
  });

  ws.on("close", () => {
    if (currentUser) {
      sockets.delete(currentUser);
      peers.delete(currentUser);
      broadcastUsers();
    }
  });
});

server.listen(process.env.PORT || 3000);
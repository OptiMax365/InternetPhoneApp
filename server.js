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
/* POSTGRES CONNECTION */
/* ===================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* CREATE TABLE */
pool.query(`
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY
);
`);

/* ===================== */
/* MEMORY MAPS */
/* ===================== */

const sockets = new Map(); // username → ws
const peers = new Map();   // username → peerId

function normalize(u){
  return (u || "").trim().toLowerCase();
}

function send(user, data){
  const ws = sockets.get(user);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastUsers(){
  const users = Array.from(peers.entries()).map(([username, peerId]) => ({
    username,
    peerId
  }));

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify({
        type: "users",
        users
      }));
    }
  });
}

/* ===================== */
/* WS CONNECTION */
/* ===================== */

wss.on("connection", (ws) => {

  let currentUser = null;

  ws.on("message", async (msg) => {

    const data = JSON.parse(msg);

    /* ===================== */
    /* SIGNUP */
    /* ===================== */

    if (data.type === "signup") {

      const username = normalize(data.username);

      if (username.length < 10) {
        return ws.send(JSON.stringify({
          type: "error",
          message: "Username must be 10+ characters"
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

      ws.send(JSON.stringify({
        type: "ok",
        message: "Signup successful"
      }));
    }

    /* ===================== */
    /* SIGNIN */
    /* ===================== */

    if (data.type === "signin") {

      const username = normalize(data.username);

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

      ws.send(JSON.stringify({
        type: "ok",
        message: "Logged in"
      }));
    }

    /* ===================== */
    /* CALL REQUEST */
    /* ===================== */

    if (data.type === "call-request") {

      send(data.to, {
        type: "incoming-call",
        from: data.from,
        peerId: peers.get(data.from)
      });
    }

    /* ===================== */
    /* ACCEPT CALL */
    /* ===================== */

    if (data.type === "accept-call") {

      send(data.to, { type: "call-start" });
      send(data.from, { type: "call-start" });
    }

    /* ===================== */
    /* END CALL */
    /* ===================== */

    if (data.type === "end-call") {

      send(data.to, { type: "call-ended" });
      send(data.from, { type: "call-ended" });
    }

    /* ===================== */
    /* LOGOUT */
    /* ===================== */

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
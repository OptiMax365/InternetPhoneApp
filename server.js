const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./users.db");

/* -------------------- */
/* TABLE */
/* -------------------- */

db.run(`
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY
)
`);

/* -------------------- */
/* MEMORY MAPS */
/* -------------------- */

const sockets = new Map();  // username → ws
const peers = new Map();    // username → peerId

function normalize(u){
  return (u || "").trim().toLowerCase();
}

/* -------------------- */
/* BROADCAST USERS */
/* -------------------- */

function broadcastUsers(){

  const users = Array.from(peers.entries()).map(([username, peerId])=>({
    username,
    peerId
  }));

  wss.clients.forEach(c=>{
    if(c.readyState === WebSocket.OPEN){
      c.send(JSON.stringify({
        type:"users",
        users
      }));
    }
  });
}

/* -------------------- */
/* SEND HELPER */
/* -------------------- */

function send(user, data){
  const ws = sockets.get(user);
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify(data));
  }
}

/* -------------------- */
/* MAIN SOCKET */
/* -------------------- */

wss.on("connection",(ws)=>{

  let currentUser = null;

  ws.on("message",(msg)=>{

    const data = JSON.parse(msg);

    /* ==================== */
    /* SIGNUP */
    /* ==================== */

    if(data.type === "signup"){

      const username = normalize(data.username);

      if(username.length < 10){
        return ws.send(JSON.stringify({
          type:"error",
          message:"Username must be 10+ characters"
        }));
      }

      db.get(
        "SELECT username FROM users WHERE username=?",
        [username],
        (err,row)=>{

          if(row){
            ws.send(JSON.stringify({
              type:"error",
              message:"Username already exists"
            }));
          } else {

            db.run("INSERT INTO users(username) VALUES(?)",[username]);

            ws.send(JSON.stringify({
              type:"ok",
              message:"Signup successful"
            }));
          }
        }
      );
    }

    /* ==================== */
    /* SIGNIN (STRICT CHECK) */
    /* ==================== */

    if(data.type === "signin"){

      const username = normalize(data.username);

      db.get(
        "SELECT username FROM users WHERE username=?",
        [username],
        (err,row)=>{

          if(!row){
            return ws.send(JSON.stringify({
              type:"error",
              message:"User not registered"
            }));
          }

          currentUser = username;

          sockets.set(username, ws);
          peers.set(username, data.peerId);

          broadcastUsers();

          ws.send(JSON.stringify({
            type:"ok",
            message:"Signed in"
          }));
        }
      );
    }

    /* ==================== */
    /* CALL REQUEST */
    /* ==================== */

    if(data.type === "call-request"){

      send(data.to,{
        type:"incoming-call",
        from:data.from,
        peerId:data.from
      });
    }

    /* ==================== */
    /* ACCEPT CALL */
    /* ==================== */

    if(data.type === "accept-call"){

      send(data.to,{
        type:"call-accepted",
        peerId:data.from
      });

      send(data.from,{
        type:"call-start"
      });
    }

    /* ==================== */
    /* REJECT CALL */
    /* ==================== */

    if(data.type === "reject-call"){

      send(data.to,{
        type:"call-rejected"
      });
    }

    /* ==================== */
    /* END CALL */
    /* ==================== */

    if(data.type === "end-call"){

      send(data.to,{ type:"call-ended" });
      send(data.from,{ type:"call-ended" });
    }

  });

  ws.on("close",()=>{

    if(currentUser){
      sockets.delete(currentUser);
      peers.delete(currentUser);
      broadcastUsers();
    }
  });

});

server.listen(process.env.PORT || 3000);

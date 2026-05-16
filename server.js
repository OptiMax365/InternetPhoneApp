const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();

const server = http.createServer(app);

const wss = new WebSocket.Server({
    server
});

/* -------------------------- */
/* ONLINE USERS */
/* -------------------------- */

const users = new Map();

/*
users = {
   peerId : {
      peerId,
      username
   }
}
*/

/* -------------------------- */
/* SERVE FRONTEND */
/* -------------------------- */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* -------------------------- */
/* BROADCAST USERS */
/* -------------------------- */

function broadcastUsers(){

    const list =
        Array.from(users.values());

    const payload =
        JSON.stringify({
            type:"users",
            users:list
        });

    wss.clients.forEach(client => {

        if(client.readyState === WebSocket.OPEN){

            client.send(payload);

        }

    });

}

/* -------------------------- */
/* SOCKET CONNECTION */
/* -------------------------- */

wss.on("connection", (ws) => {

    let currentPeerId = null;

    ws.on("message", (msg) => {

        try{

            const data =
                JSON.parse(msg);

            /* USER JOIN */

            if(data.type === "join"){

                currentPeerId =
                    data.peerId;

                users.set(currentPeerId, {

                    peerId:data.peerId,

                    username:data.username

                });

                console.log(
                    data.username +
                    " joined"
                );

                broadcastUsers();

            }

        }catch(err){

            console.log(err);

        }

    });

    /* USER DISCONNECT */

    ws.on("close", ()=>{

        if(currentPeerId){

            users.delete(currentPeerId);

            broadcastUsers();

        }

    });

});

/* -------------------------- */
/* START SERVER */
/* -------------------------- */

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, ()=>{

    console.log(
        "Server running on port " + PORT
    );

});

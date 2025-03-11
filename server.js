const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = 2000;

const heliusApiKey = 'f5704630-83c9-4627-bffa-d7da240bf76c'; // Store API key securely

app.get('/tokenInfo', async (req, res) => {
    const address = req.query.address;
    if (!address) {
        return res.status(400).send({ error: 'Address is required' });
    }

    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "jsonrpc": "2.0",
                "id": "text",
                "method": "getAsset",
                "params": { id: address }
            }),
        });
        const data = await response.json();
        if (data && data.result && data.result.content && data.result.content.metadata) {
            res.send({
                name: data.result.content.metadata.name,
                symbol: data.result.content.metadata.symbol
            });
        } else {
            res.send({ name: "Name not found", symbol: "Symbol not found" });
        }
    } catch (error) {
        console.error("Server-side token info error:", error);
        res.status(500).send({ error: 'Internal server error' });
    }
});


app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected'); // Keep this for server-side logging

    socket.on('joinRoom', (data) => {
        const { roomId, displayName } = data;

        if (!rooms[roomId]) {
            rooms[roomId] = { users: [], messages: [] };
        }

        if (rooms[roomId].users.find(user => user.displayName === displayName)) {
            socket.emit('error', 'Display name already taken in this room.');
            return;
        }

        socket.join(roomId);
        rooms[roomId].users.push({ id: socket.id, displayName });

        // Remove this line to prevent "user joined" message in chat
        // socket.to(roomId).emit('userJoined', { displayName });

        socket.emit('joinedRoom', { roomId, messageHistory: rooms[roomId].messages });

        io.to(roomId).emit('userList', rooms[roomId].users.map(user => user.displayName));

        socket.on('chatMessage', (msg) => {
            const messageData = { message: msg, user: displayName };
            rooms[roomId].messages.push(messageData);
            io.to(roomId).emit('chatMessage', messageData);
        });

        socket.on('disconnect', () => {
            const userIndex = rooms[roomId].users.findIndex(user => user.id === socket.id);
            if (userIndex > -1) {
                const disconnectedUser = rooms[roomId].users.splice(userIndex, 1)[0];

                // Remove this line to prevent "user left" message in chat
                // socket.to(roomId).emit('userLeft', { displayName: disconnectedUser.displayName });

                io.to(roomId).emit('userList', rooms[roomId].users.map(user => user.displayName));
            }
        });
    });
});

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});

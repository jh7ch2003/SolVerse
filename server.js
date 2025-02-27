const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = 3000;

app.use(express.static(__dirname + '/public')); // Serve static files from 'public'

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

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

        socket.to(roomId).emit('userJoined', { displayName });
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
                socket.to(roomId).emit('userLeft', { displayName: disconnectedUser.displayName });
                io.to(roomId).emit('userList', rooms[roomId].users.map(user => user.displayName));

                // Rooms persist - no deletion here
            }
        });
    });
});

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});